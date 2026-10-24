import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { caixasMotoristas, despesasMotorista, indicadoresFrota, viagensCliente } from "@/lib/dados";
import { mesValido, nomeMes } from "@/lib/formato";
import { mesAtual, NOME_CATEGORIA } from "@/lib/indicadores";
import { pastaXlsx, respostaXlsx, type Aba } from "@/lib/planilha";

// Planilha Excel com as despesas do motorista no mês, uma linha por lançamento.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return new Response("Sem permissão", { status: 403 });
  const mes = mesValido(new URL(req.url).searchParams.get("mes") ?? undefined, mesAtual());
  const dados = await despesasMotorista(cliente.id, (await params).id, mes);
  if (!dados) return new Response("Motorista não encontrado", { status: 404 });
  const { motorista, despesas } = dados;
  const origem = { manual: "digitado", foto: "foto", audio: "áudio" } as Record<string, string>;
  const total = despesas.reduce((a, d) => a + d.valorUsd, 0);
  const abaDespesas: Aba = {
    nome: "Despesas",
    titulo: `Despesas de ${motorista.nome} · ${nomeMes(mes)} · ${cliente.nome}`,
    colunas: [
      { titulo: "Data", formato: "dd/mm/yyyy" },
      { titulo: "Caminhão" },
      { titulo: "Tipo", largura: 20 },
      { titulo: "Litros", formato: "#,##0.0" },
      { titulo: "Km", formato: "#,##0" },
      { titulo: "Posto / local", largura: 22 },
      { titulo: "Descrição", largura: 30 },
      { titulo: "Moeda", largura: 8 },
      { titulo: "Valor pago", formato: "#,##0.00" },
      { titulo: "Valor (USD)", formato: "#,##0.00" },
      { titulo: "Lançado por", largura: 16 },
      { titulo: "Como", largura: 10 },
    ],
    linhas: despesas.map((d) => [
      d.data,
      d.caminhao.placa,
      NOME_CATEGORIA[d.categoria] ?? d.categoria,
      d.litros,
      d.odometroKm,
      d.posto,
      d.descricao,
      d.moeda,
      d.valorOriginal ?? d.valorUsd,
      d.valorUsd,
      d.usuario ? (d.usuario.papel === "MOTORISTA" ? "motorista" : d.usuario.nome) : null,
      origem[d.origem] ?? d.origem,
    ]),
    extras: [[], [null, null, null, null, null, null, null, null, "Total (USD)", total]],
  };
  // Fretes que ele fez no mês e os caixas de viagem dele.
  const ind = await indicadoresFrota(cliente.id, mes);
  const [fretes, caixas] = await Promise.all([viagensCliente(cliente.id, mes, ind), caixasMotoristas(cliente.id, { motoristaId: motorista.id })]);
  const seus = fretes.filter((f) => f.motoristaId === motorista.id).reverse();
  const usdF = "#,##0.00";
  const arquivo = await pastaXlsx([
    abaDespesas,
    {
      nome: "Fretes",
      titulo: `Fretes de ${motorista.nome} · ${nomeMes(mes)}`,
      colunas: [{ titulo: "Data", formato: "dd/mm/yyyy" }, { titulo: "Caminhão" }, { titulo: "Cliente", largura: 26 }, { titulo: "Origem", largura: 20 }, { titulo: "Destino", largura: 20 }, { titulo: "Produto", largura: 14 }, { titulo: "Toneladas", formato: "#,##0.00" }, { titulo: "Frete (USD)", formato: usdF }, { titulo: "Km", formato: "#,##0" }, { titulo: "Margem (USD)", formato: usdF }, { titulo: "Recebido", largura: 10 }],
      linhas: seus.map((f) => [f.data, f.caminhao.placa, f.embarcador, `${f.origem} (${f.paisOrigem})`, `${f.destino} (${f.paisDestino})`, f.carga, f.toneladas, f.freteUsd, f.kmCarregado + f.kmVazio, f.margem?.margemUsd ?? null, f.recebido ? "sim" : "não"]),
      extras: [[], [null, null, null, null, null, null, "Total (USD)", seus.reduce((a, f) => a + f.freteUsd, 0), null, seus.reduce((a, f) => a + (f.margem?.margemUsd ?? 0), 0)]],
    },
    {
      nome: "Caixa da viagem",
      titulo: `Caixa de viagem de ${motorista.nome}`,
      colunas: [{ titulo: "Entregue em", formato: "dd/mm/yyyy" }, { titulo: "Caminhão" }, { titulo: "Moeda", largura: 8 }, { titulo: "Entregue", formato: usdF }, { titulo: "Entregue (USD)", formato: usdF }, { titulo: "Gasto (USD)", formato: usdF }, { titulo: "Saldo (USD)", formato: usdF }, { titulo: "Despesas", formato: "0" }, { titulo: "Situação", largura: 12 }],
      linhas: caixas.map((c) => [c.data, c.caminhao?.placa ?? null, c.moeda, c.valorOriginal, c.valorUsd, c.gastoUsd, c.saldoUsd, c.nDespesas, c.aberto ? "aberto" : "encerrado"]),
    },
  ]);
  const nome = motorista.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/-+$/, "").toLowerCase();
  return respostaXlsx(arquivo, `motorista-${nome}-${mes}.xlsx`);
}
