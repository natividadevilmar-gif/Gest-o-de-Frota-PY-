"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { paraUsd, SIMBOLO, type Moeda } from "@/lib/cambio";
import { lerFalaLocal, lerNotaLocal } from "@/lib/falaLocal";
import { num } from "@/lib/formato";
import { TEXTOS, type Lingua } from "@/lib/textosDespesa";
import { lancarDespesa, lerDespesaAction, salvarIdioma, type Leitura } from "./actions";

type Props = {
  caminhoes: { id: string; placa: string }[];
  hoje: string;
  cotacao: { pygPorUsd: number; brlPorUsd: number; arsPorUsd: number; data: string; fonte: string };
  idioma: "pt" | "es";
  leituraAtiva: boolean;
};

// Tipos mínimos da Web Speech API (Chrome/Android e Safari/iOS usam o prefixo webkit).
type Reconhecimento = {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type JanelaComVoz = Window & { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };

const COMBUSTIVEL = ["DIESEL", "ARLA32"];
type Etapa = "valor" | "tipo" | "litros" | "km" | "descricao";
const CASAS: Record<Moeda, number> = { USD: 2, PYG: 0, BRL: 2, ARS: 2 };
const BANDEIRA: Record<Moeda, string> = { PYG: "🇵🇾", USD: "🇺🇸", BRL: "🇧🇷", ARS: "🇦🇷" };
const MOEDAS: Moeda[] = ["PYG", "USD", "BRL", "ARS"];

/** Lê o texto da nota no próprio celular (Tesseract, arquivos servidos em /ocr). */
async function textoDaFoto(dataUrl: string, aoProgredir: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["spa", "por"], 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && aoProgredir(m.progress),
  });
  try {
    return (await worker.recognize(dataUrl)).data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Imagem só para o leitor de texto: maior que a enviada (letra pequena some em 1600 px) e
 * só com o canal vermelho, que apaga a tinta rosa ou vermelha dos formulários e deixa o texto impresso.
 */
async function imagemParaLeitura(arquivo: File): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) px[i + 1] = px[i + 2] = px[i];
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Reduz a foto no próprio celular antes de enviar (recibos de 4 MB viram ~300 KB). */
async function reduzirFoto(arquivo: File): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function LancarDespesa({ caminhoes, hoje, cotacao, idioma, leituraAtiva }: Props) {
  const [r, acao, enviando] = useActionState(lancarDespesa, null);
  const [lingua, setLingua] = useState<Lingua>(idioma);
  const t = TEXTOS[lingua];
  const [lendo, iniciarLeitura] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [resumo, setResumo] = useState(false);
  const [ouvido, setOuvido] = useState<string | null>(null);
  // Assistente de voz: pergunta, uma etapa por vez, o que faltou na primeira frase.
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const fluxo = useRef({ voz: false, tipoDito: false, feitas: new Set<Etapa>() });
  // Tipo escolhido à mão no formulário: vale para as próximas falas e não é perguntado.
  const tipoEscolhido = useRef(false);

  const vazio = {
    caminhaoId: caminhoes[0]?.id ?? "",
    data: hoje,
    categoria: "DIESEL",
    moeda: "PYG" as Moeda,
    valor: "",
    litros: "",
    precoLitro: "",
    posto: "",
    odometroKm: "",
    tanqueCheio: true,
    descricao: "",
  };
  const [f, setF] = useState(vazio);
  const [valorManual, setValorManual] = useState(false);
  const [recibo, setRecibo] = useState<string | null>(null);
  const [origem, setOrigem] = useState<"manual" | "foto" | "audio">("manual");
  // Moeda trocada pela foto ou pela fala: fica destacada até o usuário confirmar tocando nela.
  const [moedaTrocada, setMoedaTrocada] = useState(false);
  const [frase, setFrase] = useState("");

  const set = (campo: keyof typeof vazio, v: string | boolean) => setF((x) => ({ ...x, [campo]: v }));
  const atual = useRef(f);
  atual.current = f;
  const combustivel = COMBUSTIVEL.includes(f.categoria);

  // Litros × preço preenche o valor, até o usuário digitar o valor por conta própria.
  useEffect(() => {
    if (valorManual || !combustivel) return;
    const l = Number(f.litros), p = Number(f.precoLitro);
    if (l > 0 && p > 0) setF((x) => ({ ...x, valor: (l * p).toFixed(CASAS[x.moeda]) }));
  }, [f.litros, f.precoLitro, f.moeda, combustivel, valorManual]);

  // Com litros e total informados, o preço por litro é calculado (não precisa falar nem digitar).
  useEffect(() => {
    if (!valorManual || !combustivel) return;
    const l = Number(f.litros), v = Number(f.valor);
    if (l > 0 && v > 0) setF((x) => ({ ...x, precoLitro: (v / l).toFixed(CASAS[x.moeda]) }));
  }, [f.litros, f.valor, f.moeda, combustivel, valorManual]);

  useEffect(() => {
    if (r?.ok) {
      setF((x) => ({ ...vazio, caminhaoId: x.caminhaoId, data: x.data, moeda: x.moeda, categoria: x.categoria }));
      setValorManual(false);
      setRecibo(null);
      setOrigem("manual");
      setFrase("");
      setResumo(false);
      setOuvido(null);
      setEtapa(null);
      fluxo.current = { voz: false, tipoDito: false, feitas: new Set() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  function aplicar(l: Leitura, de: "foto" | "audio") {
    if (!l.ok) return setAviso(l.msg);
    const c = l.campos;
    if (c.moeda && c.moeda !== atual.current.moeda) setMoedaTrocada(true);
    setF((x) => ({
      ...x,
      caminhaoId: l.caminhaoId ?? x.caminhaoId,
      data: c.data && /^\d{4}-\d{2}-\d{2}$/.test(c.data) ? c.data : x.data,
      // Leitura local sem tipo reconhecido mantém o tipo que o usuário já escolheu.
      categoria: c.categoria === "OUTROS" && !leituraAtiva ? x.categoria : c.categoria,
      moeda: c.moeda ?? x.moeda,
      valor: c.valor ? String(c.valor) : x.valor,
      litros: c.litros ? String(c.litros) : x.litros,
      precoLitro: c.precoLitro ? String(c.precoLitro) : x.precoLitro,
      posto: c.posto ?? x.posto,
      odometroKm: c.odometroKm ? String(Math.round(c.odometroKm)) : x.odometroKm,
      descricao: c.descricao ?? x.descricao,
    }));
    setValorManual(Boolean(c.valor));
    setOrigem(de);
    setAviso(null);
    if (c.categoria !== "OUTROS" || leituraAtiva) fluxo.current.tipoDito = true;
    if (de === "audio" && fluxo.current.voz) {
      // O estado do formulário só atualiza no próximo render; calcula a próxima etapa com os campos novos.
      const x = atual.current;
      seguir({
        valor: c.valor ? String(c.valor) : x.valor,
        categoria: c.categoria === "OUTROS" && !leituraAtiva ? x.categoria : c.categoria,
        litros: c.litros ? String(c.litros) : x.litros,
        odometroKm: c.odometroKm ? String(c.odometroKm) : x.odometroKm,
        descricao: c.descricao ?? x.descricao,
      });
    } else setResumo(true);
  }

  /** Decide a próxima pergunta do assistente de voz, ou mostra o resumo para lançar. */
  function seguir(c: { valor: string; categoria: string; litros: string; odometroKm: string; descricao: string }) {
    const feitas = fluxo.current.feitas;
    const proxima: Etapa | null =
      !(Number(c.valor) > 0) ? "valor"
      : COMBUSTIVEL.includes(c.categoria) && !(Number(c.litros) > 0) && !feitas.has("litros") ? "litros"
      : COMBUSTIVEL.includes(c.categoria) && !c.odometroKm && !feitas.has("km") ? "km"
      : !c.descricao && !feitas.has("descricao") ? "descricao"
      : null;
    if (!proxima) {
      setEtapa(null);
      setResumo(true);
      falarTexto(t.confira);
      return;
    }
    perguntar(proxima);
  }

  function perguntar(e: Etapa, repetir = false) {
    setEtapa(e);
    setResumo(false);
    const texto = (repetir ? `${t.naoEntendi} ` : "") + t.perguntas[e];
    setAviso(null);
    falarTexto(texto, () => ouvir(e));
  }

  /** Fala a pergunta em voz alta (quando o celular permite) e depois começa a ouvir. */
  function falarTexto(texto: string, depois?: () => void) {
    const sintese = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!sintese || typeof SpeechSynthesisUtterance === "undefined") return void (depois && setTimeout(depois, 300));
    sintese.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = t.vozLingua;
    let foi = false;
    const seguirUmaVez = () => { if (!foi) { foi = true; depois?.(); } };
    u.onend = seguirUmaVez;
    u.onerror = seguirUmaVez;
    sintese.speak(u);
    if (depois) setTimeout(seguirUmaVez, 1500 + texto.length * 60);
  }

  /** Resposta a uma etapa do assistente. */
  function responder(e: Etapa, texto: string) {
    const fala = texto.trim().toLowerCase();
    const pular = /^(pular|pula|saltar|salta|n[aã]o|nada|sem|nenhum[a]?|sin|no|ninguno|ninguna)\b/.test(fala);
    const l = lerFalaLocal(texto);
    const x = { ...atual.current };
    fluxo.current.feitas.add(e);
    if (e === "valor") {
      if (!l.valor) return perguntar(e, true);
      x.valor = String(l.valor);
      if (l.litros) x.litros = String(l.litros);
      if (l.moeda && l.moeda !== x.moeda) { x.moeda = l.moeda; setMoedaTrocada(true); }
      if (l.categoria !== "OUTROS") { x.categoria = l.categoria; fluxo.current.tipoDito = true; }
      setValorManual(true);
    } else if (e === "tipo") {
      if (l.categoria === "OUTROS" && !/\boutr[oa]s?\b|\botros?\b/.test(fala)) return perguntar(e, true);
      x.categoria = l.categoria;
      fluxo.current.tipoDito = true;
    } else if (e === "litros") {
      const n = l.litros ?? l.valor;
      if (!pular && !n) return perguntar(e, true);
      if (n) x.litros = String(n);
      // "300 litros, 2 milhões 145 mil": também traz o total.
      if (l.litros && l.valor) { x.valor = String(l.valor); setValorManual(true); }
    } else if (e === "km") {
      const n = l.valor ?? l.litros;
      if (!pular && !n) return perguntar(e, true);
      if (n) x.odometroKm = String(Math.round(n));
    } else if (!pular) x.descricao = texto.trim().slice(0, 200);
    setF(x);
    seguir(x);
  }

  function cancelarAssistente() {
    reconhecimento.current?.stop();
    window.speechSynthesis?.cancel();
    setEtapa(null);
    setOuvindo(false);
    fluxo.current.voz = false;
    setAviso(null);
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setAviso(leituraAtiva ? t.lendoNota : null);
    try {
      const dataUrl = await reduzirFoto(arq);
      setRecibo(dataUrl);
      if (!leituraAtiva) {
        iniciarLeitura(async () => {
          try {
            setAviso(t.lendoNotaCelular);
            const texto = await textoDaFoto(await imagemParaLeitura(arq), (p) => setAviso(`${t.lendoNota} ${Math.round(p * 100)}%`));
            const n = lerNotaLocal(texto);
            if (!n.valor) {
              setOrigem("foto");
              setAviso(t.semTotal);
              return;
            }
            aplicar({ ok: true, caminhaoId: null, campos: { ...n, precoLitro: null, odometroKm: null, placa: null, descricao: null } }, "foto");
          } catch {
            setOrigem("foto");
            setAviso(t.notaIlegivel);
          }
        });
        return;
      }
      iniciarLeitura(async () => aplicar(await lerDespesaAction({ imagem: dataUrl }), "foto"));
    } catch {
      setAviso(t.fotoErro);
    }
  }

  function lerFrase(texto: string) {
    if (!texto.trim()) return;
    if (!leituraAtiva) {
      const l = lerFalaLocal(texto);
      if (!l.valor && !fluxo.current.voz) return setAviso(t.valorNaoEntendido(texto));
      aplicar({ ok: true, caminhaoId: null, campos: { ...l, precoLitro: null, posto: null, data: null, odometroKm: null, placa: null, descricao: null } }, "audio");
      return;
    }
    setAviso(t.entendendo);
    iniciarLeitura(async () => aplicar(await lerDespesaAction({ texto }), "audio"));
  }

  /** Começa uma despesa nova por voz. */
  function falar() {
    if (ouvindo) return reconhecimento.current?.stop();
    fluxo.current = { voz: true, tipoDito: tipoEscolhido.current, feitas: new Set() };
    // Despesa nova: limpa os campos, mantendo caminhão, data, moeda e o tipo escolhido.
    const x0 = atual.current;
    const limpo = { ...vazio, caminhaoId: x0.caminhaoId, data: x0.data, moeda: x0.moeda, categoria: x0.categoria };
    atual.current = limpo;
    setF(limpo);
    setValorManual(false);
    setRecibo(null);
    setOrigem("audio");
    setResumo(false);
    setOuvido(null);
    ouvir(null);
  }

  function ouvir(e: Etapa | null) {
    const w = window as JanelaComVoz;
    const Classe = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Classe) {
      setEtapa(null);
      setAviso(t.semVoz);
      return;
    }
    const rec = new Classe();
    rec.lang = t.vozLingua;
    rec.interimResults = false;
    let ouviu = false;
    rec.onresult = (ev) => {
      ouviu = true;
      const texto = Array.from(ev.results).map((x) => x[0].transcript).join(" ");
      setOuvido(texto);
      if (e) return responder(e, texto);
      setFrase(texto);
      lerFrase(texto);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setEtapa(null);
        setAviso(t.semMicrofone);
      }
    };
    rec.onend = () => {
      setOuvindo(false);
      if (!ouviu) setAviso(e ? t.naoOuviEtapa : t.naoOuvi);
    };
    reconhecimento.current = rec;
    setOuvindo(true);
    if (!e) setAviso(t.podeFalar);
    rec.start();
  }

  const valorNum = Number(f.valor);
  const emUsd = valorNum > 0 ? paraUsd(valorNum, f.moeda, cotacao) : null;
  const taxaTxt = {
    USD: null,
    PYG: `1 USD = ${num(cotacao.pygPorUsd, 0)} ₲`,
    BRL: `1 USD = R$ ${num(cotacao.brlPorUsd, 2)}`,
    ARS: `1 USD = AR$ ${num(cotacao.arsPorUsd, 2)}`,
  }[f.moeda];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="lingua" role="group" aria-label="Idioma / Idioma">
        {(["pt", "es"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lingua === l} className={lingua === l ? "pri" : ""} onClick={() => { setLingua(l); void salvarIdioma(l); }}>
            {l === "pt" ? "Português" : "Español"}
          </button>
        ))}
      </div>
      <label htmlFor="categoria" className="tipo-topo">{t.tipoDespesa}
        <select id="categoria" value={f.categoria} onChange={(e) => { tipoEscolhido.current = true; set("categoria", e.target.value); }}>
          {Object.entries(t.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <div className={`moeda-topo${moedaTrocada ? " trocada" : ""}`} role="radiogroup" aria-label={t.moedaDoGasto}>
        <span>{t.moedaDoGasto}</span>
        <div>
          {MOEDAS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={f.moeda === m} className={f.moeda === m ? "sel" : ""} onClick={() => { setMoedaTrocada(false); set("moeda", m); }}>
              <span aria-hidden="true">{BANDEIRA[m]}</span> <b>{SIMBOLO[m]}</b> {t.moedaCurta[m]}
            </button>
          ))}
        </div>
        {moedaTrocada && <small role="status">{t.moedaTrocada} <b>{t.moedas[f.moeda]}</b>. {t.confiraMoeda}</small>}
      </div>
      <div className="captura">
        <button type="button" className={`grande ${ouvindo ? "gravando" : "pri"}`} onClick={falar} disabled={lendo} aria-pressed={ouvindo}>
          <span aria-hidden="true">🎤</span> {ouvindo ? t.ouvindoParar : t.falar}
        </button>
        <button type="button" className="grande" onClick={() => arquivo.current?.click()} disabled={lendo}>
          <span aria-hidden="true">📷</span> {t.foto}
        </button>
        <input ref={arquivo} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolherFoto} />
      </div>
      {r?.ok && !etapa && !resumo && !ouvindo && (
        <div className="confirma ok" role="status">
          <div><b>{t.lancado}</b> {r.msg}</div>
          <button type="button" className="pri grande" onClick={falar}>🎤 {t.proxima}</button>
        </div>
      )}
      {!ouvindo && !resumo && !etapa && <p className="note">{t.dicaInicial}</p>}
      {ouvido && <p className="note">{t.ouvi}: “{ouvido}”</p>}
      {etapa && (
        <div className="confirma" role="group" aria-label="Assistente de voz">
          <div>
            <b>{t.perguntas[etapa]}</b>
            <br /><small className="muted">{ouvindo ? t.ouvindo : t.dicas[etapa]}</small>
          </div>
          <div className="form">
            {!ouvindo && <button type="button" className="pri grande" onClick={() => ouvir(etapa)}>🎤 {t.responder}</button>}
            {(etapa === "km" || etapa === "descricao" || etapa === "litros") && <button type="button" onClick={() => responder(etapa, "pular")}>{t.pular}</button>}
            <button type="button" onClick={cancelarAssistente}>{t.cancelar}</button>
          </div>
        </div>
      )}
      {(aviso || lendo) && <p className="msg info" role="status">{aviso ?? t.lendo}</p>}
      {resumo && !lendo && (
        <div className="confirma" role="group" aria-label="Confirmar despesa">
          <div>
            <b>{t.tipos[f.categoria] ?? f.categoria}</b> · <span className="valor-moeda">{BANDEIRA[f.moeda]} {SIMBOLO[f.moeda]} {num(valorNum, CASAS[f.moeda])}</span> <small>{t.emMoeda} {t.moedas[f.moeda]}</small>
            {emUsd !== null && f.moeda !== "USD" && <> · USD {num(emUsd, 2)}</>}
            {f.litros && <> · {f.litros} l</>}
            {f.litros && Number(f.precoLitro) > 0 && <> · {SIMBOLO[f.moeda]} {num(Number(f.precoLitro), CASAS[f.moeda])}/l</>}
            {f.odometroKm && <> · {num(Number(f.odometroKm))} km</>}
            {f.descricao && <> · {f.descricao}</>}
            <br /><small className="muted">{caminhoes.find((c) => c.id === f.caminhaoId)?.placa} · {f.data.split("-").reverse().join("/")}</small>
          </div>
          <div className="form">
            <button type="button" className="pri grande" disabled={enviando || !(valorNum > 0)} onClick={() => formulario.current?.requestSubmit()}>{t.lancar}</button>
            <button type="button" onClick={() => { setResumo(false); document.getElementById("valor")?.focus(); }}>{t.corrigir}</button>
          </div>
        </div>
      )}
      <details className="digitar">
        <summary>{t.digitar}</summary>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            lerFrase(frase);
          }}
        >
          <label htmlFor="frase" style={{ flex: 1 }}>
            {t.frase}
            <input id="frase" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder={t.exemploFrase} style={{ width: "100%" }} />
          </label>
          <button type="submit" disabled={lendo || !frase.trim()}>{t.preencher}</button>
        </form>
      </details>
      {recibo && (
        <div className="recibo-previa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recibo} alt={t.fotoRecibo} />
          <button type="button" onClick={() => setRecibo(null)}>{t.removerFoto}</button>
        </div>
      )}

      <form className="form" action={acao} ref={formulario}>
        <input type="hidden" name="origem" value={origem} />
        <input type="hidden" name="idioma" value={lingua} />
        {recibo && <input type="hidden" name="recibo" value={recibo} />}
        <label htmlFor="caminhaoId">{t.caminhao}
          <select id="caminhaoId" name="caminhaoId" value={f.caminhaoId} onChange={(e) => set("caminhaoId", e.target.value)}>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
        <label htmlFor="data">{t.data}<input id="data" name="data" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} required /></label>
        <input type="hidden" name="categoria" value={f.categoria} />
        <input type="hidden" name="moeda" value={f.moeda} />
        {combustivel && (
          <>
            <label htmlFor="litros">{t.litros}<input id="litros" name="litros" type="number" step="0.01" min="0.01" inputMode="decimal" value={f.litros} onChange={(e) => set("litros", e.target.value)} required={f.categoria === "DIESEL"} /></label>
            <label htmlFor="precoLitro">{t.precoLitro} ({SIMBOLO[f.moeda]})<input id="precoLitro" name="precoLitro" type="number" step="any" min="0" inputMode="decimal" value={f.precoLitro} onChange={(e) => set("precoLitro", e.target.value)} /></label>
          </>
        )}
        <label htmlFor="valor">{t.valorTotal} {t.emMoeda} <b className="moeda-rotulo">{BANDEIRA[f.moeda]} {t.moedas[f.moeda]}</b>
          <input id="valor" name="valor" type="number" step="any" min="0.01" inputMode="decimal" value={f.valor} onChange={(e) => { setValorManual(true); set("valor", e.target.value); }} required />
        </label>
        {combustivel && (
          <>
            <label htmlFor="posto">{t.posto}<input id="posto" name="posto" className="wide" value={f.posto} onChange={(e) => set("posto", e.target.value)} /></label>
            <label htmlFor="odometroKm">{t.odometro}<input id="odometroKm" name="odometroKm" type="number" min="0" inputMode="numeric" value={f.odometroKm} onChange={(e) => set("odometroKm", e.target.value)} /></label>
            <label htmlFor="tanqueCheio" className="check"><input id="tanqueCheio" name="tanqueCheio" type="checkbox" checked={f.tanqueCheio} onChange={(e) => set("tanqueCheio", e.target.checked)} />{t.tanqueCheio}</label>
          </>
        )}
        <label htmlFor="descricao">{t.descricao}<input id="descricao" name="descricao" className="wide" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
        <button className="pri" type="submit" disabled={enviando || lendo}>{t.lancar}</button>
      </form>
      {emUsd !== null && f.moeda !== "USD" && (
        <p className="note">
          = <b>USD {num(emUsd, 2)}</b> · {taxaTxt} · {t.cotacaoDe} {cotacao.data.split("-").reverse().join("/")} ({cotacao.fonte})
        </p>
      )}
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </div>
  );
}
