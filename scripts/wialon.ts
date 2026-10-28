// Confere a ligação com o Wialon: lista as unidades que o token enxerga e qual caminhão
// do cadastro ficou ligado a cada uma (pelo IMEI). Com "espelhar", traz as posições novas.
// Uso: npm run wialon [espelhar]
// Variáveis: DATABASE_URL, WIALON_TOKEN, WIALON_HOST (padrão hst-api.wialon.com).
import { PrismaClient } from "@prisma/client";
import { espelharWialon, ligarUnidades, Wialon } from "../src/lib/rastreio/wialon";

const db = new PrismaClient();
const api = Wialon.doAmbiente();

async function main() {
  if (process.argv[2] === "espelhar") {
    const r = await espelharWialon(db, api);
    console.log(`${r.unidades} unidades no Wialon, ${r.gravadas} posições gravadas`);
    for (const e of r.erros) console.error(e);
    process.exitCode = r.erros.length ? 1 : 0;
    return;
  }
  const [unidades, caminhoes] = await Promise.all([
    api.unidades(),
    db.caminhao.findMany({ select: { placa: true, rastreadorId: true } }),
  ]);
  const ligados = new Map(ligarUnidades(caminhoes, unidades).map((p) => [p.unidade.id, p.caminhao.placa]));
  for (const u of unidades) {
    const ultima = u.lmsg ? new Date(u.lmsg.t * 1000).toISOString() : "sem mensagens";
    const params = Object.keys(u.lmsg?.p ?? {}).join(", ");
    console.log(`${u.nm} | IMEI ${u.uid ?? "?"} | ${ligados.get(u.id) ?? "sem caminhão"} | última: ${ultima}`);
    if (params) console.log(`   parâmetros: ${params}`);
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await api.sair();
    await db.$disconnect();
  });
