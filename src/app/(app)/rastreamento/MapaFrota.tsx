"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaminhaoMapa, ResumoCaminhao, Situacao, Trajeto } from "@/lib/rastreio/dados";

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
  const marcas = useRef<Leaflet.LayerGroup | null>(null);
  const linha = useRef<Leaflet.LayerGroup | null>(null);
  const [pronto, setPronto] = useState(false);
  const [zoom, setZoom] = useState(0);

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
      m.on("zoomend", () => setZoom(m.getZoom()));
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
      const r = await fetch(todos ? "/rastreamento/frota?todos=1" : "/rastreamento/frota", { cache: "no-store" }).catch(() => null);
      if (r?.ok) setFrota(await r.json());
    }, ATUALIZAR_MS);
    return () => clearInterval(id);
  }, [todos]);

  // Marcadores dos caminhões.
  useEffect(() => {
    const mod = L.current, grupo = marcas.current;
    if (!pronto || !mod || !grupo) return;
    grupo.clearLayers();
    // Com muitos caminhões, só o ponto colorido; a placa aparece ao passar o mouse e no escolhido.
    const visiveis = frota.filter((c) => filtro === "todos" || c.situacao === filtro);
    const compacto = visiveis.filter((c) => c.lat != null).length > 30;
    const m = mapa.current!;
    const marcar = (c: CaminhaoMapa) => {
      const comPlaca = !compacto || c.id === sel;
      const icone = mod.divIcon({
        className: "",
        html: `<div class="mk mk-${c.situacao}${c.id === sel ? " mk-sel" : ""}${c.wialon ? " mk-wialon" : ""}${comPlaca ? "" : " mk-ponto"}"><i></i>${comPlaca ? esc(c.placa) : ""}</div>`,
        iconSize: undefined,
        iconAnchor: [10, 12],
      });
      mod.marker([c.lat!, c.lng!], { icon: icone, title: todos ? `${c.placa} · ${c.cliente}` : c.placa, zIndexOffset: c.id === sel ? 1000 : 0 })
        .on("click", () => setSel(c.id))
        .addTo(grupo);
    };

    // Caminhões a menos de ~28 px um do outro (ex.: parados no mesmo pátio) viram um grupo com a contagem.
    const grupos: { x: number; y: number; itens: CaminhaoMapa[] }[] = [];
    for (const c of visiveis) {
      if (c.lat == null || c.lng == null) continue;
      if (c.id === sel) { marcar(c); continue; }
      const p = m.project([c.lat, c.lng], m.getZoom());
      const g = grupos.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 28);
      if (g) g.itens.push(c);
      else grupos.push({ x: p.x, y: p.y, itens: [c] });
    }
    for (const g of grupos) {
      if (g.itens.length === 1) { marcar(g.itens[0]); continue; }
      const sit = g.itens.every((c) => c.situacao === g.itens[0].situacao) ? g.itens[0].situacao : "misto";
      const icone = mod.divIcon({ className: "", html: `<div class="mk mk-grupo mk-${sit}"><i></i>${g.itens.length}</div>`, iconSize: undefined, iconAnchor: [14, 13] });
      const pts = g.itens.map((c) => [c.lat!, c.lng!] as [number, number]);
      const lista = document.createElement("div");
      lista.className = "mk-lista";
      const titulo = document.createElement("b");
      titulo.textContent = `${g.itens.length} caminhões aqui`;
      lista.append(titulo);
      for (const c of g.itens) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `${c.placa} · ${ROTULO[c.situacao]}${todos ? ` · ${c.cliente}` : ""}`;
        b.onclick = () => { m.closePopup(); setSel(c.id); };
        lista.append(b);
      }
      const marca = mod.marker(pts[0], { icon: icone, title: `${g.itens.length} caminhões`, zIndexOffset: 500 }).addTo(grupo);
      const b = mod.latLngBounds(pts);
      const mesmoLugar = m.project(b.getNorthEast(), 16).distanceTo(m.project(b.getSouthWest(), 16)) < 28;
      // Afastados: aproxima o mapa. No mesmo lugar: mostra a lista de placas para escolher.
      if (mesmoLugar || m.getZoom() >= 15) marca.bindPopup(lista, { maxHeight: 260 });
      else marca.on("click", () => m.fitBounds(b, { padding: [60, 60], maxZoom: 16 }));
    }
  }, [frota, sel, pronto, todos, filtro, zoom]);

  // Ao trocar o filtro, o mapa enquadra só os caminhões daquela situação.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m) return;
    const pts = frota.filter((c) => c.lat != null && (filtro === "todos" || c.situacao === filtro)).map((c) => [c.lat!, c.lng!] as [number, number]);
    if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
    setSel((atual) => (atual && frota.some((c) => c.id === atual && (filtro === "todos" || c.situacao === filtro)) ? atual : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, pronto]);

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
    m.fitBounds(trajeto.pontos, { padding: [40, 40] });
  }, [trajeto, pronto]);

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
    if (c.lat != null && c.lng != null && c.id !== sel) mapa.current?.setView([c.lat, c.lng], Math.max(mapa.current.getZoom(), 9));
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
