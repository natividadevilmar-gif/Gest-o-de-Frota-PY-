export function num(n: number | null | undefined, casas = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function usd(n: number | null | undefined, casas = 0): string {
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
