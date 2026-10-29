// Lê a planilha da frota do cliente (uma linha por caminhão) para cadastrar os motoristas.
// Procura o cabeçalho pelos nomes das colunas, então a ordem e as linhas de título não importam.

export type LinhaFrota = { placa: string; nome: string; documento: string | null };

const COL_MOTORISTA = /chofer|conductor|condutor|motorista/i;
const COL_PLACA = /chapa|placa/i;
const COL_DOCUMENTO = /^\s*(c\.?\s*i\.?|ci|c[eé]dula|documento|rg|cpf)\s*$/i;

/** Placa sem espaço, hífen ou ponto, para comparar "AAEA-700" com "AAEA 700". */
export const placaChave = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "del", "la", "y", "e"]);

/** "ORLANDO ADRIAN DE JESUS" → "Orlando Adrian de Jesus". */
export function nomeProprio(s: string) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

export function lerPlanilhaFrota(linhas: unknown[][]): LinhaFrota[] | null {
  const i = linhas.findIndex((l) => l.some((c) => COL_MOTORISTA.test(texto(c))) && l.some((c) => COL_PLACA.test(texto(c))));
  if (i < 0) return null;
  const cab = linhas[i].map(texto);
  // A primeira coluna de placa é a do caminhão (a segunda costuma ser a da carreta).
  const cPlaca = cab.findIndex((c) => COL_PLACA.test(c));
  const cNome = cab.findIndex((c) => COL_MOTORISTA.test(c));
  const cDoc = cab.findIndex((c) => COL_DOCUMENTO.test(c));
  const r: LinhaFrota[] = [];
  for (const l of linhas.slice(i + 1)) {
    const placa = texto(l[cPlaca]);
    const nome = texto(l[cNome]);
    if (!placaChave(placa) || nome.length < 2) continue;
    const doc = cDoc >= 0 ? texto(l[cDoc]).replace(/\.0$/, "") : "";
    r.push({ placa: placa.toUpperCase(), nome: nomeProprio(nome), documento: doc || null });
  }
  return r;
}
