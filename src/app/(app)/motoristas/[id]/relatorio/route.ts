import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { despesasMotorista } from "@/lib/dados";
import { mesValido, nomeMes } from "@/lib/formato";
import { mesAtual, NOME_CATEGORIA } from "@/lib/indicadores";
import { planilhaXlsx, respostaXlsx } from "@/lib/planilha";

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
  const arquivo = await planilhaXlsx(
    motorista.nome,
    `Despesas de ${motorista.nome} · ${nomeMes(mes)} · ${cliente.nome}`,
    [
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
    despesas.map((d) => [
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
    [[], [null, null, null, null, null, null, null, null, "Total (USD)", total]],
  );
  const nome = motorista.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/-+$/, "").toLowerCase();
  return respostaXlsx(arquivo, `despesas-${nome}-${mes}.xlsx`);
}
