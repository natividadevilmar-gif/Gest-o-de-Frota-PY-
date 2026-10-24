import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota } from "@/lib/dados";
import { mesValido, nomeMes } from "@/lib/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_FIXAS, mesAtual, planoPermite } from "@/lib/indicadores";
import { planilhaXlsx, respostaXlsx } from "@/lib/planilha";

// Planilha Excel do relatório de gastos por tipo, um caminhão por linha.
export async function GET(req: Request) {
  const { cliente } = await clienteAtual();
  const mes = mesValido(new URL(req.url).searchParams.get("mes") ?? undefined, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "custos"));
  const colunas = [...CATEGORIAS_DESPESA, ...CATEGORIAS_FIXAS];
  const usd = "#,##0.00";
  const soma = (f: (i: (typeof ind)[number]) => number) => ind.reduce((a, i) => a + f(i), 0);
  const arquivo = await planilhaXlsx(
    "Gastos",
    `Gastos por tipo · ${nomeMes(mes)} · ${cliente.nome}`,
    [
      { titulo: "Placa" },
      { titulo: "Modelo", largura: 22 },
      ...colunas.map((c) => ({ titulo: `${c} (USD)`, formato: usd })),
      { titulo: "Total (USD)", formato: usd },
      { titulo: "km", formato: "#,##0" },
      { titulo: "USD/km", formato: "0.000" },
    ],
    ind.map((i) => [i.placa, i.modelo, ...colunas.map((c) => i.composicao[c] ?? 0), i.custoTotal, Math.round(i.km), i.custoKm]),
    [[], ["Total", null, ...colunas.map((c) => soma((i) => i.composicao[c] ?? 0)), soma((i) => i.custoTotal), Math.round(soma((i) => i.km)), null]],
  );
  return respostaXlsx(arquivo, `gastos-${mes}.xlsx`);
}
