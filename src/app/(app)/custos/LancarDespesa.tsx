"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { paraUsd, SIMBOLO, type Moeda } from "@/lib/cambio";
import { lerFalaLocal, lerNotaLocal } from "@/lib/falaLocal";
import { num } from "@/lib/formato";
import { lancarDespesa, lerDespesaAction, type Leitura } from "./actions";

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
const PERGUNTA: Record<Etapa, string> = {
  valor: "Qual foi o valor?",
  tipo: "Qual o tipo? Diesel, alimentação, pedágio, manutenção ou borracharia?",
  litros: "Quantos litros?",
  km: "Qual a quilometragem do caminhão?",
  descricao: "Quer falar uma descrição?",
};
const DICA: Record<Etapa, string> = {
  valor: "Ex.: “45 mil”, “120 dólares”",
  tipo: "Ex.: “pedágio”",
  litros: "Ex.: “300”",
  km: "Ex.: “452 mil 800”. Ou toque em Pular.",
  descricao: "Ex.: “troca de pneu dianteiro”. Ou toque em Pular.",
};
const TIPO: Record<string, string> = {
  DIESEL: "Diesel", ARLA32: "Arla 32", ALIMENTACAO: "Alimentação", PEDAGIO: "Pedágio", MANUTENCAO: "Manutenção", PNEUS: "Borracharia", OUTROS: "Outros",
};
const CASAS: Record<Moeda, number> = { USD: 2, PYG: 0, BRL: 2, ARS: 2 };

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

  useEffect(() => {
    if (r?.ok) {
      setF((x) => ({ ...vazio, caminhaoId: x.caminhaoId, data: x.data, moeda: x.moeda }));
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
      : !fluxo.current.tipoDito ? "tipo"
      : COMBUSTIVEL.includes(c.categoria) && !(Number(c.litros) > 0) && !feitas.has("litros") ? "litros"
      : !c.odometroKm && !feitas.has("km") ? "km"
      : !c.descricao && !feitas.has("descricao") ? "descricao"
      : null;
    if (!proxima) {
      setEtapa(null);
      setResumo(true);
      falarTexto("Confira e toque em lançar.");
      return;
    }
    perguntar(proxima);
  }

  function perguntar(e: Etapa, repetir = false) {
    setEtapa(e);
    setResumo(false);
    const texto = (repetir ? "Não entendi. " : "") + PERGUNTA[e];
    setAviso(null);
    falarTexto(texto, () => ouvir(e));
  }

  /** Fala a pergunta em voz alta (quando o celular permite) e depois começa a ouvir. */
  function falarTexto(texto: string, depois?: () => void) {
    const sintese = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!sintese || typeof SpeechSynthesisUtterance === "undefined") return void (depois && setTimeout(depois, 300));
    sintese.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = idioma === "es" ? "es-PY" : "pt-BR";
    let foi = false;
    const seguirUmaVez = () => { if (!foi) { foi = true; depois?.(); } };
    u.onend = seguirUmaVez;
    u.onerror = seguirUmaVez;
    sintese.speak(u);
    if (depois) setTimeout(seguirUmaVez, 1500 + texto.length * 60);
  }

  /** Resposta a uma etapa do assistente. */
  function responder(e: Etapa, texto: string) {
    const t = texto.trim().toLowerCase();
    const pular = /^(pular|pula|n[aã]o|nada|sem|nenhum[a]?|sin|no|ninguno)\b/.test(t);
    const l = lerFalaLocal(texto);
    const x = { ...atual.current };
    fluxo.current.feitas.add(e);
    if (e === "valor") {
      if (!l.valor) return perguntar(e, true);
      x.valor = String(l.valor);
      if (l.moeda) x.moeda = l.moeda;
      if (l.categoria !== "OUTROS") { x.categoria = l.categoria; fluxo.current.tipoDito = true; }
      setValorManual(true);
    } else if (e === "tipo") {
      if (l.categoria === "OUTROS" && !/\boutr[oa]s?\b|\botros?\b/.test(t)) return perguntar(e, true);
      x.categoria = l.categoria;
      fluxo.current.tipoDito = true;
    } else if (e === "litros") {
      const n = l.litros ?? l.valor;
      if (!pular && !n) return perguntar(e, true);
      if (n) x.litros = String(n);
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
    setAviso(leituraAtiva ? "Lendo a nota…" : null);
    try {
      const dataUrl = await reduzirFoto(arq);
      setRecibo(dataUrl);
      if (!leituraAtiva) {
        iniciarLeitura(async () => {
          try {
            setAviso("Lendo a nota no celular… a primeira vez demora um pouco.");
            const texto = await textoDaFoto(dataUrl, (p) => setAviso(`Lendo a nota… ${Math.round(p * 100)}%`));
            const n = lerNotaLocal(texto);
            if (!n.valor) {
              setOrigem("foto");
              setAviso("Foto anexada, mas não achei o total. Digite o valor e toque em Lançar.");
              return;
            }
            aplicar({ ok: true, caminhaoId: null, campos: { ...n, precoLitro: null, odometroKm: null, placa: null, descricao: null } }, "foto");
          } catch {
            setOrigem("foto");
            setAviso("Foto anexada. Não consegui ler a nota; digite o valor e toque em Lançar.");
          }
        });
        return;
      }
      iniciarLeitura(async () => aplicar(await lerDespesaAction({ imagem: dataUrl }), "foto"));
    } catch {
      setAviso("Não consegui abrir a foto. Tente outra vez.");
    }
  }

  function lerFrase(texto: string) {
    if (!texto.trim()) return;
    if (!leituraAtiva) {
      const l = lerFalaLocal(texto);
      if (!l.valor && !fluxo.current.voz) return setAviso(`Não entendi o valor em “${texto}”. Tente de novo.`);
      aplicar({ ok: true, caminhaoId: null, campos: { ...l, precoLitro: null, posto: null, data: null, odometroKm: null, placa: null, descricao: null } }, "audio");
      return;
    }
    setAviso("Entendendo o que foi dito…");
    iniciarLeitura(async () => aplicar(await lerDespesaAction({ texto }), "audio"));
  }

  /** Começa uma despesa nova por voz. */
  function falar() {
    if (ouvindo) return reconhecimento.current?.stop();
    fluxo.current = { voz: true, tipoDito: false, feitas: new Set() };
    // Despesa nova: limpa os campos, mantendo caminhão, data e moeda.
    const limpo = { ...vazio, caminhaoId: atual.current.caminhaoId, data: atual.current.data, moeda: atual.current.moeda };
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
      setAviso("Este navegador não reconhece voz. Abra “Prefere digitar a frase?”, use o microfone do teclado e toque em Preencher.");
      return;
    }
    const rec = new Classe();
    rec.lang = idioma === "es" ? "es-PY" : "pt-BR";
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
        setAviso("O microfone não foi liberado. Abra “Prefere digitar a frase?” e use o microfone do teclado.");
      }
    };
    rec.onend = () => {
      setOuvindo(false);
      if (!ouviu) setAviso(e ? "Não ouvi. Toque em “Responder” e fale de novo." : "Não ouvi nada. Toque no microfone e fale de novo.");
    };
    reconhecimento.current = rec;
    setOuvindo(true);
    if (!e) setAviso("Pode falar agora…");
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
      <div className="captura">
        <button type="button" className={`grande ${ouvindo ? "gravando" : "pri"}`} onClick={falar} disabled={lendo} aria-pressed={ouvindo}>
          <span aria-hidden="true">🎤</span> {ouvindo ? "Ouvindo… toque para parar" : "Falar a despesa"}
        </button>
        <button type="button" className="grande" onClick={() => arquivo.current?.click()} disabled={lendo}>
          <span aria-hidden="true">📷</span> Foto da nota
        </button>
        <input ref={arquivo} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolherFoto} />
      </div>
      {r?.ok && !etapa && !resumo && !ouvindo && (
        <div className="confirma ok" role="status">
          <div><b>Lançado:</b> {r.msg}</div>
          <button type="button" className="pri grande" onClick={falar}>🎤 Falar a próxima despesa</button>
        </div>
      )}
      {!ouvindo && !resumo && !etapa && <p className="note">Fale assim: “<b>pedágio 45 mil</b>”, “<b>almoço 60 mil guaranis</b>” ou “<b>diesel 300 litros 2 milhões 145 mil</b>”.</p>}
      {ouvido && <p className="note">Ouvi: “{ouvido}”</p>}
      {etapa && (
        <div className="confirma" role="group" aria-label="Assistente de voz">
          <div>
            <b>{PERGUNTA[etapa]}</b>
            <br /><small className="muted">{ouvindo ? "Ouvindo…" : DICA[etapa]}</small>
          </div>
          <div className="form">
            {!ouvindo && <button type="button" className="pri grande" onClick={() => ouvir(etapa)}>🎤 Responder</button>}
            {(etapa === "km" || etapa === "descricao" || etapa === "litros") && <button type="button" onClick={() => responder(etapa, "pular")}>Pular</button>}
            <button type="button" onClick={cancelarAssistente}>Cancelar</button>
          </div>
        </div>
      )}
      {(aviso || lendo) && <p className="msg info" role="status">{aviso ?? "Lendo…"}</p>}
      {resumo && !lendo && (
        <div className="confirma" role="group" aria-label="Confirmar despesa">
          <div>
            <b>{TIPO[f.categoria] ?? f.categoria}</b> · {SIMBOLO[f.moeda]} {num(valorNum, CASAS[f.moeda])}
            {emUsd !== null && f.moeda !== "USD" && <> · USD {num(emUsd, 2)}</>}
            {f.litros && <> · {f.litros} l</>}
            {f.odometroKm && <> · {num(Number(f.odometroKm))} km</>}
            {f.descricao && <> · {f.descricao}</>}
            <br /><small className="muted">{caminhoes.find((c) => c.id === f.caminhaoId)?.placa} · {f.data.split("-").reverse().join("/")}</small>
          </div>
          <div className="form">
            <button type="button" className="pri grande" disabled={enviando || !(valorNum > 0)} onClick={() => formulario.current?.requestSubmit()}>Lançar</button>
            <button type="button" onClick={() => { setResumo(false); document.getElementById("valor")?.focus(); }}>Corrigir</button>
          </div>
        </div>
      )}
      <details className="digitar">
        <summary>Prefere digitar a frase?</summary>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            lerFrase(frase);
          }}
        >
          <label htmlFor="frase" style={{ flex: 1 }}>
            Frase
            <input id="frase" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Pedágio 45 mil guaranis" style={{ width: "100%" }} />
          </label>
          <button type="submit" disabled={lendo || !frase.trim()}>Preencher</button>
        </form>
      </details>
      {recibo && (
        <div className="recibo-previa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recibo} alt="Foto do recibo" />
          <button type="button" onClick={() => setRecibo(null)}>Remover foto</button>
        </div>
      )}

      <form className="form" action={acao} ref={formulario}>
        <input type="hidden" name="origem" value={origem} />
        {recibo && <input type="hidden" name="recibo" value={recibo} />}
        <label htmlFor="caminhaoId">Caminhão
          <select id="caminhaoId" name="caminhaoId" value={f.caminhaoId} onChange={(e) => set("caminhaoId", e.target.value)}>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
        <label htmlFor="data">Data<input id="data" name="data" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} required /></label>
        <label htmlFor="categoria">Tipo
          <select id="categoria" name="categoria" value={f.categoria} onChange={(e) => { fluxo.current.tipoDito = true; set("categoria", e.target.value); }}>
            <option value="DIESEL">Combustível: diesel</option>
            <option value="ARLA32">Combustível: Arla 32</option>
            <option value="ALIMENTACAO">Alimentação</option>
            <option value="PEDAGIO">Pedágio</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="PNEUS">Borracharia</option>
            <option value="OUTROS">Outros</option>
          </select>
        </label>
        <label htmlFor="moeda">Moeda
          <select id="moeda" name="moeda" value={f.moeda} onChange={(e) => set("moeda", e.target.value)}>
            <option value="PYG">Guaranis (₲)</option>
            <option value="USD">Dólares (USD)</option>
            <option value="BRL">Reais (R$)</option>
            <option value="ARS">Pesos argentinos (AR$)</option>
          </select>
        </label>
        {combustivel && (
          <>
            <label htmlFor="litros">Litros<input id="litros" name="litros" type="number" step="0.01" min="0.01" inputMode="decimal" value={f.litros} onChange={(e) => set("litros", e.target.value)} required={f.categoria === "DIESEL"} /></label>
            <label htmlFor="precoLitro">Preço por litro ({SIMBOLO[f.moeda]})<input id="precoLitro" name="precoLitro" type="number" step="any" min="0" inputMode="decimal" value={f.precoLitro} onChange={(e) => set("precoLitro", e.target.value)} /></label>
          </>
        )}
        <label htmlFor="valor">Valor total ({SIMBOLO[f.moeda]})
          <input id="valor" name="valor" type="number" step="any" min="0.01" inputMode="decimal" value={f.valor} onChange={(e) => { setValorManual(true); set("valor", e.target.value); }} required />
        </label>
        {combustivel && (
          <>
            <label htmlFor="posto">Posto<input id="posto" name="posto" className="wide" value={f.posto} onChange={(e) => set("posto", e.target.value)} /></label>
            <label htmlFor="odometroKm">Odômetro (km)<input id="odometroKm" name="odometroKm" type="number" min="0" inputMode="numeric" value={f.odometroKm} onChange={(e) => set("odometroKm", e.target.value)} /></label>
            <label htmlFor="tanqueCheio" className="check"><input id="tanqueCheio" name="tanqueCheio" type="checkbox" checked={f.tanqueCheio} onChange={(e) => set("tanqueCheio", e.target.checked)} />Completou o tanque</label>
          </>
        )}
        <label htmlFor="descricao">Descrição<input id="descricao" name="descricao" className="wide" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
        <button className="pri" type="submit" disabled={enviando || lendo}>Lançar</button>
      </form>
      {emUsd !== null && f.moeda !== "USD" && (
        <p className="note">
          = <b>USD {num(emUsd, 2)}</b> · {taxaTxt} · cotação de {cotacao.data.split("-").reverse().join("/")} ({cotacao.fonte})
        </p>
      )}
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </div>
  );
}
