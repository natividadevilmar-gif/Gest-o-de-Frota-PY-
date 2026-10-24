import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { caixasMotoristas, indicadoresFrota, saldoEmpresa, saldoPorMes, viagensCliente } from "@/lib/dados";
import { db } from "@/lib/db";
import { mesValido, nomeMes } from "@/lib/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_FIXAS, intervaloMes, mesAtual, NOME_CATEGORIA } from "@/lib/indicadores";
import { pastaXlsx, respostaXlsx, type Coluna } from "@/lib/planilha";

const USD = "#,##0.00";
const DATA = "dd/mm/yyyy";

// Relatório geral da empresa no mês: resumo, despesas, fretes, margem e custos por caminhão, caixa dos motoristas e saldo mês a mês.
export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return new Response("Sem permissão", { status: 403 });
  const mes = mesValido(new URL(req.url).searchParams.get("mes") ?? undefined, mesAtual());
  const { inicio, fim } = intervaloMes(mes);
  const ind = await indicadoresFrota(cliente.id, mes);
  const [saldo, historico, fretes, caixas, despesas] = await Promise.all([
    saldoEmpresa(cliente.id, mes),
    saldoPorMes(cliente.id, mes, 12),
    viagensCliente(cliente.id, mes, ind),
    caixasMotoristas(cliente.id),
    db.despesa.findMany({
      where: { caminhao: { clienteId: cliente.id }, data: { gte: inicio, lt: fim } },
      include: { caminhao: { select: { placa: true, motorista: { select: { nome: true } } } }, usuario: { select: { nome: true, papel: true } } },
      omit: { recibo: true },
      orderBy: [{ data: "asc" }, { criadoEm: "asc" }],
    }),
  ]);
  const titulo = (o: string) => `${o} · ${nomeMes(mes)} · ${cliente.nome}`;
  const somaFrete = fretes.reduce((a, f) => a + f.freteUsd, 0);
  const somaCusto = fretes.reduce((a, f) => a + (f.margem?.custoUsd ?? 0), 0);
  const km = ind.reduce((a, i) => a + i.km, 0);
  const custoTotal = ind.reduce((a, i) => a + i.custoTotal, 0);
  const tipos = [...CATEGORIAS_DESPESA, ...CATEGORIAS_FIXAS];
  const origem: Record<string, string> = { manual: "digitado", foto: "foto", audio: "áudio" };

  const arquivo = await pastaXlsx([
    {
      nome: "Resumo",
      titulo: titulo("Resumo da empresa"),
      colunas: [{ titulo: "Indicador", largura: 34 }, { titulo: "Valor", largura: 18, formato: USD }, { titulo: "Observação", largura: 40 }],
      linhas: [
        ["Saldo do mês anterior (USD)", saldo.anterior, "acumulado até o fim do mês passado"],
        ["Fretes do mês (USD)", saldo.fretes, `${fretes.length} fretes`],
        ["Fretes a receber (USD)", saldo.aReceber, "fretes ainda não recebidos"],
        ["Despesas do mês (USD)", saldo.despesas, `${despesas.length} despesas, com custos extras das viagens`],
        ["Saldo em caixa (USD)", saldo.saldo, "saldo anterior + fretes − despesas"],
        ["Margem dos fretes (USD)", somaFrete - somaCusto, somaFrete ? `${((1 - somaCusto / somaFrete) * 100).toFixed(1).replace(".", ",")}% do frete` : null],
        ["Custo total da frota (USD)", custoTotal, "despesas + motorista, seguro e depreciação"],
        ["Km rodados", Math.round(km), `${ind.length} caminhões`],
        ["Custo por km (USD)", km ? custoTotal / km : null, null],
        ["Dinheiro com os motoristas (USD)", caixas.filter((c) => c.aberto).reduce((a, c) => a + c.saldoUsd, 0), "caixas de viagem abertos"],
      ],
    },
    {
      nome: "Despesas",
      titulo: titulo("Despesas"),
      colunas: [
        { titulo: "Data", formato: DATA }, { titulo: "Caminhão" }, { titulo: "Motorista", largura: 18 }, { titulo: "Tipo", largura: 20 },
        { titulo: "Litros", formato: "#,##0.0" }, { titulo: "Km", formato: "#,##0" }, { titulo: "Posto / local", largura: 22 }, { titulo: "Descrição", largura: 28 },
        { titulo: "Moeda", largura: 8 }, { titulo: "Valor pago", formato: USD }, { titulo: "Valor (USD)", formato: USD }, { titulo: "Lançado por", largura: 16 }, { titulo: "Como", largura: 10 },
      ] satisfies Coluna[],
      linhas: despesas.map((d) => [
        d.data, d.caminhao.placa, d.caminhao.motorista?.nome ?? null, NOME_CATEGORIA[d.categoria] ?? d.categoria, d.litros, d.odometroKm, d.posto, d.descricao,
        d.moeda, d.valorOriginal ?? d.valorUsd, d.valorUsd, d.usuario ? (d.usuario.papel === "MOTORISTA" ? "motorista" : d.usuario.nome) : null, origem[d.origem] ?? d.origem,
      ]),
      extras: [[], [null, null, null, null, null, null, null, null, null, "Total (USD)", despesas.reduce((a, d) => a + d.valorUsd, 0)]],
    },
    {
      nome: "Fretes",
      titulo: titulo("Fretes"),
      colunas: [
        { titulo: "Data", formato: DATA }, { titulo: "Entrega", formato: DATA }, { titulo: "Caminhão" }, { titulo: "Motorista", largura: 18 }, { titulo: "Cliente", largura: 26 },
        { titulo: "Documento", largura: 18 }, { titulo: "País origem", largura: 8 }, { titulo: "Origem", largura: 18 }, { titulo: "País destino", largura: 8 }, { titulo: "Destino", largura: 18 },
        { titulo: "Produto", largura: 14 }, { titulo: "Toneladas", formato: "#,##0.00" }, { titulo: "Moeda", largura: 8 }, { titulo: "Valor do frete", formato: USD }, { titulo: "Frete (USD)", formato: USD },
        { titulo: "Km carregado", formato: "#,##0" }, { titulo: "Km vazio", formato: "#,##0" }, { titulo: "Custos extras (USD)", formato: USD }, { titulo: "Custo (USD)", formato: USD },
        { titulo: "Margem (USD)", formato: USD }, { titulo: "Margem %", formato: "0.0" }, { titulo: "Recebido", largura: 10 }, { titulo: "Vencimento", formato: DATA },
      ] satisfies Coluna[],
      linhas: [...fretes].reverse().map((f) => [
        f.data, f.dataEntrega, f.caminhao.placa, f.motorista?.nome ?? null, f.embarcador, f.documento, f.paisOrigem, f.origem, f.paisDestino, f.destino,
        f.carga, f.toneladas, f.moeda, f.valorOriginal ?? f.freteUsd, f.freteUsd, f.kmCarregado, f.kmVazio, f.custosExtrasUsd,
        f.margem?.custoUsd ?? null, f.margem?.margemUsd ?? null, f.margem?.margemPct ?? null, f.recebido ? "sim" : "não", f.vencimento,
      ]),
      extras: [[], [null, null, null, null, null, null, null, null, null, null, null, null, null, "Total (USD)", somaFrete, null, null, null, somaCusto, somaFrete - somaCusto]],
    },
    {
      nome: "Margem por caminhão",
      titulo: titulo("Margem por caminhão"),
      colunas: [{ titulo: "Caminhão" }, { titulo: "Modelo", largura: 24 }, { titulo: "Fretes", formato: "0" }, { titulo: "Toneladas", formato: "#,##0.00" }, { titulo: "Km dos fretes", formato: "#,##0" }, { titulo: "Faturamento (USD)", formato: USD }, { titulo: "Custo (USD)", formato: USD }, { titulo: "Margem (USD)", formato: USD }, { titulo: "Margem %", formato: "0.0" }],
      linhas: ind
        .map((i) => {
          const fs = fretes.filter((f) => f.caminhaoId === i.id);
          const fr = fs.reduce((a, f) => a + f.freteUsd, 0);
          const cu = fs.reduce((a, f) => a + (f.margem?.custoUsd ?? 0), 0);
          return [i.placa, i.modelo, fs.length, fs.reduce((a, f) => a + f.toneladas, 0), fs.reduce((a, f) => a + f.kmCarregado + f.kmVazio, 0), fr, cu, fr - cu, fr ? ((fr - cu) / fr) * 100 : null];
        }),
    },
    {
      nome: "Custos por caminhão",
      titulo: titulo("Custos por tipo e caminhão"),
      colunas: [{ titulo: "Caminhão" }, { titulo: "Modelo", largura: 24 }, ...tipos.map((c) => ({ titulo: `${c} (USD)`, formato: USD })), { titulo: "Total (USD)", formato: USD }, { titulo: "Km", formato: "#,##0" }, { titulo: "USD/km", formato: "0.000" }],
      linhas: ind.map((i) => [i.placa, i.modelo, ...tipos.map((c) => i.composicao[c] ?? 0), i.custoTotal, Math.round(i.km), i.custoKm]),
      extras: [[], ["Total", null, ...tipos.map((c) => ind.reduce((a, i) => a + (i.composicao[c] ?? 0), 0)), custoTotal, Math.round(km), km ? custoTotal / km : null]],
    },
    {
      nome: "Caixa dos motoristas",
      titulo: `Caixa dos motoristas (abertos e últimos encerrados) · ${cliente.nome}`,
      colunas: [{ titulo: "Motorista", largura: 20 }, { titulo: "Caminhão" }, { titulo: "Entregue em", formato: DATA }, { titulo: "Moeda", largura: 8 }, { titulo: "Entregue", formato: USD }, { titulo: "Entregue (USD)", formato: USD }, { titulo: "Gasto (USD)", formato: USD }, { titulo: "Saldo (USD)", formato: USD }, { titulo: "Despesas", formato: "0" }, { titulo: "Situação", largura: 14 }, { titulo: "Observação", largura: 30 }],
      linhas: caixas.slice(0, 200).map((c) => [c.motorista.nome, c.caminhao?.placa ?? null, c.data, c.moeda, c.valorOriginal, c.valorUsd, c.gastoUsd, c.saldoUsd, c.nDespesas, c.aberto ? "aberto" : "encerrado", c.observacao]),
    },
    {
      nome: "Saldo mês a mês",
      titulo: `Saldo em caixa mês a mês · ${cliente.nome}`,
      colunas: [{ titulo: "Mês", largura: 18 }, { titulo: "Fretes (USD)", formato: USD }, { titulo: "Despesas (USD)", formato: USD }, { titulo: "Resultado (USD)", formato: USD }, { titulo: "Saldo acumulado (USD)", formato: USD }],
      linhas: historico.map((h) => [nomeMes(h.mes), h.fretes, h.despesas, h.resultado, h.saldo]),
    },
  ]);
  return respostaXlsx(arquivo, `relatorio-geral-${mes}.xlsx`);
}
