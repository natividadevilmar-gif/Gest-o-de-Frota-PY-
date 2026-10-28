// Receptor próprio dos rastreadores Teltonika do KM Cero.
// Fica ligado 24 horas num servidor na nuvem, escuta os aparelhos por TCP e grava
// cada posição no mesmo banco do site.
//
// Também envia os comandos da central (bloquear motor, pedir posição...) e recebe as
// fotos e vídeos das câmeras DualCam numa segunda porta.
//
// Uso: npm run rastreador
// Variáveis: DATABASE_URL (obrigatória), PORTA_RASTREADOR (padrão 5027),
//            PORTA_CAMERAS (padrão 5028), PORTA_SAUDE (padrão 8080, responde GET /saude).
//            WIALON_INTERVALO_S (padrão 60): de quanto em quanto tempo espelha as contas Wialon dos clientes.
import { createServer as criarTcp, type Socket } from "node:net";
import { createServer as criarHttp } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { confirmacao, lerImei, lerPacote, montarComando, paraPosicao } from "../src/lib/rastreio/teltonika";
import { efeitoNoMotor, ESPERA_RESPOSTA_MS, podeEnviar } from "../src/lib/comandos/catalogo";
import { espelharWialon } from "../src/lib/rastreio/wialon";
import { ARQUIVOS, ArquivoCamera, CMD, formatoArquivo, lerInicioCamera, lerMensagemCamera, montarMensagemCamera, u32 } from "../src/lib/rastreio/dualcam";

const db = new PrismaClient();
const PORTA = Number(process.env.PORTA_RASTREADOR ?? 5027);
const PORTA_CAMERAS = Number(process.env.PORTA_CAMERAS ?? 5028);
const PORTA_SAUDE = Number(process.env.PORTA_SAUDE ?? 8080);
const OCIOSO_MS = 10 * 60 * 1000;
const OLHAR_COMANDOS_MS = 5000;

const conectados = new Map<string, Date>();
let gravadas = 0;
let comandosEnviados = 0;
let midiasRecebidas = 0;
let wialonUltima: { em: Date; gravadas: number; erros: string[] } | null = null;

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
  // Comando enviado esperando a resposta do aparelho (um de cada vez).
  let emEspera: { id: string; tipo: string } | null = null;
  let vigia: NodeJS.Timeout | null = null;

  sock.setTimeout(OCIOSO_MS, () => sock.destroy());

  let enviando = false;
  async function enviarComandos() {
    if (!caminhao || sock.destroyed || enviando) return;
    enviando = true;
    try {
      if (emEspera) {
        const c = await db.comando.findUnique({ where: { id: emEspera.id }, select: { enviadoEm: true, status: true } });
        if (c?.status === "enviado" && c.enviadoEm && Date.now() - c.enviadoEm.getTime() > ESPERA_RESPOSTA_MS) {
          await db.comando.update({ where: { id: emEspera.id }, data: { status: "erro", resposta: "O aparelho não respondeu." } });
          emEspera = null;
        } else if (c?.status === "enviado") return;
        else emEspera = null;
      }
      const fila = await db.comando.findMany({ where: { caminhaoId: caminhao.id, status: { in: ["pendente", "aguardando"] } }, orderBy: { criadoEm: "asc" }, take: 5 });
      if (!fila.length) return;
      const vel = (await db.caminhao.findUnique({ where: { id: caminhao.id }, select: { ultimaVelocidade: true } }))?.ultimaVelocidade ?? 0;
      for (const c of fila) {
        if (!podeEnviar(c.tipo, vel)) {
          if (c.status !== "aguardando") await db.comando.update({ where: { id: c.id }, data: { status: "aguardando" } });
          continue;
        }
        // Grava antes de escrever no socket: a resposta pode chegar antes do update terminar.
        // O cpureset não tem resposta: o aparelho só reinicia.
        if (c.tipo === "reiniciar") {
          await db.comando.update({ where: { id: c.id }, data: { status: "respondido", enviadoEm: new Date(), respondidoEm: new Date(), resposta: "Enviado; o aparelho reinicia sem responder." } });
        } else {
          await db.comando.update({ where: { id: c.id }, data: { status: "enviado", enviadoEm: new Date() } });
          emEspera = { id: c.id, tipo: c.tipo };
        }
        sock.write(montarComando(c.texto));
        comandosEnviados++;
        log(`${caminhao.placa}: comando "${c.texto}" enviado`);
        if (emEspera) return;
      }
    } catch (e) {
      log(`Erro ao enviar comando para ${caminhao.placa}: ${(e as Error).message}`);
    } finally {
      enviando = false;
    }
  }

  async function guardarResposta(texto: string) {
    if (!caminhao) return;
    const alvo = emEspera ?? (await db.comando.findFirst({ where: { caminhaoId: caminhao.id, status: "enviado" }, orderBy: { enviadoEm: "asc" }, select: { id: true, tipo: true } }));
    emEspera = null;
    log(`${caminhao.placa}: resposta "${texto}"`);
    if (!alvo) return;
    await db.comando.update({ where: { id: alvo.id }, data: { status: "respondido", resposta: texto.slice(0, 1000), respondidoEm: new Date() } });
    const motor = efeitoNoMotor(alvo.tipo);
    if (motor !== null) await db.caminhao.update({ where: { id: caminhao.id }, data: { motorBloqueado: motor } });
    void enviarComandos();
  }

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
          vigia = setInterval(enviarComandos, OLHAR_COMANDOS_MS);
          void enviarComandos();
          continue;
        }
        const pacote = lerPacote(buf);
        if (!pacote) return;
        buf = buf.subarray(pacote.usados);
        if (pacote.resposta !== undefined) {
          await guardarResposta(pacote.resposta);
          continue;
        }
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
    if (vigia) clearInterval(vigia);
    if (caminhao) log(`${caminhao.placa} desconectado`);
  });
  sock.on("error", () => sock.destroy());
}

