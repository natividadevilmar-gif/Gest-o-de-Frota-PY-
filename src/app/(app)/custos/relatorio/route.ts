import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota } from "@/lib/dados";
import { mesValido } from "@/lib/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_FIXAS, mesAtual, planoPermite } from "@/lib/indicadores";

// Planilha do relatório de gastos por tipo. Separador ";" e vírgula decimal, como o Excel em português e espanhol espera.
export async function GET(req: Request) {
  const { cliente } = await clienteAtual();
  const mes = mesValido(new URL(req.url).searchParams.get("mes") ?? undefined, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "custos"));
  const colunas = [...CATEGORIAS_DESPESA, ...CATEGORIAS_FIXAS];
  const n = (v: number | null) => (v === null ? "" : v.toFixed(2).replace(".", ","));
  const linhas = [
    ["Placa", "Modelo", ...colunas.map((c) => `${c} (USD)`), "Total (USD)", "km", "USD/km"],
    ...ind.map((i) => [i.placa, i.modelo, ...colunas.map((c) => n(i.composicao[c] ?? 0)), n(i.custoTotal), String(Math.round(i.km)), n(i.custoKm)]),
  ];
  const csv = "﻿" + linhas.map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${mes}.csv"`,
    },
  });
}
