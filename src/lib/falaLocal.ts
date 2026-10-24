// Entende frases simples de despesa sem chamar a Claude API, a partir do texto
// que o reconhecimento de voz do navegador devolve. Ex.: "pedágio 45 mil guaranis",
// "diesel 300 litros 2.145.000", "almoço 85.000". Usado quando a leitura
// automática não está ativada no servidor; o usuário sempre confere antes de lançar.
import type { Moeda } from "./cambio";

export type FalaLida = {
  categoria: "DIESEL" | "ARLA32" | "ALIMENTACAO" | "PEDAGIO" | "MANUTENCAO" | "PNEUS" | "OUTROS";
  valor: number | null;
  moeda: Moeda | null;
  litros: number | null;
};

const CATEGORIAS: [FalaLida["categoria"], RegExp][] = [
  ["ARLA32", /\b(arla|adblue|ureia|urea)\b/],
  ["DIESEL", /\b(diesel|gasoil|gas[oó]leo|combust[ií]vel|abasteci\w*)\b/],
  ["PEDAGIO", /\b(ped[aá]gio|peaje)\b/],
  ["PNEUS", /\b(borracharia|gomer[ií]a|pneus?|cubiertas?)\b/],
  ["MANUTENCAO", /\b(manuten[cç][aã]o|oficina|taller|pe[cç]as?|[oó]leo|filtros?|mec[aâ]nico)\b/],
  ["ALIMENTACAO", /\b(alimenta[cç][aã]o|almo[cç]o|janta|jantar|lanche|caf[eé]|refei[cç][aã]o|comida|restaurante|comedor|cena)\b/],
];

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, un: 1, uno: 1, dois: 2, duas: 2, dos: 2, tres: 3, "três": 3, quatro: 4, cuatro: 4, cinco: 5,
  seis: 6, sete: 7, siete: 7, oito: 8, ocho: 8, nove: 9, nueve: 9, dez: 10, diez: 10, cem: 100, cien: 100,
};

/** "2.145.000" → 2145000; "45,50" → 45.5; "1.234,56" → 1234.56 */
function numero(txt: string): number {
  if (/,\d{1,2}$/.test(txt)) return Number(txt.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(txt)) return Number(txt.replace(/\./g, ""));
  return Number(txt.replace(",", "."));
}

/** Lista os valores ditos, já com "mil", "milhões" e "e meio" aplicados. */
function valores(t: string): { v: number; fim: number }[] {
  const re = /(\d[\d.,]*|\b(?:um|uma|un|uno|dois|duas|dos|tres|três|quatro|cuatro|cinco|seis|sete|siete|oito|ocho|nove|nueve|dez|diez|cem|cien)\b)\s*(milh[õo]es|milh[ãa]o|millones|mill[oó]n|mil)?(\s+e\s+meio|\s+y\s+medio)?/g;
  const out: { v: number; fim: number }[] = [];
  for (const m of t.matchAll(re)) {
    let v = /\d/.test(m[1]) ? numero(m[1].replace(/[.,]$/, "")) : UNIDADES[m[1]];
    if (!Number.isFinite(v)) continue;
    const mult = m[2] ? (m[2].startsWith("mil") && m[2].length === 3 ? 1000 : 1_000_000) : 1;
    if (m[3]) v += 0.5;
    out.push({ v: v * mult, fim: (m.index ?? 0) + m[0].length });
  }
  return out;
}

export function lerFalaLocal(frase: string): FalaLida {
  const t = frase.toLowerCase().normalize("NFC");
  const categoria = CATEGORIAS.find(([, re]) => re.test(t))?.[0] ?? "OUTROS";
  const moeda: Moeda | null = /\b(d[oó]lar(es)?|usd)\b/.test(t) ? "USD"
    : /\b(reais|real|r\$)/.test(t) ? "BRL"
    : /\bpesos?\b/.test(t) ? "ARS"
    : /\b(guaranis?|gs\.?)\b|₲/.test(t) ? "PYG"
    : null;

  let litros: number | null = null;
  const nums = valores(t).filter((n) => {
    if (/^\s*(litros?|l\b)/.test(t.slice(n.fim))) { litros = n.v; return false; }
    return true;
  });
  // O valor é o maior número dito que não seja litros (preço por litro costuma ser menor).
  const valor = nums.length ? Math.max(...nums.map((n) => n.v)) : null;
  return { categoria, valor, moeda, litros };
}
