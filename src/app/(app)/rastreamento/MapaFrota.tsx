"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaminhaoMapa, ResumoCaminhao, Situacao, Trajeto } from "@/lib/rastreio/dados";
import { fundosDoMapa, Movimento } from "./mapaBase";

const ROTULO: Record<Situacao, string> = {
  movimento: "Em movimento",
  parado: "Parado ligado",
  desligado: "Desligado",
  "sem-sinal": "Sem sinal",
  aguardando: "Aguardando 1º sinal",
  "sem-rastreador": "Sem rastreador",
};
const EVENTO: Record<string, string> = { freada: "Freada brusca", aceleracao: "Aceleração brusca", curva: "Curva brusca", excesso: "Excesso de velocidade" };
const ATUALIZAR_MS = 15_000;

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
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

/** Em movimento, a bolinha vira uma seta apontando para onde o caminhão vai. */
const seta = (graus: number) =>
  `<i class="mk-seta" style="transform:rotate(${Math.round(graus)}deg)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 14 14 8 10.5 2 14Z"/></svg></i>`;

export function MapaFrota({ inicial, hoje, todos = false }: { inicial: CaminhaoMapa[]; hoje: string; todos?: boolean }) {
  const [frota, setFrota] = useState(inicial);
  const [sel, setSel] = useState<string | null>(null);
  const [dia, setDia] = useState(hoje);
  const [trajeto, setTrajeto] = useState<(Trajeto & { resumo: ResumoCaminhao | null }) | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Situacao | "todos">("todos");

  const caixa = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const soltos = useRef(new Map<string, { marca: Leaflet.Marker; html: string }>());
  const movimento = useRef(new Movimento());
  const fundo = useRef<ReturnType<typeof fundosDoMapa> | null>(null);
  const linha = useRef<Leaflet.LayerGroup | null>(null);
  const [pronto, setPronto] = useState(false);

  // Cria o mapa uma vez (o Leaflet só roda no navegador).
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !caixa.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(caixa.current, { zoomControl: true }).setView([-25.5, -56.5], 7);
      fundo.current = fundosDoMapa(mod, m);
      linha.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      const pts = inicial.filter((c) => c.lat != null).map((c) => [c.lat!, c.lng!] as [number, number]);
      if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
      setPronto(true);
    });
    const mov = movimento.current, marcados = soltos.current;
    return () => {
      vivo = false;
      mov.parar();
      marcados.clear();
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [inicial]);

  // Atualiza as posições a cada 15 segundos.
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await fetch(todos ? "/rastreamento/frota?todos=1" : "/rastreamento/frota", { cache: "no-store" }).catch(() => null);
      if (r?.ok) setFrota(await r.json());
    }, ATUALIZAR_MS);
    return () => clearInterval(id);
  }, [todos]);

  // Marcadores dos caminhões.
  useEffect(() => {
    const mod = L.current;
    if (!pronto || !mod) return;
    // Os marcadores ficam no mapa entre uma atualização e outra, para andarem até a posição nova.
    const usados = new Set<string>();
    // Cada caminhão aparece separado, só com o ponto (ou a seta, em movimento). A placa aparece
    // ao passar o mouse e no caminhão escolhido. Com um caminhão escolhido, o mapa mostra só ele
    // e o trajeto dele; ao fechar, os outros voltam.
    const visiveis = frota.filter((c) => (sel ? c.id === sel : filtro === "todos" || c.situacao === filtro));
    const m = mapa.current;
    if (!m) return;
    const marcar = (c: CaminhaoMapa) => {
      const ativo = c.id === sel;
      const html = `<div class="mk mk-${c.situacao}${ativo ? " mk-sel" : " mk-ponto"}${c.wialon ? " mk-wialon" : ""}">${c.situacao === "movimento" ? seta(c.direcao) : "<i></i>"}${ativo ? esc(c.placa) : ""}</div>`;
      const icone = () => mod.divIcon({ className: "", html, iconSize: undefined, iconAnchor: [10, 12] });
      usados.add(c.id);
      // Ao passar o mouse: placa, modelo, motorista e situação.
      const dica = `<b>${esc(c.placa)}</b> · ${esc(c.modelo)}<br>${esc(c.motorista ?? "sem motorista")}${todos ? ` · ${esc(c.cliente)}` : ""}<br>${ROTULO[c.situacao]}${c.situacao === "movimento" ? ` · ${c.velocidadeKmh} km/h` : ""}`;
      let s = soltos.current.get(c.id);
      if (!s) {
        const marca = mod.marker([c.lat!, c.lng!], { icon: icone() })
          .bindTooltip(dica, { direction: "top", offset: [0, -10], className: "mk-dica" })
          .on("click", () => setSel(c.id))
          .addTo(m);
        s = { marca, html };
        soltos.current.set(c.id, s);
      } else {
        if (s.html !== html) {
          s.marca.setIcon(icone());
          s.html = html;
        }
        s.marca.setTooltipContent(dica);
      }
      s.marca.setZIndexOffset(c.id === sel ? 1000 : 0);
      movimento.current.ir(c.id, s.marca, [c.lat!, c.lng!], c.atualizadoEm);
    };

    for (const c of visiveis) if (c.lat != null && c.lng != null) marcar(c);
    for (const [id, s] of soltos.current) {
      if (usados.has(id)) continue;
      s.marca.remove();
      soltos.current.delete(id);
      movimento.current.esquecer(id);
    }
  }, [frota, sel, pronto, todos, filtro]);

  // Ao trocar o filtro, o mapa enquadra só os caminhões daquela situação.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m) return;
    const pts = frota.filter((c) => c.lat != null && (filtro === "todos" || c.situacao === filtro)).map((c) => [c.lat!, c.lng!] as [number, number]);
    if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
    setSel((atual) => (atual && frota.some((c) => c.id === atual && (filtro === "todos" || c.situacao === filtro)) ? atual : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, pronto]);

  // Visão geral no mapa de ruas. Ao escolher um caminhão, o mapa aproxima nele em satélite e vai acompanhando.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m) return;
    if (!sel) {
      fundo.current?.usar("ruas");
      const pts = frota.filter((c) => c.lat != null && (filtro === "todos" || c.situacao === filtro)).map((c) => [c.lat!, c.lng!] as [number, number]);
      if (pts.length) m.flyToBounds(pts, { padding: [40, 40], maxZoom: 10, duration: 0.8 });
      return;
    }
    const c = frota.find((x) => x.id === sel);
    fundo.current?.usar("satelite");
    if (c?.lat != null && c.lng != null) m.flyTo([c.lat, c.lng], 17, { duration: 0.8 });
    const id = setInterval(() => {
      const marca = soltos.current.get(sel)?.marca;
      if (marca && !m.getBounds().pad(-0.3).contains(marca.getLatLng())) m.panTo(marca.getLatLng(), { duration: 0.6 });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, pronto]);

  // Trajeto do caminhão escolhido no dia escolhido.
  useEffect(() => {
    if (!sel) { setTrajeto(null); return; }
    let vivo = true;
    // Tira na hora o trajeto do caminhão anterior.
    setTrajeto(null);
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
    // Hoje o mapa fica no caminhão; num dia anterior, mostra o trajeto inteiro.
    if (dia !== hoje) m.fitBounds(trajeto.pontos, { padding: [40, 40] });
  }, [trajeto, pronto, dia, hoje]);

  const contagem = useMemo(() => {
    const n: Partial<Record<Situacao, number>> = {};
    for (const c of frota) n[c.situacao] = (n[c.situacao] ?? 0) + 1;
    return n;
  }, [frota]);
  const lista = frota.filter((c) => filtro === "todos" || c.situacao === filtro);
  const escolhido = frota.find((c) => c.id === sel) ?? null;
  const r = trajeto?.resumo ?? null;
  const rpm = escolhido?.rpm ?? r?.rpm ?? null;

  function escolher(c: CaminhaoMapa) {
    setSel(c.id === sel ? null : c.id);
  }

  return (
    <div className="rastreio">
      <div className="rastreio-mapa">
        <div ref={caixa} className="rastreio-leaflet" />
        {escolhido && (
          <div className="rastreio-painel card">
            <div className="rastreio-painel-h">
              <div>
                <div className="rastreio-titulo">
                  <span className="plate">{escolhido.placa}</span> <b>{escolhido.modelo}</b>
                  <span className={`pill sit-${escolhido.situacao}`}>{ROTULO[escolhido.situacao]}</span>
                  {escolhido.bloqueado && <a className="pill bad" href={`/comandos?caminhao=${escolhido.id}`}>Motor bloqueado</a>}
                </div>
                <div className="sub">
                  {todos ? `${escolhido.cliente} · ` : ""}{escolhido.motorista ?? "sem motorista"}
                  {escolhido.local ? ` · ${escolhido.local}` : escolhido.rota ? ` · ${escolhido.rota}` : ""}
                </div>
              </div>
              <button type="button" className="fechar" onClick={() => setSel(null)} aria-label="Fechar">×</button>
            </div>
            <dl className="rastreio-agora">
              <div><dt>Velocidade</dt><dd>{escolhido.velocidadeKmh} km/h</dd></div>
              <div><dt>Odômetro</dt><dd>{r ? numero(r.odometroKm) : "…"}</dd></div>
              <div><dt>km no mês</dt><dd>{r ? numero(r.kmMes) : "…"}</dd></div>
              <div><dt>Consumo CAN</dt><dd>{r ? (r.kmL != null ? `${numero(r.kmL, 2)} km/l` : "sem CAN") : "…"}</dd></div>
              <div><dt>RPM agora</dt><dd>{rpm != null ? numero(rpm) : "–"}</dd></div>
              <div><dt>Custo por km</dt><dd>{r ? (r.custoKm != null ? `USD ${numero(r.custoKm, 2)}` : "–") : "…"}</dd></div>
            </dl>
            <label className="rastreio-dia">
              Trajeto do dia
              <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} />
            </label>
            {carregando && !trajeto ? (
              <p className="sub">Carregando…</p>
            ) : trajeto && trajeto.pontos.length > 1 ? (
              <dl className="rastreio-resumo">
                <div><dt>Rodou</dt><dd>{numero(trajeto.km)} km</dd></div>
                <div><dt>Velocidade máx.</dt><dd>{trajeto.velocidadeMax} km/h</dd></div>
                <div><dt>Saída · último ponto</dt><dd>{hora(trajeto.inicio)} · {hora(trajeto.fim)}</dd></div>
                <div><dt>Diesel (CAN)</dt><dd>{trajeto.litros != null ? `${numero(trajeto.litros)} L` : "–"}</dd></div>
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
                  <b>{c.placa}{c.demo && <span className="tag-demo">demonstração</span>}{c.wialon && <span className="tag-demo tag-wialon" title="Posições trazidas do Wialon">Wialon</span>}</b>
                  <small>{todos ? `${c.cliente} · ` : ""}{c.motorista ?? "sem motorista"} · {ROTULO[c.situacao]}</small>
                </span>
                <span className="quando">
                  {c.situacao === "movimento" && <b>{c.velocidadeKmh} km/h</b>}
                  <small>{c.situacao === "sem-rastreador" ? "" : quando(c.atualizadoEm)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
