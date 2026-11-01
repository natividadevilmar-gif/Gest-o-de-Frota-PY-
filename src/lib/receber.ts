// Contas a receber: saldo de cada frete, situação da cobrança e mensagem para o WhatsApp.
import { dataBr } from "@/lib/formato";

const DIA = 86_400_000;

export type FreteAReceber = {
  id: string;
  embarcador: string | null;
  data: Date;
  vencimento: Date | null;
  freteUsd: number;
  recebido: boolean;
  recebidoUsd: number;
  origem: string;
  destino: string;
  documento: string | null;
  placa: string;
};

/** Saldo em aberto: zero quando o frete foi marcado como recebido. */
export function saldo(f: Pick<FreteAReceber, "freteUsd" | "recebido" | "recebidoUsd">): number {
  if (f.recebido) return 0;
  return Math.max(0, Math.round((f.freteUsd - f.recebidoUsd) * 100) / 100);
}

/** Dias até o vencimento (negativo = atrasado). Sem vencimento, conta 30 dias da data do frete. */
export function diasParaVencer(f: Pick<FreteAReceber, "vencimento" | "data">, hoje: Date): number {
  const venc = f.vencimento ?? new Date(f.data.getTime() + 30 * DIA);
  const d0 = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const d1 = Date.UTC(venc.getUTCFullYear(), venc.getUTCMonth(), venc.getUTCDate());
  return Math.round((d1 - d0) / DIA);
}

export type Situacao = { tipo: "vencido" | "hoje" | "semana" | "aberto"; dias: number };

export function situacao(f: Pick<FreteAReceber, "vencimento" | "data">, hoje: Date): Situacao {
  const dias = diasParaVencer(f, hoje);
  if (dias < 0) return { tipo: "vencido", dias: -dias };
  if (dias === 0) return { tipo: "hoje", dias: 0 };
  if (dias <= 7) return { tipo: "semana", dias };
  return { tipo: "aberto", dias };
}

export type GrupoCliente = {
  embarcador: string;
  fretes: (FreteAReceber & { saldo: number; situacao: Situacao })[];
  saldo: number;
  vencido: number;
  maiorAtraso: number;
};

/** Fretes em aberto agrupados por quem paga, com os mais atrasados primeiro. */
export function agruparPorCliente(fretes: FreteAReceber[], hoje: Date): GrupoCliente[] {
  const grupos = new Map<string, GrupoCliente>();
  for (const f of fretes) {
    const s = saldo(f);
    if (s <= 0) continue;
    const nome = f.embarcador?.trim() || "Sem cliente informado";
    const sit = situacao(f, hoje);
    const g = grupos.get(nome) ?? { embarcador: nome, fretes: [], saldo: 0, vencido: 0, maiorAtraso: 0 };
    g.fretes.push({ ...f, saldo: s, situacao: sit });
    g.saldo += s;
    if (sit.tipo === "vencido") {
      g.vencido += s;
      g.maiorAtraso = Math.max(g.maiorAtraso, sit.dias);
    }
    grupos.set(nome, g);
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.saldo = Math.round(g.saldo * 100) / 100;
    g.vencido = Math.round(g.vencido * 100) / 100;
    g.fretes.sort((a, b) => diasParaVencer(a, hoje) - diasParaVencer(b, hoje));
  }
  return lista.sort((a, b) => b.maiorAtraso - a.maiorAtraso || b.saldo - a.saldo);
}

export function totaisReceber(grupos: GrupoCliente[]) {
  const todos = grupos.flatMap((g) => g.fretes);
  const soma = (xs: { saldo: number }[]) => Math.round(xs.reduce((t, x) => t + x.saldo, 0) * 100) / 100;
  return {
    total: soma(todos),
    vencido: soma(todos.filter((f) => f.situacao.tipo === "vencido")),
    semana: soma(todos.filter((f) => f.situacao.tipo === "hoje" || f.situacao.tipo === "semana")),
    fretes: todos.length,
  };
}

const usd = (n: number) => `USD ${n.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Mensagem educada de cobrança, com cada frete, vencimento e saldo. Em espanhol, a língua dos embarcadores. */
export function mensagemCobranca(g: GrupoCliente, transportadora: string): string {
  const linhas = g.fretes.map((f) => {
    const doc = f.documento ? `${f.documento} · ` : "";
    const venc = f.vencimento ? `vence ${dataBr(f.vencimento)}` : `flete del ${dataBr(f.data)}`;
    const atraso = f.situacao.tipo === "vencido" ? ` (${f.situacao.dias} días de atraso)` : "";
    return `• ${doc}${f.origem} → ${f.destino}, ${f.placa}: ${usd(f.saldo)} · ${venc}${atraso}`;
  });
  return [
    `Buen día, ${g.embarcador}.`,
    `Le escribimos de ${transportadora} sobre los fletes pendientes de pago:`,
    "",
    ...linhas,
    "",
    `Total: ${usd(g.saldo)}`,
    "Si ya realizó el pago, por favor envíenos el comprobante. ¡Muchas gracias!",
  ].join("\n");
}
