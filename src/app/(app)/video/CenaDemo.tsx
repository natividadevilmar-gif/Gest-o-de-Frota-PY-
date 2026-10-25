"use client";

import { useEffect, useRef, useState } from "react";
import type { MidiaVista } from "@/lib/video";

// Cena desenhada para as mídias de demonstração (não há arquivo de câmera):
// estrada vista pela câmera frontal ou a cabine em infravermelho, com as marcas
// que a câmera grava por cima (data, velocidade, placa, coordenadas).

const W = 640, H = 360;

function aleatorio(semente: string) {
  let h = 2166136261;
  for (const ch of semente) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const EVENTO: Record<string, string> = {
  freada: "FREADA BRUSCA", aceleracao: "ACELERACAO BRUSCA", curva: "CURVA BRUSCA", excesso: "EXCESSO DE VELOCIDADE", colisao: "IMPACTO", panico: "PANICO",
};

type Cena = Pick<MidiaVista, "id" | "camera" | "gatilho" | "data" | "velocidadeKmh" | "placa" | "lat" | "lng" | "tipo" | "duracaoS">;

function desenhar(ctx: CanvasRenderingContext2D, m: Cena, t: number) {
  const r = aleatorio(m.id);
  // Pedido pela central: os últimos segundos até o pedido. Evento: o momento fica a 60% do vídeo.
  const quando = new Date(new Date(m.data).getTime() - (m.duracaoS ?? 0) * 1000 * (m.gatilho === "pedido" ? 1 : 0.6) + t * 1000);
  const horaPy = (quando.getUTCHours() + 21) % 24;
  const noite = horaPy < 6 || horaPy >= 19;
  const dur = m.duracaoS ?? 10;
  const momento = dur * 0.6; // o evento acontece a 60% do vídeo
  const base = m.velocidadeKmh ?? 60;
  let vel = base;
  if (m.gatilho === "freada") vel = t < momento ? base : Math.max(base - 38, Math.round(base - (t - momento) * 30));
  if (m.gatilho === "aceleracao") vel = t < momento ? Math.max(10, base - 25) : Math.min(base, Math.round(base - 25 + (t - momento) * 20));
  const tremor = (m.gatilho === "freada" || m.gatilho === "colisao") && Math.abs(t - momento) < 0.5 ? Math.sin(t * 90) * 4 : 0;

  ctx.save();
  ctx.translate(0, tremor);
  if (m.camera === "cabine") cabine(ctx, r, t, noite);
  else estrada(ctx, r, t, vel, noite, m.gatilho, t - momento);
  ctx.restore();

  // Marcas da câmera.
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillRect(0, 0, W, 26);
  ctx.fillRect(0, H - 26, W, 26);
  ctx.font = "600 13px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(`KM CERO · CAM ${m.camera === "cabine" ? "2 CABINE" : "1 ESTRADA"}`, 10, 13);
  const dataTxt = quando.toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  ctx.textAlign = "right";
  ctx.fillText(dataTxt, W - 10, 13);
  ctx.fillText(m.lat != null && m.lng != null ? `${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : "", W - 10, H - 13);
  ctx.textAlign = "left";
  ctx.fillText(`${m.placa} · ${vel} km/h`, 10, H - 13);
  if (EVENTO[m.gatilho] && (m.tipo === "foto" || t >= momento - 0.3)) {
    ctx.fillStyle = "#c8261b";
    const txt = EVENTO[m.gatilho];
    const w = ctx.measureText(txt).width + 20;
    ctx.fillRect(W / 2 - w / 2, 34, w, 24);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(txt, W / 2, 46);
    ctx.textAlign = "left";
  }
  if (m.tipo === "video") {
    ctx.fillStyle = "#e53935";
    ctx.beginPath();
    ctx.arc(W - 18, 40, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function estrada(ctx: CanvasRenderingContext2D, r: () => number, t: number, vel: number, noite: boolean, gatilho: string, desdeEvento: number) {
  const hz = H * 0.46;
  const curva = gatilho === "curva" ? Math.sin(Math.min(1, Math.max(0, desdeEvento + 2) / 3) * Math.PI) * 90 : (r() - 0.5) * 40;
  const ceu = ctx.createLinearGradient(0, 0, 0, hz);
  ceu.addColorStop(0, noite ? "#05070d" : "#7fb2e0");
  ceu.addColorStop(1, noite ? "#141a26" : "#d9e8f3");
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, W, hz);
  ctx.fillStyle = noite ? "#0d140d" : "#6f8f4c";
  ctx.fillRect(0, hz, W, H - hz);
  // Linha de árvores no horizonte.
  ctx.fillStyle = noite ? "#090d09" : "#4c6b37";
  for (let x = 0; x < W; x += 14) ctx.fillRect(x, hz - 6 - r() * 10, 14, 16);
  // Pista.
  const fx = W / 2 + curva;
  ctx.fillStyle = noite ? "#1b1d20" : "#55595e";
  ctx.beginPath();
  ctx.moveTo(fx - 8, hz);
  ctx.lineTo(fx + 8, hz);
  ctx.lineTo(W * 0.98, H);
  ctx.lineTo(W * 0.02, H);
  ctx.closePath();
  ctx.fill();
  // Faixas: andam de acordo com a velocidade.
  const andou = (t * vel) / 3.6; // metros
  ctx.fillStyle = noite ? "#d8c66a" : "#f2e6a0";
  for (let i = 0; i < 14; i++) {
    const z = ((i * 12 - (andou % 12)) + 168) % 168 + 4; // distância em metros
    const z2 = z + 5;
    const y1 = hz + (H - hz) * (4 / z), y2 = hz + (H - hz) * (4 / z2);
    if (y1 > H) continue;
    const x1 = fx + (W / 2 - fx) * (4 / z), x2 = fx + (W / 2 - fx) * (4 / z2);
    const w1 = 120 / z, w2 = 120 / z2;
    ctx.beginPath();
    ctx.moveTo(x2 - w2 / 2, y2);
    ctx.lineTo(x2 + w2 / 2, y2);
    ctx.lineTo(x1 + w1 / 2, y1);
    ctx.lineTo(x1 - w1 / 2, y1);
    ctx.fill();
  }
  // Postes na beira da estrada.
  for (let i = 0; i < 6; i++) {
    const z = ((i * 30 - (andou % 30)) + 180) % 180 + 6;
    const k = 4 / z;
    const y = hz + (H - hz) * k;
    const x = fx + (W * 1.1 - fx) * k;
    ctx.fillStyle = noite ? "#2a2d33" : "#d7d9dc";
    ctx.fillRect(x, y - 900 * k * 0.25, Math.max(1, 30 * k), 900 * k * 0.25);
  }
  // Veículo à frente (aproxima na freada).
  const dist = gatilho === "freada" ? Math.max(9, 34 - Math.max(0, desdeEvento + 2.5) * 9) : 46 + Math.sin(t / 2) * 4;
  const k = 4 / dist;
  const cy = hz + (H - hz) * k;
  const cx = fx + (W / 2 - fx) * k;
  const cw = 2600 * k * 0.12, ch = 2200 * k * 0.12;
  ctx.fillStyle = noite ? "#2b2f36" : "#e8e4da";
  ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
  ctx.fillStyle = noite || gatilho === "freada" ? "#ff3b30" : "#a33";
  ctx.fillRect(cx - cw / 2 + 2, cy - ch * 0.3, cw * 0.14, ch * 0.12);
  ctx.fillRect(cx + cw / 2 - 2 - cw * 0.14, cy - ch * 0.3, cw * 0.14, ch * 0.12);
  if (noite) {
    const farol = ctx.createRadialGradient(W / 2, H, 10, W / 2, H, H * 0.9);
    farol.addColorStop(0, "rgba(255,240,190,.35)");
    farol.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = farol;
    ctx.fillRect(0, hz, W, H - hz);
  }
  // Capô.
  ctx.fillStyle = "#101214";
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 40, W * 0.62, 70, 0, Math.PI, 0);
  ctx.fill();
}

function cabine(ctx: CanvasRenderingContext2D, r: () => number, t: number, noite: boolean) {
  // Infravermelho: tons de cinza.
  ctx.fillStyle = noite ? "#2a2a2a" : "#4a4a4a";
  ctx.fillRect(0, 0, W, H);
  // Para-brisa.
  ctx.fillStyle = noite ? "#3c3c3c" : "#9a9a9a";
  ctx.beginPath();
  ctx.moveTo(W * 0.05, 30);
  ctx.lineTo(W * 0.95, 30);
  ctx.lineTo(W * 0.88, H * 0.42);
  ctx.lineTo(W * 0.12, H * 0.42);
  ctx.closePath();
  ctx.fill();
  // Painel.
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, H * 0.42, W, H * 0.12);
  // Motorista (cabeça e ombros), balança levemente.
  const dx = Math.sin(t * 1.3 + r() * 6) * 4;
  const mx = W * 0.32 + dx;
  ctx.fillStyle = "#6e6e6e";
  ctx.beginPath();
  ctx.ellipse(mx, H * 0.92, 120, 80, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#8a8a8a";
  ctx.beginPath();
  ctx.ellipse(mx, H * 0.6, 42, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.ellipse(mx, H * 0.53, 44, 26, 0, Math.PI, 0);
  ctx.fill();
  // Volante.
  ctx.strokeStyle = "#151515";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(W * 0.32, H * 0.86, 110, 60, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Banco do passageiro.
  ctx.fillStyle = "#383838";
  ctx.fillRect(W * 0.68, H * 0.5, 120, H * 0.5);
  // Granulado da câmera.
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
}

/** Quadro parado (foto ou miniatura). */
export function QuadroDemo({ midia, className }: { midia: Cena; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) desenhar(ctx, midia, (midia.duracaoS ?? 0) * 0.62);
  }, [midia]);
  return <canvas ref={ref} width={W} height={H} className={className} aria-label={`Imagem da câmera de ${midia.placa}`} />;
}

/** Vídeo de demonstração: a cena anda pelo tempo da gravação, com play, pausa e barra. */
export function VideoDemo({ midia }: { midia: Cena }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tocando, setTocando] = useState(true);
  const [t, setT] = useState(0);
  const dur = midia.duracaoS ?? 10;
  const tRef = useRef(0);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let antes = performance.now();
    const quadro = (agora: number) => {
      if (tocando) {
        tRef.current = Math.min(dur, tRef.current + (agora - antes) / 1000);
        if (tRef.current >= dur) setTocando(false);
      }
      antes = agora;
      desenhar(ctx, midia, tRef.current);
      setT(tRef.current);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [midia, tocando, dur]);

  return (
    <div className="video-demo">
      <canvas ref={ref} width={W} height={H} aria-label={`Vídeo da câmera de ${midia.placa}`} />
      <div className="video-controles">
        <button type="button" onClick={() => { if (tRef.current >= dur) tRef.current = 0; setTocando(!tocando); }} aria-label={tocando ? "Pausar" : "Tocar"}>
          {tocando ? "❚❚" : "▶"}
        </button>
        <input type="range" min={0} max={dur} step={0.1} value={t} aria-label="Posição do vídeo" onChange={(e) => { tRef.current = Number(e.target.value); setT(tRef.current); }} />
        <small>{t.toFixed(0)}s / {dur}s</small>
      </div>
    </div>
  );
}
