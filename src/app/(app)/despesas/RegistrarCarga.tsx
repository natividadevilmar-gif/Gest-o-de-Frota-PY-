"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_VIDEO_BYTES, MAX_VIDEO_S } from "@/lib/registroCarga";

type Props = { caminhoes: { id: string; placa: string }[]; idioma: "pt" | "es" };
type Pronto = { tipo: "foto" | "video"; blob: Blob; url: string; duracaoS?: number };
type Gps = { lat: number; lng: number; precisaoM: number };

const T = {
  pt: {
    caminhao: "Caminhão", foto: "📷 Tirar foto", video: `🎥 Gravar vídeo (até ${MAX_VIDEO_S} s)`, gravar: "● Gravar", parar: "■ Parar",
    cancelar: "Cancelar", enviar: "Enviar", refazer: "Refazer", obs: "Observação (opcional)", obsPh: "Ex.: lona amarrada, 31 t de soja",
    enviando: "Enviando…", salvo: "Salvo no servidor em", semCamera: "Não deu para abrir a câmera aqui. Abra o site no Chrome ou no Safari e permita a câmera.",
    grande: "O vídeo ficou grande demais. Grave mais curto.", erro: "Não foi possível enviar. Confira a internet e tente de novo.", gps: "com local", preparando: "Pegando o local e a hora…",
  },
  es: {
    caminhao: "Camión", foto: "📷 Sacar foto", video: `🎥 Grabar video (hasta ${MAX_VIDEO_S} s)`, gravar: "● Grabar", parar: "■ Parar",
    cancelar: "Cancelar", enviar: "Enviar", refazer: "Rehacer", obs: "Observación (opcional)", obsPh: "Ej.: lona atada, 31 t de soja",
    enviando: "Enviando…", salvo: "Guardado en el servidor el", semCamera: "No se pudo abrir la cámara aquí. Abra el sitio en Chrome o Safari y permita la cámara.",
    grande: "El video quedó muy grande. Grabe más corto.", erro: "No se pudo enviar. Revise internet e intente de nuevo.", gps: "con ubicación", preparando: "Tomando la ubicación y la hora…",
  },
};

/** Diferença entre o relógio do servidor e o do celular, para o carimbo não depender da hora do aparelho. */
async function diferencaRelogio(): Promise<number> {
  try {
    const antes = Date.now();
    const r = await fetch("/carga/enviar", { method: "HEAD", cache: "no-store" });
    const data = Date.parse(r.headers.get("date") ?? "");
    return Number.isFinite(data) ? data + 500 - Math.round((antes + Date.now()) / 2) : 0;
  } catch {
    return 0;
  }
}

/** Texto do carimbo: data e hora (do Paraguai), coordenadas e caminhão. */
function linhasCarimbo(agora: number, local: Gps | null, placa: string, idioma: "pt" | "es"): string[] {
  const hora = new Date(agora).toLocaleString(idioma === "es" ? "es-PY" : "pt-BR", {
    timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return [
    `${hora} (PY)`,
    local ? `${local.lat.toFixed(5)}, ${local.lng.toFixed(5)} ±${Math.round(local.precisaoM)} m` : idioma === "es" ? "sin GPS" : "sem GPS",
    `${placa} · KM Cero`,
  ];
}

/** Escreve o carimbo no canto de baixo da imagem, em faixa escura para ler em qualquer fundo. */
function desenharCarimbo(ctx: CanvasRenderingContext2D, w: number, h: number, linhas: string[]) {
  const fonte = Math.max(14, Math.round(Math.min(w, h) * 0.035));
  ctx.font = `600 ${fonte}px system-ui, sans-serif`;
  const pad = Math.round(fonte * 0.5);
  const alturaLinha = Math.round(fonte * 1.25);
  const largura = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + pad * 2;
  const altura = alturaLinha * linhas.length + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, h - altura, largura, altura);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  linhas.forEach((l, i) => ctx.fillText(l, pad, h - altura + pad + i * alturaLinha));
}

/** Foto reduzida no celular (1600 px no lado maior, JPEG ~300 KB) já com o carimbo. */
async function reduzirFoto(arquivo: File, linhas: string[]): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  desenharCarimbo(ctx, canvas.width, canvas.height, linhas);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("foto"))), "image/jpeg", 0.82));
}

