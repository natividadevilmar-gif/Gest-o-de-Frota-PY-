// Receptor próprio dos rastreadores Teltonika do KM Cero.
// Fica ligado 24 horas num servidor na nuvem, escuta os aparelhos por TCP e grava
// cada posição no mesmo banco do site.
//
// Uso: npm run rastreador
// Variáveis: DATABASE_URL (obrigatória), PORTA_RASTREADOR (padrão 5027),
//            PORTA_SAUDE (padrão 8080, responde GET /saude para monitoramento).
import { createServer as criarTcp, type Socket } from "node:net";
import { createServer as criarHttp } from "node:http";
import { PrismaClient } from "@prisma/client";
import { confirmacao, lerImei, lerPacote, paraPosicao } from "../src/lib/rastreio/teltonika";

const db = new PrismaClient();
const PORTA = Number(process.env.PORTA_RASTREADOR ?? 5027);
const PORTA_SAUDE = Number(process.env.PORTA_SAUDE ?? 8080);
const OCIOSO_MS = 10 * 60 * 1000;

const conectados = new Map<string, Date>();
let gravadas = 0;

function log(...x: unknown[]) {
  console.log(new Date().toISOString(), ...x);
}

async function caminhaoDoImei(imei: string) {
  return db.caminhao.findFirst({ where: { rastreadorId: imei }, select: { id: true, placa: true } });
}

function atender(sock: Socket) {
  const origem = `${sock.remoteAddress}:${sock.remotePort}`;
  let buf = Buffer.alloc(0);
  let caminhao: { id: string; placa: string } | null = null;
  let imei = "";
  let ocupado = false;

  sock.setTimeout(OCIOSO_MS, () => sock.destroy());

  async function processar() {
    if (ocupado) return;
    ocupado = true;
    try {
      while (true) {
        if (!imei) {
          const r = lerImei(buf);
          if (!r) return;
          buf = buf.subarray(r.usados);
          imei = r.imei;
          caminhao = await caminhaoDoImei(imei);
          if (!caminhao) {
            log(`IMEI ${imei} (${origem}) não está cadastrado em nenhum caminhão: conexão recusada`);
            sock.end(Buffer.from([0x00]));
            return;
          }
          log(`${caminhao.placa} conectado (IMEI ${imei}, ${origem})`);
          sock.write(Buffer.from([0x01]));
          continue;
        }
        const pacote = lerPacote(buf);
        if (!pacote) return;
        buf = buf.subarray(pacote.usados);
        const linhas = pacote.registros.map((r) => ({ caminhaoId: caminhao!.id, ...paraPosicao(r) }));
        // Só confirmamos depois de gravar: se o banco falhar, o aparelho guarda e reenvia.
        await db.posicao.createMany({ data: linhas });
        const ultima = linhas.reduce((a, b) => (b.data > a.data ? b : a));
        await db.caminhao.updateMany({
          where: { id: caminhao!.id, OR: [{ ultimaPosicaoEm: null }, { ultimaPosicaoEm: { lt: ultima.data } }] },
          data: {
            ultimaPosicaoEm: ultima.data, ultimaLat: ultima.lat, ultimaLng: ultima.lng,
            ultimaVelocidade: ultima.velocidadeKmh, ultimaIgnicao: ultima.ignicao,
            ...(ultima.odometroKm ? { odometroKm: Math.round(ultima.odometroKm) } : {}),
          },
        });
        sock.write(confirmacao(linhas.length));
        gravadas += linhas.length;
        conectados.set(caminhao!.placa, new Date());
      }
    } catch (e) {
      log(`Erro com ${caminhao?.placa ?? origem}: ${(e as Error).message}`);
      sock.destroy();
    } finally {
      ocupado = false;
      if (!sock.destroyed && buf.length && imei) void processar();
    }
  }

  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    void processar();
  });
  sock.on("close", () => {
    if (caminhao) log(`${caminhao.placa} desconectado`);
  });
  sock.on("error", () => sock.destroy());
}

criarTcp(atender).listen(PORTA, () => log(`Receptor KM Cero escutando os rastreadores na porta ${PORTA}`));

criarHttp((req, res) => {
  if (req.url !== "/saude") { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, posicoesGravadas: gravadas, ultimosContatos: Object.fromEntries(conectados) }));
}).listen(PORTA_SAUDE);

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    await db.$disconnect();
    process.exit(0);
  });
}
