// Fluxo de caixa previsto: o que vai entrar (fretes a receber) e sair (contas a pagar e
// despesas do dia a dia da frota), semana a semana, a partir do saldo de hoje.

const DIA = 86_400_000;

export type Movimento = { data: Date; valor: number };

export type Semana = { inicio: Date; fim: Date; entradas: number; futuros: number; contas: number; despesas: number; saldo: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const diaUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Projeta `semanas` semanas a partir de hoje. Contas vencidas entram na primeira semana (precisam
 * ser pagas); fretes vencidos não entram (são cobrança, não dinheiro certo) e voltam à parte.
 */
export function projetarFluxo(o: {
  saldoInicial: number;
  hoje: Date;
  entradas: Movimento[];
  saidas: Movimento[];
  despesaDiaria: number;
  /** Fretes novos que ainda vão ser feitos (média diária recente), recebidos depois do prazo de pagamento. */
  receitaDiaria?: number;
  prazoRecebimentoDias?: number;
  semanas?: number;
}) {
  const n = o.semanas ?? 13;
  const d0 = diaUtc(o.hoje);
  const semana = (d: Date) => Math.floor((diaUtc(d) - d0) / (7 * DIA));
  const lista: Semana[] = Array.from({ length: n }, (_, i) => ({
    inicio: new Date(d0 + i * 7 * DIA),
    fim: new Date(d0 + (i * 7 + 6) * DIA),
    entradas: 0,
    contas: 0,
    despesas: r2(o.despesaDiaria * 7),
    futuros: 0,
    saldo: 0,
  }));
  // Fretes feitos a partir de hoje só viram dinheiro depois do prazo; até lá, contam os já lançados.
  const prazo = o.prazoRecebimentoDias ?? 30;
  for (let dia = 0; dia < n * 7; dia++) {
    const recebe = dia + prazo;
    if (recebe < n * 7) lista[Math.floor(recebe / 7)].futuros += o.receitaDiaria ?? 0;
  }
  let atrasado = 0;
  for (const e of o.entradas) {
    const i = semana(e.data);
    if (i < 0) atrasado += e.valor;
    else if (i < n) lista[i].entradas += e.valor;
  }
  for (const s of o.saidas) {
    const i = Math.max(0, semana(s.data));
    if (i < n) lista[i].contas += s.valor;
  }
  let saldo = o.saldoInicial;
  for (const s of lista) {
    s.entradas = r2(s.entradas);
    s.contas = r2(s.contas);
    s.futuros = r2(s.futuros);
    saldo = r2(saldo + s.entradas + s.futuros - s.contas - s.despesas);
    s.saldo = saldo;
  }
  const ate = (dias: number) => {
    const sem = lista.slice(0, Math.ceil(dias / 7));
    return {
      entradas: r2(sem.reduce((t, s) => t + s.entradas + s.futuros, 0)),
      saidas: r2(sem.reduce((t, s) => t + s.contas + s.despesas, 0)),
      saldo: sem.at(-1)?.saldo ?? o.saldoInicial,
    };
  };
  const menor = lista.reduce((m, s) => (s.saldo < m.saldo ? s : m), lista[0]);
  const primeiroNegativo = lista.find((s) => s.saldo < 0) ?? null;
  return { semanas: lista, atrasado: r2(atrasado), d30: ate(30), d60: ate(60), d90: ate(90), menor, primeiroNegativo };
}
