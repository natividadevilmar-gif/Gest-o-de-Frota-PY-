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
  const out: { v: number; fim: number; mult: number }[] = [];
  for (const m of t.matchAll(re)) {
    let v = /\d/.test(m[1]) ? numero(m[1].replace(/[.,]$/, "")) : UNIDADES[m[1]];
    if (!Number.isFinite(v)) continue;
    const mult = m[2] ? (m[2].startsWith("mil") && m[2].length === 3 ? 1000 : 1_000_000) : 1;
    if (m[3]) v += 0.5;
    const inicio = m.index ?? 0;
    const ant = out[out.length - 1];
    // "2 milhões 145 mil" e "dois milhões e quinhentos mil" somam num só valor.
    if (ant && ant.mult > mult && v * mult < ant.mult && /^\s*(e|y)?\s*$/.test(t.slice(ant.fim, inicio))) {
      ant.v += v * mult;
      ant.fim = inicio + m[0].length;
      ant.mult = mult;
      continue;
    }
    out.push({ v: v * mult, fim: inicio + m[0].length, mult });
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

export type NotaLida = FalaLida & { data: string | null; posto: string | null };

const NUM_DINHEIRO = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{3,7}/g;
const NAO_E_VALOR = /\b(ruc|timbrado|tel|telefone|cuit|cnpj|cpf|nro|n[ºo°]|factura|fatura|caja|cajero|ticket|autoriza)/i;

function dinheiro(txt: string): number {
  return numero(txt.replace(/\s/g, "."));
}

/**
 * Lê o texto que o OCR do celular extraiu da foto de uma nota (Tesseract) e
 * acha tipo, total, moeda, litros, data e estabelecimento. Heurística simples:
 * o total é o maior valor das linhas com "total"; sem elas, o maior valor da nota.
 */
export function lerNotaLocal(texto: string): NotaLida {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const t = texto.toLowerCase();
  const categoria = CATEGORIAS.find(([, re]) => re.test(t))?.[0] ?? "OUTROS";
  const moeda: Moeda | null = /\b(u\$s|usd|d[oó]lares)\b/.test(t) ? "USD"
    : /r\$|\breais\b|\bcnpj\b/.test(t) ? "BRL"
    : /\b(cuit|ars|argentina)\b/.test(t) ? "ARS"
    : /\b(gs\.?|guaran[ií]e?s?|ruc|timbrado|asunci[oó]n)\b|₲/.test(t) ? "PYG"
    : null;

  const valoresDa = (l: string) => (NAO_E_VALOR.test(l) || /\d{2}[/-]\d{2}[/-]\d{2,4}|\d{2}:\d{2}/.test(l) ? [] : (l.match(NUM_DINHEIRO) ?? []).map(dinheiro));
  const totais = linhas.filter((l) => /total/i.test(l) && !/sub\s*-?total/i.test(l)).flatMap(valoresDa);
  const todos = linhas.flatMap((l) => (/litros?|\blts?\b/i.test(l) ? [] : valoresDa(l)));
  const lista = totais.length ? totais : todos;
  const valor = lista.length ? Math.max(...lista) : null;

  const ml = /(\d+(?:[.,]\d+)?)\s*(?:l|lt|lts|litros?)\b/i.exec(texto);
  const litros = ml ? Number(ml[1].replace(",", ".")) : null;
  const md = /(\d{2})[/-](\d{2})[/-](\d{4}|\d{2})/.exec(texto);
  const data = md ? `${md[3].length === 2 ? `20${md[3]}` : md[3]}-${md[2]}-${md[1]}` : null;
  const posto = linhas.find((l) => /[a-záéíóúç]{3,}/i.test(l) && !/\d{3,}/.test(l))?.slice(0, 80) ?? null;
  return { categoria, valor, moeda, litros, data, posto };
}
