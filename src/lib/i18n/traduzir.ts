// Tradução das telas a partir do texto em português: cada frase do dicionário
// é [português, espanhol, inglês, alemão]. Frases com {0}, {1}… são modelos
// para textos montados com valores (placas, números, nomes).
import type { IdiomaTraduzido } from "./idiomas";

export type Linha = readonly [pt: string, es: string, en: string, de: string];

const COLUNA: Record<IdiomaTraduzido, 1 | 2 | 3> = { es: 1, en: 2, de: 3 };

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES: Record<IdiomaTraduzido, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const RE_MES = new RegExp(`^(${MESES_PT.join("|")}) de (\\d{4})$`);

const normalizar = (s: string) => s.replace(/\s+/g, " ").trim();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const temLetra = (s: string) => /\p{L}/u.test(s);

type Modelo = { re: RegExp; alvo: string; peso: number };

/**
 * Monta a função que traduz um texto da tela. Devolve null quando não sabe
 * traduzir (o texto fica como está: nomes, placas, cidades, números).
 */
export function criarTradutor(linhas: readonly Linha[], idioma: IdiomaTraduzido) {
  const col = COLUNA[idioma];
  const exato = new Map<string, string>();
  const modelos: Modelo[] = [];
  for (const l of linhas) {
    const pt = normalizar(l[0]);
    const alvo = l[col];
    if (!alvo || alvo === pt) continue;
    if (/\{\d\}/.test(pt)) {
      const literal = pt.replace(/\{\d\}/g, "");
      if ((literal.match(/\p{L}/gu) ?? []).length < 3) continue;
      const ordem: number[] = [];
      const fonte = pt.split(/(\{\d\})/).map((p) => {
        const m = p.match(/^\{(\d)\}$/);
        if (!m) return escapar(p);
        ordem.push(Number(m[1]));
        return "(.+?)";
      }).join("");
      // O alvo usa os números do português; a captura n vira o {n} do modelo.
      modelos.push({ re: new RegExp(`^${fonte}$`, "s"), alvo: alvo.replace(/\{(\d)\}/g, (_, n) => `{#${ordem.indexOf(Number(n))}}`), peso: literal.length });
    } else {
      exato.set(pt, alvo);
    }
  }
  modelos.sort((a, b) => b.peso - a.peso);

  const memoria = new Map<string, string | null>();

  function nucleo(s: string, profundidade: number): string | null {
    const e = exato.get(s);
    if (e !== undefined) return e;
    const mes = s.match(RE_MES);
    if (mes) {
      const nome = MESES[idioma][MESES_PT.indexOf(mes[1])];
      return idioma === "es" ? `${nome} de ${mes[2]}` : `${nome} ${mes[2]}`;
    }
    if (profundidade > 3) return null;
    const p = profundidade + 1;
    for (const m of modelos) {
      const r = s.match(m.re);
      if (!r) continue;
      return m.alvo.replace(/\{#(\d)\}/g, (_, n) => { const v = r[Number(n) + 1] ?? ""; return traduzir(v, p) ?? v; });
    }
    // Partes separadas por " · " são traduzidas uma a uma.
    if (s.includes(" · ")) {
      const partes = s.split(" · ");
      const t = partes.map((x) => traduzir(x, p));
      if (t.some((x) => x !== null)) return partes.map((x, i) => t[i] ?? x).join(" · ");
    }
    // "Rótulo: valor"
    const rot = s.match(/^([^:]{2,60}):\s+(.+)$/s);
    if (rot) {
      const a = exato.get(`${rot[1]}:`) ?? (exato.has(rot[1]) ? `${exato.get(rot[1])}:` : null);
      if (a) return `${a} ${traduzir(rot[2], p) ?? rot[2]}`;
    }
    // Número na frente ou no fim: "8 caminhões", "Faltam 120"
    const n1 = s.match(/^([-+−]?\d[\d.,]*\s*%?\s+)(.+)$/s);
    if (n1) { const t = traduzir(n1[2], p); if (t !== null) return n1[1] + t; }
    const n2 = s.match(/^(.+?)(\s+[-+−]?\d[\d.,]*\s*%?)$/s);
    if (n2) { const t = traduzir(n2[1], p); if (t !== null) return t + n2[2]; }
    // Pontuação e símbolos em volta: "+ Lançar frete", "Ver vídeo →", "(estimado)"
    const pont = s.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su);
    if (pont && (pont[1] || pont[3]) && pont[2]) {
      // Tenta com a pontuação final junto (". Pode alterar … média."), depois só o miolo.
      const comFinal = pont[3] ? exato.get(pont[2] + pont[3].trimEnd()) : undefined;
      if (comFinal !== undefined) return pont[1] + comFinal + pont[3].slice(pont[3].trimEnd().length);
      const t = traduzir(pont[2], p) ?? (pont[3].startsWith(":") ? exato.get(`${pont[2]}:`)?.slice(0, -1) ?? null : null);
      if (t !== null) return pont[1] + t + pont[3];
    }
    return null;
  }

  function traduzir(texto: string, profundidade = 0): string | null {
    const s = normalizar(texto);
    if (!s || !temLetra(s)) return null;
    if (profundidade === 0 && memoria.has(s)) return memoria.get(s)!;
    const r = nucleo(s, profundidade);
    if (profundidade === 0) memoria.set(s, r);
    return r;
  }

  /** Traduz mantendo os espaços em volta do texto original. */
  return (texto: string): string | null => {
    const m = texto.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const r = traduzir(m[2]);
    return r === null ? null : m[1] + r + m[3];
  };
}

export type Tradutor = ReturnType<typeof criarTradutor>;
