// Confere a ligação com o Wialon: para cada cliente com conta Wialon, lista as unidades que
// o token enxerga e qual caminhão ficou ligado a cada uma (pelo IMEI).
// Com "espelhar", traz as posições novas.
// Uso: npm run wialon [espelhar]
// Variáveis: DATABASE_URL (e, para quem não tem token no cadastro, WIALON_TOKEN, WIALON_HOST, WIALON_CLIENTES).
import { PrismaClient } from "@prisma/client";
import { apiDoCliente, espelharWialon, ligarUnidades } from "../src/lib/rastreio/wialon";

const db = new PrismaClient();

async function main() {
  if (process.argv[2] === "espelhar") {
    const r = await espelharWialon(db);
    console.log(`${r.unidades} unidades no Wialon, ${r.gravadas} posições gravadas`);
    for (const e of r.erros) console.error(e);
    process.exitCode = r.erros.length ? 1 : 0;
    return;
  }
  const clientes = await db.cliente.findMany({ include: { caminhoes: { select: { placa: true, rastreadorId: true } } } });
  for (const cl of clientes) {
    const api = apiDoCliente(cl);
    if (!api) continue;
    const unidades = await api.unidades();
    console.log(`\n${cl.nome}: ${unidades.length} unidades`);
    const ligados = new Map(ligarUnidades(cl.caminhoes, unidades).map((p) => [p.unidade.id, p.caminhao.placa]));
    for (const u of unidades) {
      const ultima = u.lmsg ? new Date(u.lmsg.t * 1000).toISOString() : "sem mensagens";
      const params = Object.keys(u.lmsg?.p ?? {}).join(", ");
      console.log(`${u.nm} | IMEI ${u.uid ?? "?"} | ${ligados.get(u.id) ?? "sem caminhão"} | última: ${ultima}`);
      if (params) console.log(`   parâmetros: ${params}`);
    }
    await api.sair();
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
