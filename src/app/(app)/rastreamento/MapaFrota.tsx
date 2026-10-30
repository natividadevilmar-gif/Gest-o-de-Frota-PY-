"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaminhaoMapa, ResumoCaminhao, Situacao, Trajeto } from "@/lib/rastreio/dados";
import { LIMITE_VELOCIDADE_KMH } from "@/lib/telemetria/posicoes";
import { fundosDoMapa, Movimento } from "./mapaBase";
import { FotoLocal } from "./FotoLocal";

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
const COR_TRAJETO = "#00e5ff";

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

/**
 * Caminhão visto de lado (carreta branca, cabine vermelha e a seta verde na frente), como no Wialon,
 * com a frente apontando para onde ele vai: indo para o
 * oeste o desenho é espelhado, para as rodas nunca ficarem para cima.
 */
const caminhao = (graus: number) => {
  const g = ((Math.round(graus) % 360) + 360) % 360;
  const virar = g > 180 ? `rotate(${g - 270}deg) scaleX(-1)` : `rotate(${g - 90}deg)`;
  return `<span class="mk-cam" style="transform:${virar}"><svg viewBox="0 0 46 20" aria-hidden="true">` +
  `<rect class="mk-carreta" x="1" y="2" width="22" height="11" rx="1"/>` +
  `<path class="mk-cabine" d="M24 5h6.5l3.5 4.5V15H24Z"/><path d="M26 6.5h4l2.4 3H26Z" fill="#cfe6f5"/>` +
  `<rect x="1" y="13.5" width="33" height="1.6" fill="#3a403c"/>` +
  `<circle cx="6" cy="16.5" r="2.4"/><circle cx="12" cy="16.5" r="2.4"/><circle cx="29" cy="16.5" r="2.4"/><path class="mk-cam-seta" d="M37 4.5 45.5 10 37 15.5 39 10Z"/></svg></span>`;
};

/** Em movimento, a bolinha vira uma seta apontando para onde o caminhão vai. */
const seta = (graus: number) =>
  `<i class="mk-seta" style="transform:rotate(${Math.round(graus)}deg)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 14 14 8 10.5 2 14Z"/></svg></i>`;

/** O balão do grupo abre ao passar o mouse e fica aberto enquanto o mouse está nele (ou no grupo). */
function abrirAoPassar(marca: Leaflet.Marker) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const fechar = () => { clearTimeout(t); t = setTimeout(() => marca.closePopup(), 350); };
  const manter = () => clearTimeout(t);
  marca.on("mouseover", () => { manter(); marca.openPopup(); });
  marca.on("mouseout", fechar);
  marca.on("popupopen", (e) => {
    const el = (e as Leaflet.PopupEvent).popup.getElement();
    if (!el) return;
    el.onmouseenter = manter;
    el.onmouseleave = fechar;
  });
}

/** Lista do grupo, no estilo do Wialon: situação, placa e motorista, velocidade, ignição e último sinal. */
function listaDoGrupo(itens: CaminhaoMapa[], todos: boolean, abrir: (id: string) => void) {
  const lista = document.createElement("div");
  lista.className = "mk-lista";
  const titulo = document.createElement("b");
  titulo.textContent = `${itens.length} caminhões aqui · clique para abrir`;
  lista.append(titulo);
  const ordem: Record<string, number> = { movimento: 0, parado: 1, "sem-sinal": 2, desligado: 3, aguardando: 4 };
  for (const c of [...itens].sort((a, b) => (ordem[a.situacao] ?? 9) - (ordem[b.situacao] ?? 9) || a.placa.localeCompare(b.placa))) {
    const bt = document.createElement("button");
    bt.type = "button";
    const ligado = c.situacao === "movimento" || c.situacao === "parado";
    bt.innerHTML =
      `<i class="ponto ponto-${c.situacao}"></i>` +
      `<span class="mk-lista-nome"><b>${esc(c.placa)}</b><small>${esc(c.motorista ?? "sem motorista")}${todos ? ` · ${esc(c.cliente)}` : ""}</small></span>` +
      `<span class="mk-lista-vel">${c.situacao === "movimento" ? `${c.velocidadeKmh} km/h` : ROTULO[c.situacao]}</span>` +
      `<span class="mk-lista-ign${ligado ? " on" : ""}" title="Ignição ${ligado ? "ligada" : "desligada"}">⏻</span>` +
      `<small class="mk-lista-quando">${quando(c.atualizadoEm)}</small>`;
    bt.onclick = () => abrir(c.id);
    lista.append(bt);
  }
  return lista;
}

