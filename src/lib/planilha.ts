import "server-only";
import ExcelJS from "exceljs";

export type Coluna = { titulo: string; largura?: number; formato?: string };

/** Planilha .xlsx com cabeçalho em negrito, filtro e primeira linha fixa. Linhas em `extras` vão ao fim, em negrito (totais). */
export async function planilhaXlsx(aba: string, titulo: string, colunas: Coluna[], linhas: (string | number | Date | null)[][], extras: (string | number | null)[][] = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(aba.slice(0, 31));
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
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function respostaXlsx(arquivo: Buffer, nome: string) {
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