criarTcp(atender).listen(PORTA, () => log(`Receptor KM Cero escutando os rastreadores na porta ${PORTA}`));

// ---- Câmeras DualCam ----

// Próximo tipo de arquivo a pedir para cada câmera: a cada conexão o servidor pede
// os quatro (foto e vídeo, frontal e cabine); o que não existir a câmera recusa.
const proximoArquivo = new Map<string, number>();
const temFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

/** Vídeo da câmera vem em H.265 cru: convertido para MP4 (H.264) para tocar no navegador. */
function paraMp4(h265: Buffer): Buffer | null {
  if (!temFfmpeg) return null;
  const dir = mkdtempSync(join(tmpdir(), "kmcero-"));
  try {
    writeFileSync(join(dir, "v.h265"), h265);
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "hevc", "-r", "25", "-i", join(dir, "v.h265"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, "v.mp4")]);
    return r.status === 0 ? readFileSync(join(dir, "v.mp4")) : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function duracao(mp4: Buffer): number | null {
  if (!temFfmpeg) return null;
  const dir = mkdtempSync(join(tmpdir(), "kmcero-"));
  try {
    writeFileSync(join(dir, "v.mp4"), mp4);
    const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, "v.mp4")]);
    const s = Math.round(Number(r.stdout.toString().trim()));
    return Number.isFinite(s) && s > 0 ? s : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function guardarMidia(cam: { id: string; clienteId: string; placa: string }, arquivo: (typeof ARQUIVOS)[number], bruto: Buffer) {
  let conteudo = bruto;
  let formato = formatoArquivo(bruto);
  if (formato === "video/h265") {
    const mp4 = paraMp4(bruto);
    if (mp4) { conteudo = mp4; formato = "video/mp4"; }
  }
  const duracaoS = formato === "video/mp4" ? duracao(conteudo) : null;
  const agora = new Date();
  const [c, oc, pedido] = await Promise.all([
    db.caminhao.findUnique({ where: { id: cam.id }, select: { ultimaLat: true, ultimaLng: true, ultimaVelocidade: true } }),
    db.ocorrencia.findFirst({ where: { caminhaoId: cam.id, criadaEm: { gte: new Date(agora.getTime() - 5 * 60_000) } }, orderBy: { criadaEm: "desc" }, select: { id: true, tipo: true } }),
    db.comando.findFirst({ where: { caminhaoId: cam.id, tipo: { in: ["foto", "video"] }, criadoEm: { gte: new Date(agora.getTime() - 10 * 60_000) } }, select: { id: true } }),
  ]);
  await db.midia.create({
    data: {
      clienteId: cam.clienteId, caminhaoId: cam.id, ocorrenciaId: pedido ? null : oc?.id ?? null,
      tipo: arquivo.tipo, camera: arquivo.camera, gatilho: pedido ? "pedido" : oc?.tipo ?? "evento",
      data: agora, lat: c?.ultimaLat, lng: c?.ultimaLng, velocidadeKmh: c?.ultimaVelocidade,
      formato, conteudo, tamanho: conteudo.length, duracaoS,
    },
  });
  midiasRecebidas++;
  log(`${cam.placa}: ${arquivo.tipo === "foto" ? "foto" : "vídeo"} da câmera ${arquivo.camera} recebido (${Math.round(conteudo.length / 1024)} KB, ${formato})`);
}