export function MapaFrota({ inicial, hoje, todos = false, outraTela = false }: {
  inicial: CaminhaoMapa[]; hoje: string; todos?: boolean;
  /** Janela própria (só o mapa e a lista), para arrastar a outro monitor. */
  outraTela?: boolean;
}) {
  const [frota, setFrota] = useState(inicial);
  const [sel, setSel] = useState<string | null>(null);
  const [dia, setDia] = useState(hoje);
  const [trajeto, setTrajeto] = useState<(Trajeto & { resumo: ResumoCaminhao | null }) | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Situacao | "todos">("todos");
  const [seguir, setSeguir] = useState(true);

  const caixa = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const soltos = useRef(new Map<string, { marca: Leaflet.Marker; html: string }>());
  const grupos = useRef(new Map<string, { marca: Leaflet.Marker; html: string }>());
  const movimento = useRef(new Movimento());
  const fundo = useRef<ReturnType<typeof fundosDoMapa> | null>(null);
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
      fundo.current = fundosDoMapa(mod, m);
      linha.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      m.on("zoomend", () => setZoom(m.getZoom()));
      const pts = inicial.filter((c) => c.lat != null).map((c) => [c.lat!, c.lng!] as [number, number]);
      if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
      setPronto(true);
    });
    const mov = movimento.current, marcados = soltos.current, agrupados = grupos.current;
    return () => {
      vivo = false;
      mov.parar();
      marcados.clear();
      agrupados.clear();
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
    // Cada caminhão aparece com o ponto (ou a seta, em movimento); os que ficam em cima um do outro
    // viram um grupo com o número. A placa aparece ao passar o mouse e no caminhão escolhido. Com um
    // caminhão escolhido, o mapa mostra só ele e o trajeto dele; ao fechar, os outros voltam.
    const visiveis = frota.filter((c) => (sel ? c.id === sel : filtro === "todos" || c.situacao === filtro));
    const m = mapa.current;
    if (!m) return;
    const marcar = (c: CaminhaoMapa) => {
      const ativo = c.id === sel;
      // O caminhão escolhido aparece como um caminhão visto de cima, virado para onde vai, com a placa embaixo.
      const html = ativo
        ? `<div class="mk-caminhao mk-${c.situacao}">${caminhao(c.direcao)}<b>${esc(c.placa)}</b></div>`
        : `<div class="mk mk-${c.situacao} mk-ponto${c.wialon ? " mk-wialon" : ""}">${c.situacao === "movimento" ? seta(c.direcao) : "<i></i>"}</div>`;
      const icone = () => ativo
        ? mod.divIcon({ className: "", html, iconSize: [120, 52], iconAnchor: [60, 13] })
        : mod.divIcon({ className: "", html, iconSize: undefined, iconAnchor: [10, 12] });
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

    // Caminhões a menos de ~28 px um do outro (ex.: parados no mesmo pátio) viram um grupo com a contagem.
    const juntos: { x: number; y: number; itens: CaminhaoMapa[] }[] = [];
    for (const c of visiveis) {
      if (c.lat == null || c.lng == null) continue;
      if (c.id === sel) { marcar(c); continue; }
      const p = m.project([c.lat, c.lng], m.getZoom());
      const g = juntos.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 28);
      if (g) g.itens.push(c);
      else juntos.push({ x: p.x, y: p.y, itens: [c] });
    }
    const gruposUsados = new Set<string>();
    for (const g of juntos) {
      if (g.itens.length === 1) { marcar(g.itens[0]); continue; }
      const chave = g.itens.map((c) => c.id).sort().join(",");
      gruposUsados.add(chave);
      const sit = g.itens.every((c) => c.situacao === g.itens[0].situacao) ? g.itens[0].situacao : "misto";
      const html = `<div class="mk mk-grupo mk-${sit}${g.itens.some((c) => c.wialon) ? " mk-wialon" : ""}"><i></i>${g.itens.length}</div>`;
      const centro = mod.latLng(g.itens.reduce((a, c) => a + c.lat!, 0) / g.itens.length, g.itens.reduce((a, c) => a + c.lng!, 0) / g.itens.length);
      let gr = grupos.current.get(chave);
      if (!gr) {
        const marca = mod.marker(centro, { icon: mod.divIcon({ className: "", html, iconSize: undefined, iconAnchor: [14, 13] }), zIndexOffset: 500 })
          .bindPopup("", { closeButton: false, autoPan: false, maxHeight: 320, minWidth: 330, className: "mk-popup", offset: [0, -6] })
          .addTo(m);
        abrirAoPassar(marca);
        gr = { marca, html };
        grupos.current.set(chave, gr);
      } else {
        gr.marca.setLatLng(centro);
        if (gr.html !== html) { gr.marca.setIcon(mod.divIcon({ className: "", html, iconSize: undefined, iconAnchor: [14, 13] })); gr.html = html; }
      }
      gr.marca.setPopupContent(listaDoGrupo(g.itens, todos, (id) => { m.closePopup(); setSel(id); }));
    }
    for (const [id, s] of soltos.current) {
      if (usados.has(id)) continue;
      s.marca.remove();
      soltos.current.delete(id);
      movimento.current.esquecer(id);
    }
    for (const [chave, g] of grupos.current) {
      if (gruposUsados.has(chave)) continue;
      g.marca.remove();
      grupos.current.delete(chave);
    }
  }, [frota, sel, pronto, todos, filtro, zoom]);

  // Ao trocar o filtro, o mapa enquadra só os caminhões daquela situação.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m) return;
    const pts = frota.filter((c) => c.lat != null && (filtro === "todos" || c.situacao === filtro)).map((c) => [c.lat!, c.lng!] as [number, number]);
    if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, pronto]);

  /** Tocar num filtro (mesmo o que já está marcado) solta o caminhão escolhido e volta à visão geral. */
  function filtrar(f: Situacao | "todos") {
    setSel(null);
    setFiltro(f);
  }

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
    if (c?.lat != null && c.lng != null) m.flyTo([c.lat, c.lng], 14, { duration: 0.8 });
    setSeguir(true);
    // Arrastar o mapa com o mouse para de acompanhar, para percorrer o trajeto do dia à vontade.
    const soltar = () => setSeguir(false);
    m.on("dragstart", soltar);
    return () => { m.off("dragstart", soltar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, pronto]);

  // Enquanto acompanha (só no dia de hoje), traz o caminhão de volta quando ele chega perto da borda.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m || !sel || !seguir || dia !== hoje) return;
    const id = setInterval(() => {
      const marca = soltos.current.get(sel)?.marca;
      if (marca && !m.getBounds().pad(-0.3).contains(marca.getLatLng())) m.panTo(marca.getLatLng(), { duration: 0.6 });
    }, 1000);
    return () => clearInterval(id);
  }, [sel, pronto, seguir, dia, hoje]);

  function voltarAoCaminhao() {
    const marca = sel ? soltos.current.get(sel)?.marca : null;
    if (marca) mapa.current?.flyTo(marca.getLatLng(), Math.max(mapa.current.getZoom(), 14), { duration: 0.6 });
    setSeguir(true);
  }

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
    // Ciano forte com contorno escuro: aparece bem no satélite e não se confunde com as estradas (laranja).
    // Rota prevista do frete, tracejada por baixo do caminho feito.
    if (trajeto.rotaPrevista?.length) mod.polyline(trajeto.rotaPrevista, { color: "#e0a100", weight: 4, opacity: 0.9, dashArray: "8 8" }).bindTooltip("Rota prevista do frete").addTo(grupo);
    mod.polyline(trajeto.pontos, { color: "#0b1a2a", weight: 7, opacity: 0.7 }).addTo(grupo);
    mod.polyline(trajeto.pontos, { color: COR_TRAJETO, weight: 4, opacity: 1 }).addTo(grupo);
    // A bolinha verde fica onde o caminhão começou a andar, com a hora exata da saída.
    // A bolinha branca marca o primeiro sinal do dia, quando ele vem antes da saída.
    const s = trajeto.saida;
    if (!s || s.hora !== trajeto.inicio) {
      mod.circleMarker(trajeto.pontos[0], { radius: 5, color: "#2f7d4f", weight: 2, fillColor: "#fff", fillOpacity: 1 }).bindTooltip(`Primeiro sinal ${hora(trajeto.inicio)}`).addTo(grupo);
    }
    if (s) mod.circleMarker([s.lat, s.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#2f7d4f", fillOpacity: 1 }).bindTooltip(`Saída ${hora(s.hora)}`).addTo(grupo);
    for (const e of trajeto.eventos) {
      // Ao passar o mouse: o que aconteceu, a hora, a velocidade e o local (buscado na primeira vez).
      const excesso = e.tipo === "excesso";
      const minutos = e.ate ? Math.round((new Date(e.ate).getTime() - new Date(e.hora).getTime()) / 60_000) : 0;
      const corpo = (local: string) =>
        `<b>${EVENTO[e.tipo] ?? e.tipo}</b><br>` +
        (excesso
          ? `${hora(e.hora)}${e.ate && e.ate !== e.hora ? ` até ${hora(e.ate)}${minutos ? ` (${minutos} min)` : ""}` : ""}<br>` +
            `Chegou a <b>${e.maxKmh ?? e.velocidadeKmh} km/h</b> · limite ${LIMITE_VELOCIDADE_KMH} km/h<br>`
          : `${hora(e.hora)} · ${e.velocidadeKmh} km/h<br>`) +
        `Local: ${local}<br><small>${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}</small>`;
      const ponto = mod.circleMarker([e.lat, e.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#b3261e", fillOpacity: 1 })
        .bindTooltip(corpo("buscando…"), { className: "mk-dica" })
        .addTo(grupo);
      let pedido = false;
      ponto.on("tooltipopen", () => {
        if (pedido) return;
        pedido = true;
        fetch(`/rastreamento/local?lat=${e.lat}&lng=${e.lng}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { local: string | null } | null) => ponto.setTooltipContent(corpo(esc(j?.local ?? "não identificado"))))
          .catch(() => ponto.setTooltipContent(corpo("não identificado")));
      });
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
    <div className={outraTela ? "rastreio rastreio-tela" : "rastreio"}>
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
            {escolhido.lat != null && escolhido.lng != null && <FotoLocal lat={escolhido.lat} lng={escolhido.lng} placa={escolhido.placa} />}
            {(!seguir || dia !== hoje) && (
              <button type="button" className="rastreio-voltar" onClick={voltarAoCaminhao}>Voltar ao caminhão</button>
            )}
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
                <div><dt>Primeiro sinal</dt><dd>{hora(trajeto.inicio)}</dd></div>
                <div><dt>Saída · último ponto</dt><dd>{trajeto.saida ? hora(trajeto.saida.hora) : "não saiu"} · {hora(trajeto.fim)}</dd></div>
                <div><dt>Diesel (CAN)</dt><dd>{trajeto.litros != null ? `${numero(trajeto.litros)} L` : "–"}</dd></div>
                <div className="largo"><dt>Alertas</dt><dd>{trajeto.eventos.length ? trajeto.eventos.map((e) => `${EVENTO[e.tipo] ?? e.tipo} ${hora(e.hora)}`).join(" · ") : "nenhum"}</dd></div>
              </dl>
            ) : (
              <p className="sub">Nenhum trajeto registrado neste dia.</p>
            )}
            {!todos && (
              <a className="rastreio-relatorio" href={`/telemetria?de=${dia}&ate=${dia}`} target={outraTela ? "_blank" : undefined}>
                Telemetria do dia: diesel, km/l, tanque e horas de motor
              </a>
            )}
          </div>
        )}
      </div>

      <div className="rastreio-lista card">
        {!outraTela && (
          <button
            type="button"
            className="rastreio-outra-tela"
            title="Abre o mapa numa janela própria, para arrastar ao outro monitor"
            onClick={() => window.open(`/mapa-tela${todos ? "?todos=1" : ""}`, "kmcero-mapa-vivo", "popup,width=1280,height=800")}
          >
            <b aria-hidden="true">⧉</b> Ver em outra tela
          </button>
        )}
        <div className="filtros" role="group" aria-label="Filtrar por situação">
          <button type="button" aria-pressed={filtro === "todos"} onClick={() => filtrar("todos")}>Todos {frota.length}</button>
          {(Object.keys(ROTULO) as Situacao[]).filter((s) => contagem[s]).map((s) => (
            <button key={s} type="button" aria-pressed={filtro === s} onClick={() => filtrar(s)}>
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
