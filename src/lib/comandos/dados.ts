import "server-only";
import { db } from "@/lib/db";
import { frotaNoMapa, type CaminhaoMapa } from "@/lib/rastreio/dados";
import { posicaoDemo } from "@/lib/rastreio/rotas";
import { ehImei } from "@/lib/telemetria/posicoes";
import { criarMidiaDemo } from "@/lib/video";
import { BLOQUEIO_ATIVO, efeitoNoMotor, ESPERA_RESPOSTA_MS, podeEnviar, type TipoComando } from "./catalogo";

// Nos caminhões com aparelho próprio, quem envia é o receptor (scripts/rastreador.ts).
// Nos de demonstração, a resposta é simulada aqui, alguns segundos depois do pedido.

const ENVIA_DEMO_MS = 1500;
const RESPONDE_DEMO_MS = 4000;

function respostaDemo(tipo: string, texto: string, p: { lat: number; lng: number; velocidadeKmh: number; direcao: number }, agora: Date): string {
  switch (tipo) {
    case "bloquear": return "DOUT1:1 DOUT2:0 Timeout:INFINITY";
    case "desbloquear": return "DOUT1:0 DOUT2:0 Timeout:INFINITY";
    case "posicao": return `GPS:1 Sat:11 Lat:${p.lat.toFixed(6)} Long:${p.lng.toFixed(6)} Alt:142 Speed:${p.velocidadeKmh} Dir:${Math.round(p.direcao)} Date:${agora.toISOString().slice(0, 19).replace("T", " ")}`;
    case "status": return "Data Link: 1 GPRS: 1 Phone: 0 SIM: 0 OP: 74402 Signal: 4 NewSMS: 0 Roaming: 0 SMSFull: 0 LAC: 1201 Cell ID: 30512";
    case "info": return `RTC:${agora.toISOString().slice(0, 19).replace("T", " ")} INI:2026/10/01 RST:0 GPS:1 SAT:11 TTFF:14 NOGPS:0 SR:0 FG:0 FL:0 SMS:0 REC:0 MD:0 DB:0`;
    case "reiniciar": return "Enviado; o aparelho reinicia sem responder.";
    case "foto": return "Foto recebida";
    case "video": return "Vídeo recebido";
    default: return `Recebido: ${texto}`;
  }
}

/** Avança os comandos: vence os sem resposta e simula a resposta dos caminhões de demonstração. */
/** Com o bloqueio desligado, pedidos de bloqueio ainda na fila não saem mais. */
async function cancelarBloqueios(clienteId: string | null) {
  await db.comando.updateMany({
    where: { tipo: "bloquear", status: { in: ["pendente", "aguardando"] }, ...(clienteId ? { clienteId } : {}) },
    data: { status: "cancelado", resposta: "Bloqueio do motor desativado na plataforma." },
  });
}