function atenderCamera(sock: Socket) {
  const origem = `${sock.remoteAddress}:${sock.remotePort}`;
  let buf = Buffer.alloc(0);
  let cam: { id: string; clienteId: string; placa: string } | null = null;
  let imei = "";
  let arquivo: (typeof ARQUIVOS)[number] | null = null;
  let recebendo: ArquivoCamera | null = null;
  let pedidos = 0;
  let fila = Promise.resolve();

  sock.setTimeout(OCIOSO_MS, () => sock.destroy());

  function pedirProximo() {
    if (pedidos >= ARQUIVOS.length) {
      sock.end(montarMensagemCamera(CMD.fechar));
      return;
    }
    const i = proximoArquivo.get(imei) ?? 0;
    arquivo = ARQUIVOS[i % ARQUIVOS.length];
    proximoArquivo.set(imei, (i + 1) % ARQUIVOS.length);
    pedidos++;
    sock.write(montarMensagemCamera(CMD.pedirArquivo, Buffer.from(arquivo.id, "ascii")));
  }

  async function tratar(cmd: number, dados: Buffer) {
    if (cmd === CMD.fechar && dados.length >= 14) {
      const ini = lerInicioCamera(dados);
      imei = ini.imei;
      if (!cam) {
        const c = await db.caminhao.findFirst({ where: { rastreadorId: imei }, select: { id: true, clienteId: true, placa: true } });
        if (!c) {
          log(`Câmera com IMEI ${imei} (${origem}) não está em nenhum caminhão: conexão recusada`);
          sock.destroy();
          return;
        }
        cam = c;
        log(`${cam.placa}: câmera conectada (${origem})`);
      }
      pedirProximo();
    } else if (cmd === CMD.inicio) {
      recebendo = new ArquivoCamera(dados.readUInt32BE(0));
      sock.write(montarMensagemCamera(CMD.retomar, u32(1)));
    } else if (cmd === CMD.dados && recebendo && arquivo && cam) {
      if (!recebendo.receber(dados)) {
        // CRC errado: pede para continuar do último pedaço bom.
        sock.write(montarMensagemCamera(CMD.retomar, u32(recebendo.partes.length + 1)));
        return;
      }
      if (recebendo.completo) {
        await guardarMidia(cam, arquivo, recebendo.conteudo());
        recebendo = null;
        // Arquivo completo: pede para a câmera repetir o início e tenta o próximo tipo.
        sock.write(montarMensagemCamera(CMD.repetirInicio));
      }
    } else if (cmd === CMD.situacao) {
      const s = dados.length >= 4 ? dados.readUInt32BE(0) : 0;
      if (s !== 0) log(`${cam?.placa ?? origem}: câmera sem ${arquivo?.id ?? "arquivo"} (código ${s})`);
      recebendo = null;
      if (!sock.destroyed) pedirProximo();
    }
  }

  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    fila = fila.then(async () => {
      try {
        for (let m = lerMensagemCamera(buf); m; m = lerMensagemCamera(buf)) {
          buf = buf.subarray(m.usados);
          await tratar(m.cmd, m.dados);
        }
      } catch (e) {
        log(`Erro com a câmera ${cam?.placa ?? origem}: ${(e as Error).message}`);
        sock.destroy();
      }
    });
  });
  sock.on("close", () => {
    if (cam) log(`${cam.placa}: câmera desconectada`);
  });
  sock.on("error", () => sock.destroy());
}

criarTcp(atenderCamera).listen(PORTA_CAMERAS, () => log(`Câmeras DualCam na porta ${PORTA_CAMERAS}${temFfmpeg ? "" : " (sem ffmpeg: vídeos ficam em H.265)"}`));

criarHttp((req, res) => {
  if (req.url !== "/saude") { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, posicoesGravadas: gravadas, comandosEnviados, midiasRecebidas, ultimosContatos: Object.fromEntries(conectados), wialon: wialonUltima }));
}).listen(PORTA_SAUDE);

// Caminhões com rastreador no Wialon: as posições chegam por lá em vez de virem direto ao receptor.
{
  const intervalo = Number(process.env.WIALON_INTERVALO_S ?? 60) * 1000;
  let rodando = false;
  const espelhar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await espelharWialon(db);
      wialonUltima = { em: new Date(), gravadas: r.gravadas, erros: r.erros };
      if (r.gravadas || r.erros.length) log(`Wialon: ${r.gravadas} posições de ${r.unidades} unidades`, ...r.erros);
    } catch (e) {
      wialonUltima = { em: new Date(), gravadas: 0, erros: [(e as Error).message] };
      log(`Wialon: ${(e as Error).message}`);
    } finally {
      rodando = false;
    }
  };
  setInterval(espelhar, intervalo);
  void espelhar();
  log(`Espelhando o Wialon a cada ${intervalo / 1000} s`);
}

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    await db.$disconnect();
    process.exit(0);
  });
}
