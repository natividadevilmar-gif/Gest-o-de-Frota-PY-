"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CercaVista, OcorrenciaVista } from "@/lib/monitoramento";
import type { CaminhaoMapa } from "@/lib/rastreio/dados";
import { CobrarWhatsapp } from "./CobrarWhatsapp";
import { alternarCerca, atenderOcorrencia, criarCerca, excluirCerca, resolverOcorrencia, type Resultado } from "./actions";

type Dados = { frota: CaminhaoMapa[]; novas: number; abertas: OcorrenciaVista[]; resolvidas: OcorrenciaVista[]; cercas: CercaVista[] };

const ATUALIZAR_MS = 15_000;
const GRAVIDADE: Record<string, { rotulo: string; cor: string; pill: string }> = {
  alta: { rotulo: "Alta", cor: "var(--bad)", pill: "bad" },
  media: { rotulo: "Média", cor: "var(--warn)", pill: "warn" },
  baixa: { rotulo: "Baixa", cor: "var(--info)", pill: "info" },
};
const ORDEM = ["alta", "media", "baixa"];
const COR_CERCA: Record<string, string> = { patio: "#2f7d4f", cliente: "#2c5d8a", fronteira: "#b26a00", risco: "#b3261e" };
const COR_SITUACAO: Record<string, string> = { movimento: "#2f9e5b", parado: "#e0a100", desligado: "#7d8580", "sem-sinal": "#b3261e", aguardando: "#2c5d8a" };

