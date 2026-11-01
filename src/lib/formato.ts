export function num(n: number | null | undefined, casas = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function usd(n: number | null | undefined, casas = 2): string {
  return n === null || n === undefined ? "–" : `USD ${num(n, casas)}`;
}

export function dataBr(d: Date): string {
  return d.toISOString().slice(0, 10).split("-").reverse().join("/");
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${nomes[m - 1]} de ${a}`;
}

export function mesValido(mes: string | undefined, padrao: string): string {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : padrao;
}

/** Lê um valor digitado no jeito brasileiro/paraguaio ("1.234,56") ou com ponto decimal ("1234.56"). */
export function lerValor(texto: string): number {
  const s = texto.replace(/[^\d.,-]/g, "");
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  // Só pontos: "1.234" ou "1.234.567" são milhares; "12.5" é decimal.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}
