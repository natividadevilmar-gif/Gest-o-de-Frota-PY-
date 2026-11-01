import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { FIXOS, VARIAVEIS } from "@/lib/dre";
import { dreDoMes } from "@/lib/dreDados";
import { mesValido, nomeMes } from "@/lib/formato";
import { mesAtual } from "@/lib/indicadores";
import { pastaXlsx, respostaXlsx } from "@/lib/planilha";

const USD = "#,##0.00";

/** DRE do mês em Excel: a da empresa e a de cada caminhão, para o contador. */
export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return new Response("Sem permissão", { status: 403 });
  const mes = mesValido(new URL(req.url).searchParams.get("mes") ?? undefined, mesAtual());
  const { linhas, total: t } = await dreDoMes(cliente.id, mes);
  const titulo = (o: string) => `${o} · ${nomeMes(mes)} · ${cliente.nome}`;
  const empresa: [string, number][] = [
    ["Faturamento de fretes", t.receita],
    ...VARIAVEIS.map((k): [string, number] => [`(−) ${k}`, -t.variaveis[k]]),
    ["(−) Aduana, despachante e extras dos fretes", -t.extras],
    ["= Margem de contribuição", t.contribuicao],
    ...FIXOS.map((k): [string, number] => [`(−) ${k}`, -t.fixos[k]]),
    ["= Resultado da frota", t.resultadoFrota],
    ["(−) Despesas da empresa (contas pagas sem caminhão)", -t.administrativas],
    ["= Resultado líquido", t.liquido],
  ];
  const arquivo = await pastaXlsx([
    {
      nome: "DRE da empresa",
      titulo: titulo("Resultado do mês"),
      colunas: [{ titulo: "Conta", largura: 52 }, { titulo: "USD", largura: 16, formato: USD }, { titulo: "% do faturamento", largura: 18, formato: "0.0%" }],
      linhas: empresa.map(([n, v]) => [n, v, t.receita ? v / t.receita : null]),
    },
    {
      nome: "Por caminhão",
      titulo: titulo("Resultado por caminhão"),
      colunas: [
        { titulo: "Caminhão", largura: 12 }, { titulo: "Fretes" }, { titulo: "Km", formato: "#,##0" }, { titulo: "Faturamento", formato: USD },
        ...VARIAVEIS.map((k) => ({ titulo: k, formato: USD })), { titulo: "Extras dos fretes", formato: USD }, { titulo: "Contribuição", formato: USD },
        ...FIXOS.map((k) => ({ titulo: k, formato: USD })), { titulo: "Resultado", formato: USD }, { titulo: "Margem", formato: "0.0%" },
      ],
      linhas: linhas.map((l) => [
        l.placa, l.fretes, Math.round(l.km), l.receita, ...VARIAVEIS.map((k) => l.variaveis[k]), l.extras, l.contribuicao, ...FIXOS.map((k) => l.fixos[k]), l.resultado,
        l.margemPct === null ? null : l.margemPct / 100,
      ]),
      extras: [[
        "Total", linhas.reduce((s, l) => s + l.fretes, 0), Math.round(t.km), t.receita, ...VARIAVEIS.map((k) => t.variaveis[k]), t.extras, t.contribuicao,
        ...FIXOS.map((k) => t.fixos[k]), t.resultadoFrota, t.receita ? t.resultadoFrota / t.receita : null,
      ]],
    },
  ]);
  return respostaXlsx(arquivo, `resultado-${mes}-${cliente.nome.replace(/[^\w]+/g, "-").toLowerCase()}.xlsx`);
}
