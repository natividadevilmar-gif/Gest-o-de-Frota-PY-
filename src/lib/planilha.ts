import "server-only";
import ExcelJS from "exceljs";

export type Coluna = { titulo: string; largura?: number; formato?: string };

type Celula = string | number | Date | null;
export type Aba = { nome: string; titulo: string; colunas: Coluna[]; linhas: Celula[][]; extras?: Celula[][] };

/** Uma aba com cabeçalho em negrito, filtro e primeira linha fixa. Linhas em `extras` vão ao fim, em negrito (totais). */
function adicionarAba(wb: ExcelJS.Workbook, { nome, titulo, colunas, linhas, extras = [] }: Aba) {
  const ws = wb.addWorksheet(nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  ws.addRow([titulo]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const cab = ws.addRow(colunas.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } }));
  linhas.forEach((l) => ws.addRow(l));
  extras.forEach((l) => (ws.addRow(l).font = { bold: true }));
  colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.largura ?? Math.max(12, c.titulo.length + 2);
    if (c.formato) col.numFmt = c.formato;
  });
  ws.views = [{ state: "frozen", ySplit: 3 }];
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: colunas.length } };
}

/** Arquivo .xlsx com uma aba por item. */
export async function pastaXlsx(abas: Aba[]) {
  const wb = new ExcelJS.Workbook();
  abas.forEach((a) => adicionarAba(wb, a));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function planilhaXlsx(aba: string, titulo: string, colunas: Coluna[], linhas: Celula[][], extras: Celula[][] = []) {
  return pastaXlsx([{ nome: aba, titulo, colunas, linhas, extras }]);
}

export function respostaXlsx(arquivo: Buffer, nome: string) {
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