/** MP4 toca em qualquer celular; WebM fica para os Android que não gravam MP4. */
function formatoDeGravacao(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm"].find((f) => MediaRecorder.isTypeSupported(f));
}

function pegarGps(): Promise<Gps | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisaoM: p.coords.accuracy }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export function RegistrarCarga({ caminhoes, idioma }: Props) {
  const t = T[idioma];
  const [caminhaoId, setCaminhaoId] = useState(caminhoes[0]?.id ?? "");
  const [obs, setObs] = useState("");
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [aoVivo, setAoVivo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const gps = useRef<Promise<Gps | null> | null>(null);
  const relogio = useRef<Promise<number> | null>(null);
  const [preparando, setPreparando] = useState(false);
  const placa = caminhoes.find((c) => c.id === caminhaoId)?.placa ?? "";
  const camera = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const inicio = useRef(0);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputVideo = useRef<HTMLInputElement>(null);

  const fecharCamera = () => {
    fluxo.current?.getTracks().forEach((x) => x.stop());
    fluxo.current = null;
    setAoVivo(false);
  };
  useEffect(() => () => fecharCamera(), []);
  useEffect(() => () => { if (pronto) URL.revokeObjectURL(pronto.url); }, [pronto]);

  // O contador para o vídeo sozinho no limite de segundos.
  useEffect(() => {
    if (!gravando) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - inicio.current) / 1000);
      setSegundos(s);
      if (s >= MAX_VIDEO_S) gravador.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [gravando]);

  const comecar = () => {
    setMsg(null);
    setPronto(null);
    gps.current = pegarGps();
    relogio.current ??= diferencaRelogio();
  };

  async function escolheuFoto(f: File | undefined) {
    if (!f) return;
    comecar();
    setPreparando(true);
    try {
      const [local, dif] = await Promise.all([gps.current, relogio.current]);
      const blob = await reduzirFoto(f, linhasCarimbo(Date.now() + (dif ?? 0), local ?? null, placa, idioma));
      setPronto({ tipo: "foto", blob, url: URL.createObjectURL(blob) });
    } catch {
      setMsg({ ok: false, texto: t.erro });
    } finally {
      setPreparando(false);
    }
  }

  function escolheuVideo(f: File | undefined) {
    if (!f) return;
    comecar();
    if (f.size > MAX_VIDEO_BYTES) return setMsg({ ok: false, texto: t.grande });
    setPronto({ tipo: "video", blob: f, url: URL.createObjectURL(f) });
  }

  async function abrirCamera() {
    comecar();
    const formato = formatoDeGravacao();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      // Sem gravação no navegador: usa a câmera do próprio celular.
      inputVideo.current?.click();
      return;
    }
    try {
      fluxo.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 960 }, height: { ideal: 540 } },
        audio: true,
      });
      setAoVivo(true);
      requestAnimationFrame(() => {
        if (camera.current) {
          camera.current.srcObject = fluxo.current;
          void camera.current.play();
        }
      });
    } catch {
      fecharCamera();
      setMsg({ ok: false, texto: t.semCamera });
    }
  }

  async function gravar() {
    const formato = formatoDeGravacao();
    const cam = camera.current;
    if (!fluxo.current || !formato || !cam) return;
    const [local, dif] = await Promise.all([gps.current, relogio.current]);
    // Grava a imagem da câmera passada por um canvas, com o carimbo de data, hora e local por cima.
    let saida: MediaStream = fluxo.current;
    let parar = () => {};
    const canvas = document.createElement("canvas");
    if (typeof canvas.captureStream === "function" && cam.videoWidth) {
      canvas.width = cam.videoWidth;
      canvas.height = cam.videoHeight;
      const ctx = canvas.getContext("2d")!;
      let quadro = 0;
      const desenhar = () => {
        ctx.drawImage(cam, 0, 0, canvas.width, canvas.height);
        desenharCarimbo(ctx, canvas.width, canvas.height, linhasCarimbo(Date.now() + (dif ?? 0), local ?? null, placa, idioma));
        quadro = requestAnimationFrame(desenhar);
      };
      desenhar();
      saida = new MediaStream([...canvas.captureStream(25).getVideoTracks(), ...fluxo.current.getAudioTracks()]);
      parar = () => cancelAnimationFrame(quadro);
    }
    const partes: Blob[] = [];
    const rec = new MediaRecorder(saida, { mimeType: formato, videoBitsPerSecond: 900_000, audioBitsPerSecond: 48_000 });
    rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    rec.onstop = () => {
      parar();
      setGravando(false);
      const dur = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
      const blob = new Blob(partes, { type: formato.split(";")[0] });
      fecharCamera();
      if (blob.size > MAX_VIDEO_BYTES) return setMsg({ ok: false, texto: t.grande });
      setPronto({ tipo: "video", blob, url: URL.createObjectURL(blob), duracaoS: Math.min(dur, MAX_VIDEO_S) });
    };
    gravador.current = rec;
    inicio.current = Date.now();
    setSegundos(0);
    rec.start(1000);
    setGravando(true);
  }

  async function enviar() {
    if (!pronto) return;
    setEnviando(true);
    setMsg(null);
    try {
      const local = await (gps.current ?? Promise.resolve(null));
      const fd = new FormData();
      fd.set("tipo", pronto.tipo);
      fd.set("caminhaoId", caminhaoId);
      fd.set("observacao", obs);
      fd.set("arquivo", pronto.blob, pronto.tipo === "foto" ? "carga.jpg" : "carga");
      if (pronto.duracaoS) fd.set("duracaoS", String(pronto.duracaoS));
      if (local) {
        fd.set("lat", String(local.lat));
        fd.set("lng", String(local.lng));
        fd.set("precisaoM", String(local.precisaoM));
      }
      const resp = await fetch("/carga/enviar", { method: "POST", body: fd });
      const r = (await resp.json().catch(() => null)) as { ok: boolean; erro?: string; criadoEm?: string } | null;
      if (!r?.ok) {
        setMsg({ ok: false, texto: r?.erro ?? t.erro });
      } else {
        const quando = new Date(r.criadoEm!).toLocaleString(idioma === "es" ? "es-PY" : "pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setMsg({ ok: true, texto: `✓ ${t.salvo} ${quando}${local ? ` · ${t.gps}` : ""}` });
        setPronto(null);
        setObs("");
      }
    } catch {
      setMsg({ ok: false, texto: t.erro });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="registro-carga">
      {caminhoes.length > 1 && (
        <label>
          {t.caminhao}
          <select value={caminhaoId} onChange={(e) => setCaminhaoId(e.target.value)}>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
      )}

      {preparando && <p className="note">{t.preparando}</p>}
      {!aoVivo && !pronto && !preparando && (
        <div className="registro-botoes">
          <button type="button" className="pri" onClick={() => inputFoto.current?.click()}>{t.foto}</button>
          <button type="button" className="pri" onClick={abrirCamera}>{t.video}</button>
        </div>
      )}
      <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void escolheuFoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={inputVideo} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { escolheuVideo(e.target.files?.[0]); e.target.value = ""; }} />

      {aoVivo && (
        <div className="registro-camera">
          <video ref={camera} muted playsInline />
          {gravando && <span className="registro-tempo">● {segundos}s / {MAX_VIDEO_S}s</span>}
          <div className="registro-botoes">
            {gravando ? (
              <button type="button" className="pri" onClick={() => gravador.current?.stop()}>{t.parar}</button>
            ) : (
              <>
                <button type="button" className="pri" onClick={() => void gravar()}>{t.gravar}</button>
                <button type="button" onClick={fecharCamera}>{t.cancelar}</button>
              </>
            )}
          </div>
        </div>
      )}

      {pronto && (
        <div className="registro-previa">
          {pronto.tipo === "foto" ? <img src={pronto.url} alt="" /> : <video src={pronto.url} controls playsInline />}
          <label>
            {t.obs}
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t.obsPh} maxLength={300} />
          </label>
          <div className="registro-botoes">
            <button type="button" className="pri" onClick={enviar} disabled={enviando}>{enviando ? t.enviando : t.enviar}</button>
            <button type="button" onClick={() => setPronto(null)} disabled={enviando}>{t.refazer}</button>
          </div>
        </div>
      )}

      {msg && <p className={`msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.texto}</p>}
    </div>
  );
}
