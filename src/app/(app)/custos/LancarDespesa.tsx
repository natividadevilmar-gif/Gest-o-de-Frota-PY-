"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { paraUsd, SIMBOLO, type Moeda } from "@/lib/cambio";
import { num } from "@/lib/formato";
import { lancarDespesa, lerDespesaAction, type Leitura } from "./actions";

type Props = {
  caminhoes: { id: string; placa: string }[];
  hoje: string;
  cotacao: { pygPorUsd: number; brlPorUsd: number; data: string; fonte: string };
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
const CASAS: Record<Moeda, number> = { USD: 2, PYG: 0, BRL: 2 };

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
      categoria: c.categoria,
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
    setAviso("Confira os campos e toque em Lançar.");
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setAviso("Lendo o recibo…");
    try {
      const dataUrl = await reduzirFoto(arq);
      setRecibo(dataUrl);
      iniciarLeitura(async () => aplicar(await lerDespesaAction({ imagem: dataUrl }), "foto"));
    } catch {
      setAviso("Não consegui abrir a foto. Tente outra vez.");
    }
  }

  function lerFrase(texto: string) {
    if (!texto.trim()) return;
    setAviso("Entendendo o que foi dito…");
    iniciarLeitura(async () => aplicar(await lerDespesaAction({ texto }), "audio"));
  }

  function falar() {
    if (ouvindo) return reconhecimento.current?.stop();
    const w = window as JanelaComVoz;
    const Classe = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Classe) {
      setAviso("Este navegador não reconhece voz. Toque no campo abaixo e use o microfone do teclado.");
      return;
    }
    const rec = new Classe();
    rec.lang = idioma === "es" ? "es-PY" : "pt-BR";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const texto = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      setFrase(texto);
      lerFrase(texto);
    };
    rec.onerror = (e) => setAviso(e.error === "not-allowed" ? "Permita o uso do microfone para falar a despesa." : "Não ouvi direito. Tente de novo.");
    rec.onend = () => setOuvindo(false);
    reconhecimento.current = rec;
    setOuvindo(true);
    setAviso("Pode falar. Ex.: “diesel, 300 litros a 7.150 guaranis, posto Copetrol”");
    rec.start();
  }

  const valorNum = Number(f.valor);
  const emUsd = valorNum > 0 ? paraUsd(valorNum, f.moeda, cotacao) : null;
  const taxaTxt = f.moeda === "PYG" ? `1 USD = ${num(cotacao.pygPorUsd, 0)} ₲` : f.moeda === "BRL" ? `1 USD = R$ ${num(cotacao.brlPorUsd, 2)}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {leituraAtiva && (
        <div className="captura">
          <button type="button" className="pri" onClick={() => arquivo.current?.click()} disabled={lendo}>
            Foto do recibo
          </button>
          <input ref={arquivo} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolherFoto} />
          <button type="button" onClick={falar} disabled={lendo} aria-pressed={ouvindo} className={ouvindo ? "gravando" : ""}>
            {ouvindo ? "Parar" : "Falar a despesa"}
          </button>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              lerFrase(frase);
            }}
            style={{ flex: 1 }}
          >
            <label htmlFor="frase" style={{ flex: 1 }}>
              ou escreva
              <input id="frase" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Pedágio 45 mil guaranis em Coronel Oviedo" style={{ width: "100%" }} />
            </label>
            <button type="submit" disabled={lendo || !frase.trim()}>Preencher</button>
          </form>
        </div>
      )}
      {(aviso || lendo) && <p className="msg info" role="status">{lendo ? "Lendo…" : aviso}</p>}
      {recibo && (
        <div className="recibo-previa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recibo} alt="Foto do recibo" />
          <button type="button" onClick={() => setRecibo(null)}>Remover foto</button>
        </div>
      )}

      <form className="form" action={acao}>
        <input type="hidden" name="origem" value={origem} />
        {recibo && <input type="hidden" name="recibo" value={recibo} />}
        <label htmlFor="caminhaoId">Caminhão
          <select id="caminhaoId" name="caminhaoId" value={f.caminhaoId} onChange={(e) => set("caminhaoId", e.target.value)}>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
        <label htmlFor="data">Data<input id="data" name="data" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} required /></label>
        <label htmlFor="categoria">Tipo
          <select id="categoria" name="categoria" value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
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