const quando = (iso: string | null) => {
  if (!iso) return "–";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.floor(min / 60)} h ${min % 60} min`;
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Bipe curto para avisar o operador de alerta novo. */
function bipe() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    // Navegador sem áudio: segue sem som.
  }
}

/** Liga a central à janela só do mapa (outra tela): o alerta escolhido numa aparece na outra. */
const CANAL = "kmcero-central";

export function Central({ inicial, todos, clienteNome, podeCercas, tiposCerca, soMapa = false }: {
  inicial: Dados; todos: boolean; clienteNome: string; podeCercas: boolean; tiposCerca: Record<string, string>;
  /** Janela só com o mapa, para um segundo monitor. */
  soMapa?: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<"fila" | "resolvidas" | "cercas">("fila");
  const [som, setSom] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [marcando, setMarcando] = useState(false);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [raio, setRaio] = useState(2000);
  const [pendente, iniciar] = useTransition();
  const [resultado, criar, criando] = useActionState<Resultado, FormData>(criarCerca, null);

  const caixa = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const camadas = useRef<{ cercas: Leaflet.LayerGroup; frota: Leaflet.LayerGroup; alertas: Leaflet.LayerGroup; ponto: Leaflet.LayerGroup } | null>(null);
  const somRef = useRef(som);
  const marcandoRef = useRef(marcando);
  somRef.current = som;
  marcandoRef.current = marcando;
  const [pronto, setPronto] = useState(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const focoRemoto = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CANAL);
    c.onmessage = (e: MessageEvent<{ foco?: string | null; atualizar?: boolean }>) => {
      const v = e.data.foco;
      if (v !== undefined) {
        // Só marca como vindo de fora quando muda, senão o próximo clique daqui não seria enviado.
        setFoco((atual) => {
          if (atual === v) return atual;
          focoRemoto.current = true;
          return v;
        });
      }
      if (e.data.atualizar) void atualizarRef.current();
    };
    canal.current = c;
    return () => c.close();
  }, []);

  useEffect(() => {
    if (focoRemoto.current) {
      focoRemoto.current = false;
      return;
    }
    if (foco) canal.current?.postMessage({ foco });
  }, [foco]);

  const url = todos ? "/monitoramento/dados?todos=1" : "/monitoramento/dados";
  const atualizar = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d: Dados = await r.json();
    setDados(d);
    if (d.novas > 0 && somRef.current) bipe();
  }, [url]);

  const atualizarRef = useRef(atualizar);
  atualizarRef.current = atualizar;

  useEffect(() => {
    const id = setInterval(atualizar, ATUALIZAR_MS);
    return () => clearInterval(id);
  }, [atualizar]);

  useEffect(() => {
    if (resultado?.ok) {
      setPonto(null);
      setMarcando(false);
      void atualizar();
    }
  }, [resultado, atualizar]);

  // Mapa (o Leaflet só roda no navegador).
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !caixa.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(caixa.current).setView([-25.5, -56.5], 7);
      mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      camadas.current = {
        cercas: mod.layerGroup().addTo(m),
        frota: mod.layerGroup().addTo(m),
        alertas: mod.layerGroup().addTo(m),
        ponto: mod.layerGroup().addTo(m),
      };
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (marcandoRef.current) setPonto({ lat: Math.round(e.latlng.lat * 1e5) / 1e5, lng: Math.round(e.latlng.lng * 1e5) / 1e5 });
      });
      mapa.current = m;
      const pts = inicial.frota.filter((c) => c.lat != null).map((c) => [c.lat!, c.lng!] as [number, number]);
      if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 10 });
      setPronto(true);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [inicial]);

  useEffect(() => {
    const mod = L.current, c = camadas.current;
    if (!pronto || !mod || !c) return;
    c.cercas.clearLayers();
    for (const z of dados.cercas) {
      mod.circle([z.lat, z.lng], {
        radius: z.raioM, color: COR_CERCA[z.tipo] ?? "#2c5d8a", weight: 2, fillOpacity: z.ativa ? 0.1 : 0.03,
        dashArray: z.ativa ? undefined : "6 6", opacity: z.ativa ? 0.9 : 0.5,
      }).bindTooltip(`${z.nome} · ${tiposCerca[z.tipo] ?? z.tipo}${z.ativa ? "" : " (desativada)"}${todos ? ` · ${z.cliente}` : ""}`).addTo(c.cercas);
    }
  }, [dados.cercas, pronto, tiposCerca, todos]);

  useEffect(() => {
    const mod = L.current, c = camadas.current;
    if (!pronto || !mod || !c) return;
    c.frota.clearLayers();
    for (const f of dados.frota) {
      if (f.lat == null || f.lng == null) continue;
      mod.circleMarker([f.lat, f.lng], { radius: 5, color: "#fff", weight: 1.5, fillColor: COR_SITUACAO[f.situacao] ?? "#7d8580", fillOpacity: 1 })
        .bindTooltip(`${f.placa} · ${f.velocidadeKmh} km/h${todos ? ` · ${f.cliente}` : ""}`)
        .addTo(c.frota);
    }
  }, [dados.frota, pronto, todos]);

  useEffect(() => {
    const mod = L.current, c = camadas.current;
    if (!pronto || !mod || !c) return;
    c.alertas.clearLayers();
    for (const o of dados.abertas) {
      if (o.lat == null || o.lng == null) continue;
      const icone = mod.divIcon({ className: "", html: `<div class="alerta-mapa alerta-${o.gravidade}${o.id === foco ? " alerta-foco" : ""}">!</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      mod.marker([o.lat, o.lng], { icon: icone, zIndexOffset: o.id === foco ? 2000 : 1000, title: o.titulo }).on("click", () => setFoco(o.id)).addTo(c.alertas);
    }
  }, [dados.abertas, pronto, foco]);

  useEffect(() => {
    const mod = L.current, c = camadas.current;
    if (!pronto || !mod || !c) return;
    c.ponto.clearLayers();
    if (ponto) mod.circle([ponto.lat, ponto.lng], { radius: raio, color: "#C8261B", weight: 2, dashArray: "4 4", fillOpacity: 0.12 }).addTo(c.ponto);
  }, [ponto, raio, pronto]);

  useEffect(() => {
    const o = dados.abertas.find((x) => x.id === foco) ?? dados.resolvidas.find((x) => x.id === foco);
    if (o?.lat != null && o.lng != null) mapa.current?.flyTo([o.lat, o.lng], Math.max(mapa.current.getZoom(), 11), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  useEffect(() => {
    if (caixa.current) caixa.current.style.cursor = marcando ? "crosshair" : "";
  }, [marcando]);

  const fila = useMemo(
    // Por gravidade e depois a mais recente; atender não muda a posição, para não "pular" na mão do operador.
    () => [...dados.abertas].sort((a, b) => ORDEM.indexOf(a.gravidade) - ORDEM.indexOf(b.gravidade) || b.criadaEm.localeCompare(a.criadaEm)),
    [dados.abertas],
  );
  const conta = (g: string) => dados.abertas.filter((o) => o.status === "aberta" && o.gravidade === g).length;
  const emAtendimento = dados.abertas.filter((o) => o.status === "atendimento").length;
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Asuncion" });
  const resolvidasHoje = dados.resolvidas.filter((o) => o.resolvidaEm && new Date(o.resolvidaEm).toLocaleDateString("pt-BR", { timeZone: "America/Asuncion" }) === hoje).length;

  // Depois de atender ou resolver, a janela do mapa também atualiza na hora.
  const agir = (f: () => Promise<void>) => iniciar(async () => { await f(); await atualizar(); canal.current?.postMessage({ atualizar: true }); });
  const abrirMapa = () => window.open(`/central-mapa${todos ? "?todos=1" : ""}`, "kmcero-mapa", "popup,width=1280,height=800");

  return (
    <div className="central">
      <div className="central-kpis">
        <div className="ck ck-alta"><b>{conta("alta")}</b><span>Alta</span></div>
        <div className="ck ck-media"><b>{conta("media")}</b><span>Média</span></div>
        <div className="ck ck-baixa"><b>{conta("baixa")}</b><span>Baixa</span></div>
        <div className="ck"><b>{emAtendimento}</b><span>Em atendimento</span></div>
        <div className="ck"><b>{resolvidasHoje}</b><span>Resolvidas hoje</span></div>
        <label className="ck ck-som">
          <input type="checkbox" checked={som} onChange={(e) => { setSom(e.target.checked); if (e.target.checked) bipe(); }} />
          <span>Som de alerta</span>
        </label>
        {!soMapa && <button type="button" className="ck ck-tela" onClick={abrirMapa} title="Abre o mapa numa janela própria, para arrastar ao outro monitor"><b aria-hidden="true">⧉</b><span>Mapa em outra tela</span></button>}
      </div>

      <div className={soMapa ? "central-corpo central-so-mapa" : "central-corpo"}>
        <div className="central-mapa">
          <div ref={caixa} className="rastreio-leaflet central-leaflet" />
          {marcando && <p className="central-marcando">Clique no mapa para marcar o centro da cerca.</p>}
        </div>

        {!soMapa && <div className="central-painel card">
          <div className="abas" role="tablist">
            <button role="tab" aria-selected={aba === "fila"} onClick={() => setAba("fila")}>Fila {dados.abertas.length}</button>
            <button role="tab" aria-selected={aba === "resolvidas"} onClick={() => setAba("resolvidas")}>Resolvidas</button>
            <button role="tab" aria-selected={aba === "cercas"} onClick={() => setAba("cercas")}>Cercas {dados.cercas.length}</button>
          </div>

          {aba === "fila" && (
            fila.length === 0 ? <p className="note">Nenhuma ocorrência aberta. A central verifica a frota a cada 15 segundos.</p> : (
              <ul className="ocorrencias">
                {fila.map((o) => (
                  <li key={o.id} className={o.id === foco ? "foco" : undefined} style={{ borderLeftColor: GRAVIDADE[o.gravidade]?.cor }}>
                    <button type="button" className="oc-topo" onClick={() => setFoco(o.id)}>
                      <b>{o.titulo}</b>
                      <small>{o.detalhe}</small>
                      <small>{todos ? `${o.cliente} · ` : ""}{quando(o.criadaEm)}{o.status === "atendimento" ? ` · em atendimento por ${o.atendidaPor}` : ""}</small>
                    </button>
                    <div className="oc-acoes">
                      <span className={`pill ${GRAVIDADE[o.gravidade]?.pill ?? "info"}`}>{GRAVIDADE[o.gravidade]?.rotulo ?? o.gravidade}</span>
                      {o.status === "aberta" && <button type="button" disabled={pendente} onClick={() => agir(() => atenderOcorrencia(o.id))}>Atender</button>}
                      <button type="button" className="pri" disabled={pendente} onClick={() => { setResolvendo(resolvendo === o.id ? null : o.id); setObs(""); }}>Resolver</button>
                    </div>
                    <div className="oc-links">
                      {o.midiaId && <a className="oc-btn oc-video" href={`/video?midia=${o.midiaId}${todos ? "&todos=1" : ""}`}><span aria-hidden="true">▶</span> Ver vídeo</a>}
                      <a className="oc-btn" href={`/comandos?caminhao=${o.caminhaoId}${todos ? "&todos=1" : ""}`}><span aria-hidden="true">⚙</span> Comandos</a>
                      <button type="button" className="oc-btn oc-wa" aria-expanded={cobrando === o.id} onClick={() => setCobrando(cobrando === o.id ? null : o.id)}>
                        <span aria-hidden="true">✆</span> WhatsApp do motorista
                      </button>
                    </div>
                    {cobrando === o.id && (
                      <CobrarWhatsapp o={o} aoEnviar={() => { setCobrando(null); if (o.status === "aberta") agir(() => atenderOcorrencia(o.id)); }} />
                    )}
                    {resolvendo === o.id && (
                      <form className="oc-resolver" onSubmit={(e) => { e.preventDefault(); agir(async () => { await resolverOcorrencia(o.id, obs); setResolvendo(null); }); }}>
                        <label htmlFor={`obs-${o.id}`}>O que foi feito</label>
                        <textarea id={`obs-${o.id}`} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: liguei para o motorista, está tudo bem" />
                        <button type="submit" className="pri" disabled={pendente}>Confirmar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}

          {aba === "resolvidas" && (
            dados.resolvidas.length === 0 ? <p className="note">Nenhuma ocorrência resolvida ainda.</p> : (
              <ul className="ocorrencias">
                {dados.resolvidas.map((o) => (
                  <li key={o.id} style={{ borderLeftColor: "var(--line)" }}>
                    <button type="button" className="oc-topo" onClick={() => setFoco(o.id)}>
                      <b>{o.titulo}</b>
                      <small>{todos ? `${o.cliente} · ` : ""}Resolvida {quando(o.resolvidaEm)} por {o.atendidaPor ?? "–"}</small>
                      {o.observacao && <small>“{o.observacao}”</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {aba === "cercas" && (
            <div className="cercas">
              {podeCercas && (
                <form action={criar} className="cerca-nova">
                  <b>Nova cerca{todos ? ` para ${clienteNome}` : ""}</b>
                  <label htmlFor="cerca-nome">Nome<input id="cerca-nome" name="nome" placeholder="Ex.: Pátio Santa Rita" required /></label>
                  <div className="cerca-linha">
                    <label htmlFor="cerca-tipo">Tipo
                      <select id="cerca-tipo" name="tipo" defaultValue="cliente">
                        {Object.entries(tiposCerca).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label htmlFor="cerca-raio">Raio (m)<input id="cerca-raio" name="raioM" type="number" min={100} max={50000} step={100} value={raio} onChange={(e) => setRaio(Number(e.target.value) || 100)} /></label>
                  </div>
                  <input type="hidden" name="lat" value={ponto?.lat ?? ""} />
                  <input type="hidden" name="lng" value={ponto?.lng ?? ""} />
                  <div className="cerca-linha">
                    <button type="button" aria-pressed={marcando} onClick={() => setMarcando(!marcando)}>{marcando ? "Clicando no mapa…" : ponto ? "Mudar o centro" : "Marcar no mapa"}</button>
                    <small>{ponto ? `${ponto.lat}, ${ponto.lng}` : "nenhum ponto marcado"}</small>
                  </div>
                  <button type="submit" className="pri" disabled={criando || !ponto}>Criar cerca</button>
                  {resultado && <small className={`pill ${resultado.ok ? "ok" : "bad"}`} role="status">{resultado.msg}</small>}
                </form>
              )}
              <ul className="cerca-lista">
                {dados.cercas.map((z) => (
                  <li key={z.id} className={z.ativa ? undefined : "inativa"}>
                    <i style={{ background: COR_CERCA[z.tipo] }} />
                    <button type="button" className="oc-topo" onClick={() => mapa.current?.flyTo([z.lat, z.lng], 12, { duration: 0.6 })}>
                      <b>{z.nome}</b>
                      <small>{tiposCerca[z.tipo] ?? z.tipo} · raio {(z.raioM / 1000).toLocaleString("pt-BR")} km{todos ? ` · ${z.cliente}` : ""}{z.ativa ? "" : " · desativada"}</small>
                    </button>
                    {podeCercas && (
                      <span className="oc-acoes">
                        <button type="button" disabled={pendente} onClick={() => agir(() => alternarCerca(z.id))}>{z.ativa ? "Desativar" : "Ativar"}</button>
                        <button type="button" disabled={pendente} onClick={() => { if (confirm(`Excluir a cerca "${z.nome}"?`)) agir(() => excluirCerca(z.id)); }}>Excluir</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