export async function processarComandos(clienteId: string | null, agora = new Date()) {
  if (!BLOQUEIO_ATIVO) await cancelarBloqueios(clienteId);
  await db.comando.updateMany({
    where: { status: "enviado", enviadoEm: { lt: new Date(agora.getTime() - ESPERA_RESPOSTA_MS) }, ...(clienteId ? { clienteId } : {}) },
    data: { status: "erro", resposta: "O aparelho não respondeu." },
  });
  const abertos = await db.comando.findMany({
    where: { status: { in: ["pendente", "aguardando", "enviado"] }, ...(clienteId ? { clienteId } : {}) },
    include: { caminhao: { select: { id: true, clienteId: true, rastreadorId: true, motorBloqueado: true, ultimaLat: true, ultimaLng: true } } },
    orderBy: { criadoEm: "asc" },
  });
  for (const c of abertos) {
    const cam = c.caminhao;
    if (!cam.rastreadorId || ehImei(cam.rastreadorId)) continue;
    const idade = agora.getTime() - c.criadoEm.getTime();
    if (idade < ENVIA_DEMO_MS) continue;
    const pos = cam.motorBloqueado && cam.ultimaLat != null && cam.ultimaLng != null
      ? { lat: cam.ultimaLat, lng: cam.ultimaLng, velocidadeKmh: 0, direcao: 0 }
      : posicaoDemo(cam.id, agora);
    if (!podeEnviar(c.tipo, pos.velocidadeKmh)) {
      if (c.status !== "aguardando") await db.comando.update({ where: { id: c.id }, data: { status: "aguardando" } });
      continue;
    }
    if (c.status !== "enviado") {
      await db.comando.update({ where: { id: c.id }, data: { status: "enviado", enviadoEm: agora } });
      continue;
    }
    if (agora.getTime() - (c.enviadoEm ?? agora).getTime() < RESPONDE_DEMO_MS - ENVIA_DEMO_MS) continue;
    await db.comando.update({ where: { id: c.id }, data: { status: "respondido", respondidoEm: agora, resposta: respostaDemo(c.tipo, c.texto, pos, agora) } });
    const motor = efeitoNoMotor(c.tipo);
    if (motor !== null) {
      await db.caminhao.update({ where: { id: cam.id }, data: { motorBloqueado: motor, ...(motor ? { ultimaLat: pos.lat, ultimaLng: pos.lng } : {}) } });
    }
    if (c.tipo === "foto" || c.tipo === "video") {
      await criarMidiaDemo({
        clienteId: cam.clienteId, caminhaoId: cam.id, tipo: c.tipo, camera: c.texto.startsWith("camreq:1,2") || c.texto.startsWith("camreq:0,2") ? "cabine" : "frontal",
        gatilho: "pedido", data: agora, lat: pos.lat, lng: pos.lng, velocidadeKmh: pos.velocidadeKmh, chave: `demo-cmd:${c.id}`,
      });
    }
  }
}

export type ComandoVista = {
  id: string; tipo: TipoComando; texto: string; status: string; resposta: string | null; motivo: string | null;
  criadoPor: string; criadoEm: string; respondidoEm: string | null; placa: string; caminhaoId: string; cliente: string;
};

export type CaminhaoComando = CaminhaoMapa & { aparelho: "proprio" | "demo" | "nenhum"; camera: boolean; conectado: boolean };

export async function dadosComandos(clienteId: string | null, agora = new Date()) {
  await processarComandos(clienteId, agora);
  const [frota, extras, historico] = await Promise.all([
    frotaNoMapa(clienteId, agora),
    db.caminhao.findMany({ where: clienteId ? { clienteId } : {}, select: { id: true, rastreadorId: true, plano: true, ultimaPosicaoEm: true } }),
    db.comando.findMany({
      where: clienteId ? { clienteId } : {},
      include: { caminhao: { select: { placa: true } }, cliente: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 80,
    }),
  ]);
  const porId = new Map(extras.map((e) => [e.id, e]));
  const caminhoes: CaminhaoComando[] = frota.map((c) => {
    const e = porId.get(c.id);
    const proprio = ehImei(e?.rastreadorId);
    return {
      ...c,
      aparelho: !e?.rastreadorId ? "nenhum" : proprio ? "proprio" : "demo",
      camera: e?.plano === "VIDEO",
      conectado: proprio ? !!e?.ultimaPosicaoEm && agora.getTime() - e.ultimaPosicaoEm.getTime() < 10 * 60_000 : !!e?.rastreadorId,
    };
  });
  const comandos: ComandoVista[] = historico.map((h) => ({
    id: h.id, tipo: h.tipo as TipoComando, texto: h.texto, status: h.status, resposta: h.resposta, motivo: h.motivo,
    criadoPor: h.criadoPor, criadoEm: h.criadoEm.toISOString(), respondidoEm: h.respondidoEm?.toISOString() ?? null,
    placa: h.caminhao.placa, caminhaoId: h.caminhaoId, cliente: h.cliente.nome,
  }));
  return { caminhoes, comandos };
}
