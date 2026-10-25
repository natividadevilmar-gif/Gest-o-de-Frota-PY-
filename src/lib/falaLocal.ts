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
  ["DIESEL", /\b(di[eé]sel|gasoil|gas[oó]leo|combust[ií]vel|combustible|abasteci\w*|carga de combustible)\b/],
  ["PEDAGIO", /\b(ped[aá]gio|peaje)\b/],
  ["PNEUS", /\b(borracharia|gomer[ií]a|pneus?|cubiertas?)\b/],
  ["MANUTENCAO", /\b(manuten[cç][aã]o|mantenimiento|oficina|taller|pe[cç]as?|repuestos?|[oó]leo|aceite|filtros?|mec[aâ]nico)\b/],
  ["ALIMENTACAO", /\b(alimenta[cç][aã]o|almo[cç]o|almuerzo|desayuno|janta|jantar|lanche|caf[eé]|refei[cç][aã]o|comida|restaurante|comedor|cena)\b/],
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
    : /\b(guaran[ií]e?s?|gs\.?)\b|₲/.test(t) ? "PYG"
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

// Inclui centavos com ponto (426.21), comum no OCR de cupom brasileiro.
const NUM_DINHEIRO = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?(?![.,]?\d)|\d+[.,]\d{2}(?!\d)|\d+,\d(?!\d)|\d{3,7}/g;
const NAO_E_VALOR = /\b(ruc|timbrado|tel|telefone|cuit|cnpj|cpf|nro|n[ºo°]|factura|fatura|caja|cajero|ticket|autoriza)/i;

function dinheiro(txt: string): number {
  return numero(txt.replace(/\s/g, "."));
}

/**
 * Lê o texto que o OCR do celular extraiu da foto de uma nota (Tesseract) e
 * acha tipo, total, moeda, litros, data e estabelecimento. Heurística simples:
 * o total é o maior valor das linhas com "total"; sem elas, o maior valor da nota.
 */
export function lerNotaLocal(texto: string, hoje = new Date()): NotaLida {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const t = texto.toLowerCase();
  // Em fatura, "abastecimento" costuma ser de água; só conta como combustível se houver litros.
  const tCat = /litro|\blts?\b/.test(t) ? t : t.replace(/abasteci\w*/g, "");
  const categoria = CATEGORIAS.find(([, re]) => re.test(tCat))?.[0] ?? "OUTROS";
  const moeda: Moeda | null = /\b(u\$s|usd|d[oó]lares)\b/.test(t) ? "USD"
    : /r\$|\breais\b|\bcnpj\b/.test(t) ? "BRL"
    : /\b(cuit|ars|argentina)\b/.test(t) ? "ARS"
    : /\b(gs\.?|guaran[ií]e?s?|ruc|timbrado|asunci[oó]n)\b|₲/.test(t) ? "PYG"
    : null;

  const brutos = (l: string) => (NAO_E_VALOR.test(l) || /\d{2}[/-]\d{2}[/-]\d{2,4}|\d{2}:\d{2}/.test(l) ? [] : (l.match(NUM_DINHEIRO) ?? []));
  const valoresDa = (l: string) => brutos(l).map(dinheiro);
  // "TOTAL A PAGAR" costuma vir numa linha e o valor na de baixo (faturas com caixas).
  const NAO_E_TOTAL = /sub\s*-?total|total\s*iz|qtd|quant|cantidad|\bite[nm]s?\b|descont|tributo|imposto|impuesto|\biva\b/i;
  const ehTotal = (l: string) => /total|a\s*pagar|importe|monto/i.test(l) && !NAO_E_TOTAL.test(l);
  // O que foi pago de fato, já com desconto: "VALOR A PAGAR", "TOTAL PAGO", "NETO A PAGAR".
  // O OCR troca "A" por "À"/"Á" e às vezes perde o "VALOR": basta "PAGAR" ou "PAGO" na linha.
  const ehPago = (l: string) => /pagar|(valor|total|monto|importe)\s*pago|neto|l[ií]quido/i.test(l) && !/descont|troco|vuelto/i.test(l);
  // Linha da forma de pagamento ("Cartao de Credito R$ 426,21"): também é o valor pago.
  const ehPagamento = (l: string) => /cart[aã]o|cr[eé]dito|d[eé]bito|dinheiro|\bpix\b|efectivo|tarjeta/i.test(l) && !/descont|troco|vuelto/i.test(l);
  const valoresDoRotulo = (l: string, i: number) => {
    const v = valoresDa(l);
    if (v.length) return v;
    // Só olha a linha de baixo quando o rótulo fecha a linha ("TOTAL A PAGAR", "Total:").
    return /(total|pagar|pago|importe|monto|neto|l[ií]quido)[\s:|.$R]*$/i.test(l) ? valoresDa(linhas[i + 1] ?? "") : [];
  };
  const comCentavos = (v: number[]) => (v.some((x) => !Number.isInteger(x)) ? v.filter((x) => !Number.isInteger(x)) : v);
  let pagos = comCentavos(linhas.flatMap((l, i) => (ehPago(l) ? valoresDoRotulo(l, i).slice(-1) : [])));
  if (!pagos.length) pagos = comCentavos(linhas.flatMap((l) => (ehPagamento(l) ? valoresDa(l).slice(-1) : [])));
  let totais = pagos.length ? [pagos.at(-1)!] : comCentavos(linhas.flatMap((l, i) => (ehTotal(l) ? valoresDoRotulo(l, i) : [])));
  // Sem "a pagar", mas com desconto na nota: total menos o desconto.
  if (!pagos.length && totais.length) {
    const desconto = linhas.flatMap((l, i) => (/^\s*desconto?\b/i.test(l) && !/item/i.test(l) ? valoresDoRotulo(l, i) : [])).at(-1);
    const total = Math.max(...totais);
    if (desconto && desconto < total) totais = [Math.round((total - desconto) * 100) / 100];
  }
  // Valores com centavos (471,65) ou milhar (2.145.000) valem mais que números soltos (leituras, CEP, matrícula).
  const candidatos = linhas.flatMap((l) => (/litros?|\blts?\b/i.test(l) ? [] : brutos(l)));
  const fortes = candidatos.filter((c) => /[.,]\d{2}$|\d\.\d{3}/.test(c) && !/\s/.test(c));
  const todos = (fortes.length ? fortes : candidatos).map(dinheiro);
  const lista = totais.length ? totais : todos;
  const valor = pagos.length ? totais[0] : lista.length ? Math.max(...lista) : null;

  const ml = /(\d+(?:[.,]\d+)?)\s*(?:l|lt|lts|litros?)\b/i.exec(texto);
  const ml2 = ml ? Number(ml[1].replace(",", ".")) : 0;
  // Um tanque de caminhão não passa de ~1.500 litros: acima disso é outro número lido errado.
  const litros = ml2 > 0 && ml2 <= 2000 ? ml2 : null;
  // Data do gasto: a mais recente que não está no futuro (o vencimento da fatura fica depois de hoje).
  const datas = [...texto.matchAll(/(\d{2})[/-](\d{2})[/-](\d{4}|\d{2})\b/g)]
    .map((m) => `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2]}-${m[1]}`)
    .filter((d) => !Number.isNaN(Date.parse(d)));
  const hojeIso = hoje.toISOString().slice(0, 10);
  const data = datas.filter((d) => d <= hojeIso).sort().at(-1) ?? null;
  const posto = linhas.find((l) => /[a-záéíóúç]{3,}/i.test(l) && !/\d{3,}/.test(l))?.slice(0, 80) ?? null;
  return { categoria, valor, moeda, litros, data, posto };
}
