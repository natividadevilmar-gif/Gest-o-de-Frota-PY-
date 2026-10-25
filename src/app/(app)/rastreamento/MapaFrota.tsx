"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaminhaoMapa, Situacao, Trajeto } from "@/lib/rastreio/dados";

const ROTULO: Record<Situacao, string> = {
  movimento: "Em movimento",
  parado: "Parado ligado",
  desligado: "Desligado",
  "sem-sinal": "Sem sinal",
  aguardando: "Aguardando 1º sinal",
  "sem-rastreador": "Sem rastreador",
};
const EVENTO: Record<string, string> = { freada: "Freada brusca", aceleracao: "Aceleração brusca", curva: "Curva brusca", excesso: "Excesso de velocidade" };
const ATUALIZAR_MS = 30_000;

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Asuncion" }) : "–";
const quando = (iso: string | null) => {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Asuncion" });
};

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function MapaFrota({ inicial, hoje }: { inicial: CaminhaoMapa[]; hoje: string }) {
  const [frota, setFrota] = useState(inicial);
  const [sel, setSel] = useState<string | null>(null);
  const [dia, setDia] = useState(hoje);
  const [trajeto, setTrajeto] = useState<Trajeto | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Situacao | "todos">("todos");

  const caixa = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const marcas = useRef<Leaflet.LayerGroup | null>(null);
  const linha = useRef<Leaflet.LayerGroup | null>(null);
  const [pronto, setPronto] = useState(false);

  // Cria o mapa uma vez (o Leaflet só roda no navegador).
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !caixa.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(caixa.current, { zoomControl: true }).setView([-25.5, -56.5], 7);
      mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      linha.current = mod.layerGroup().addTo(m);
      marcas.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      const pts = inicial.filter((c) => c.lat != null).map((c) => [c.lat!, c.lng!] as [number, number]);
      if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
      setPronto(true);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [inicial]);

  // Atualiza as posições a cada 30 segundos.
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await fetch("/rastreamento/frota", { cache: "no-store" }).catch(() => null);
      if (r?.ok) setFrota(await r.json());
    }, ATUALIZAR_MS);
    return () => clearInterval(id);
  }, []);

  // Marcadores dos caminhões.
  useEffect(() => {
    const mod = L.current, grupo = marcas.current;
    if (!pronto || !mod || !grupo) return;
    grupo.clearLayers();
    for (const c of frota) {
      if (c.lat == null || c.lng == null) continue;
      const icone = mod.divIcon({
        className: "",
        html: `<div class="mk mk-${c.situacao}${c.id === sel ? " mk-sel" : ""}"><i></i>${esc(c.placa)}</div>`,
        iconSize: undefined,
        iconAnchor: [10, 12],
      });
      mod.marker([c.lat, c.lng], { icon: icone, title: c.placa, zIndexOffset: c.id === sel ? 1000 : 0 })
        .on("click", () => setSel(c.id))
        .addTo(grupo);
    }
  }, [frota, sel, pronto]);

  // Trajeto do caminhão escolhido no dia escolhido.
  useEffect(() => {
    if (!sel) { setTrajeto(null); return; }
    let vivo = true;
    setCarregando(true);
    fetch(`/rastreamento/trajeto?caminhao=${sel}&dia=${dia}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => vivo && setTrajeto(t))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [sel, dia]);

  useEffect(() => {
    const mod = L.current, grupo = linha.current, m = mapa.current;
    if (!pronto || !mod || !grupo || !m) return;
    grupo.clearLayers();
    if (!trajeto || trajeto.pontos.length < 2) return;
    const cor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C8261B";
    mod.polyline(trajeto.pontos, { color: cor, weight: 4, opacity: 0.85 }).addTo(grupo);
    mod.circleMarker(trajeto.pontos[0], { radius: 6, color: "#fff", weight: 2, fillColor: "#2f7d4f", fillOpacity: 1 }).bindTooltip(`Saída ${hora(trajeto.inicio)}`).addTo(grupo);
    for (const e of trajeto.eventos) {
      mod.circleMarker([e.lat, e.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#b3261e", fillOpacity: 1 })
        .bindTooltip(`${EVENTO[e.tipo] ?? e.tipo} · ${hora(e.hora)} · ${e.velocidadeKmh} km/h`)
        .addTo(grupo);
    }
    // No computador o painel fica à direita, por cima do mapa: deixamos espaço para ele.
    const largo = m.getSize().x > 700;
    m.fitBounds(trajeto.pontos, { paddingTopLeft: [40, 40], paddingBottomRight: [largo ? 380 : 40, 40] });
  }, [trajeto, pronto]);

  const contagem = useMemo(() => {
    const n: Partial<Record<Situacao, number>> = {};
    for (const c of frota) n[c.situacao] = (n[c.situacao] ?? 0) + 1;
    return n;
  }, [frota]);
  const lista = frota.filter((c) => filtro === "todos" || c.situacao === filtro);
  const escolhido = frota.find((c) => c.id === sel) ?? null;

  function escolher(c: CaminhaoMapa) {
    setSel(c.id === sel ? null : c.id);
    if (c.lat != null && c.lng != null && c.id !== sel) mapa.current?.setView([c.lat, c.lng], Math.max(mapa.current.getZoom(), 9));
  }

  return (
    <div className="rastreio">
      <div className="rastreio-mapa">
        <div ref={caixa} className="rastreio-leaflet" />
        {escolhido && (
          <div className="rastreio-painel">
            <div className="rastreio-painel-h">
              <div>
                <b>{escolhido.placa}</b> · {escolhido.modelo}
                <div className="sub">{escolhido.motorista ?? "sem motorista"}{escolhido.rota ? ` · ${escolhido.rota}` : ""}</div>
              </div>
              <button type="button" className="fechar" onClick={() => setSel(null)} aria-label="Fechar">×</button>
            </div>
            <label className="rastreio-dia">
              Trajeto do dia
              <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} />
            </label>
            {carregando ? (
              <p className="sub">Carregando…</p>
            ) : trajeto && trajeto.pontos.length > 1 ? (
              <dl className="rastreio-resumo">
                <div><dt>Rodou</dt><dd>{trajeto.km.toLocaleString("pt-BR")} km</dd></div>
                <div><dt>Velocidade máx.</dt><dd>{trajeto.velocidadeMax} km/h</dd></div>
                <div><dt>Saída · último ponto</dt><dd>{hora(trajeto.inicio)} · {hora(trajeto.fim)}</dd></div>
                <div><dt>Diesel (CAN)</dt><dd>{trajeto.litros != null ? `${trajeto.litros.toLocaleString("pt-BR")} L` : "–"}</dd></div>
                <div className="largo"><dt>Alertas</dt><dd>{trajeto.eventos.length ? trajeto.eventos.map((e) => `${EVENTO[e.tipo] ?? e.tipo} ${hora(e.hora)}`).join(" · ") : "nenhum"}</dd></div>
              </dl>
            ) : (
              <p className="sub">Nenhum trajeto registrado neste dia.</p>
            )}
          </div>
        )}
      </div>

      <div className="rastreio-lista card">
        <div className="filtros" role="group" aria-label="Filtrar por situação">
          <button type="button" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos {frota.length}</button>
          {(Object.keys(ROTULO) as Situacao[]).filter((s) => contagem[s]).map((s) => (
            <button key={s} type="button" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>
              <i className={`ponto ponto-${s}`} /> {ROTULO[s]} {contagem[s]}
            </button>
          ))}
        </div>
        <ul>
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" className={c.id === sel ? "ativo" : ""} onClick={() => escolher(c)} disabled={c.lat == null}>
                <i className={`ponto ponto-${c.situacao}`} />
                <span className="rastreio-item">
                  <b>{c.placa}{c.demo && <span className="tag-demo">demonstração</span>}</b>
                  <small>{c.motorista ?? "sem motorista"} · {ROTULO[c.situacao]}{c.situacao === "movimento" ? ` · ${c.velocidadeKmh} km/h` : ""}</small>
                </span>
                <small className="quando">{c.situacao === "sem-rastreador" ? "" : quando(c.atualizadoEm)}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
