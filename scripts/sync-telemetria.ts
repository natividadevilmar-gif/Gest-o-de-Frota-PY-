// Uso: npm run sync:telemetria [AAAA-MM-DD]   (padrão: ontem)
// Em produção, rodar uma vez por dia (cron) logo depois da meia-noite.
import { PrismaClient } from "@prisma/client";
import { fonteTelemetria } from "../src/lib/telemetria";
import { sincronizarDia } from "../src/lib/telemetria/sincronizar";

const db = new PrismaClient();
const arg = process.argv[2];
const dia = arg ? new Date(`${arg}T00:00:00Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 1));

const fonte = fonteTelemetria();
sincronizarDia(db, fonte, dia)
  .then(({ gravados, erros }) => {
    console.log(`${fonte.nome}: ${gravados} caminhões gravados em ${dia.toISOString().slice(0, 10)}`);
    for (const e of erros) console.error(e);
    process.exitCode = erros.length ? 1 : 0;
  })
  .finally(() => db.$disconnect());
