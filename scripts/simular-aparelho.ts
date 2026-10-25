// Finge ser um rastreador Teltonika rodando numa rota real, para testar o receptor
// sem caminhão. Fala o mesmo protocolo do aparelho (Codec 8 Extended) e responde aos
// comandos da central (Codec 12): "setdigout 1" bloqueia o motor e o caminhão para.
//
// Uso: npm run simular:aparelho -- <IMEI> [servidor] [porta] [vezes]
//   vezes: quantos minutos de viagem cada pacote representa (padrão 10, para ver o
//   caminhão andar no mapa em poucos minutos).
import { connect } from "node:net";
import { IO, lerPacote, montarImei, montarPacote, montarRespostaComando, type Registro } from "../src/lib/rastreio/teltonika";
import { pontoNaRota, ROTAS } from "../src/lib/rastreio/rotas";

const [imei, host = "localhost", porta = "5027", vezes = "10"] = process.argv.slice(2);
if (!imei) {
  console.error("Uso: npm run simular:aparelho -- <IMEI> [servidor] [porta] [vezes]");
  process.exit(1);
}

const rota = ROTAS[Number(imei.slice(-1)) % ROTAS.length];
let km = 0;
let odometroM = 412_000_000 + Number(imei.slice(-4)) * 1000;
let combustivelDl = 1_500_000;
const passoS = 10;
let bloqueado = false;

function registro(eventoIo = 0, extra: [number, bigint][] = []): Registro {
  const vel = bloqueado ? 0 : Math.round(60 + Math.random() * 25);
  const avanco = (vel * passoS * Number(vezes)) / 3600;
  km += avanco;
  odometroM += Math.round(avanco * 1000);
  combustivelDl += Math.round((avanco / 2.5) * 10);
  const p = pontoNaRota(rota.pontos, km);
  return {
    data: new Date(), prioridade: eventoIo ? 1 : 0, lat: p.lat, lng: p.lng, altitude: 150, direcao: p.direcao,
    satelites: 11, velocidadeKmh: vel, eventoIo,
    io: new Map<number, bigint | Buffer>([
      [IO.ignicao, bloqueado ? 0n : 1n], [IO.odometroCan, BigInt(odometroM)], [IO.combustivelCan, BigInt(combustivelDl)],
      [IO.rpm, BigInt(1200 + Math.round(Math.random() * 600))], ...extra,
    ]),
  };
}

const sock = connect(Number(porta), host, () => {
  console.log(`Conectado a ${host}:${porta} como ${imei}, rota ${rota.nome}`);
  sock.write(montarImei(imei));
});

function responder(cmd: string): string {
  const p = pontoNaRota(rota.pontos, km);
  if (cmd === "setdigout 1") { bloqueado = true; return "DOUT1:1 DOUT2:0 Timeout:INFINITY"; }
  if (cmd === "setdigout 0") { bloqueado = false; return "DOUT1:0 DOUT2:0 Timeout:INFINITY"; }
  if (cmd === "getgps") return `GPS:1 Sat:11 Lat:${p.lat.toFixed(6)} Long:${p.lng.toFixed(6)} Alt:150 Speed:${bloqueado ? 0 : 72} Dir:${p.direcao}`;
  if (cmd === "getstatus") return "Data Link: 1 GPRS: 1 Phone: 0 SIM: 0 OP: 74402 Signal: 4 NewSMS: 0 Roaming: 0 SMSFull: 0";
  if (cmd === "getinfo") return `RTC:${new Date().toISOString()} INI:simulador RST:0 GPS:1 SAT:11 TTFF:12`;
  if (cmd.startsWith("camreq")) return "Camera request accepted";
  return `Comando desconhecido: ${cmd}`;
}

let aceito = false;
let pendente = Buffer.alloc(0);
sock.on("data", (d) => {
  if (aceito) {
    // Depois do aceite chegam confirmações (4 bytes, nunca zero) e comandos (começam com zeros).
    pendente = Buffer.concat([pendente, d]);
    while (pendente.length >= 4) {
      if (pendente.readUInt32BE(0) !== 0) {
        console.log(`Servidor confirmou ${pendente.readUInt32BE(0)} registro(s) · km ${km.toFixed(1)} de ${rota.nome}${bloqueado ? " · MOTOR BLOQUEADO" : ""}`);
        pendente = pendente.subarray(4);
        continue;
      }
      const cmd = lerPacote(pendente);
      if (!cmd) break;
      pendente = pendente.subarray(cmd.usados);
      const resposta = responder(cmd.resposta ?? "");
      console.log(`Comando recebido: "${cmd.resposta}" → "${resposta}"`);
      if (cmd.resposta !== "cpureset") sock.write(montarRespostaComando(resposta));
    }
    return;
  }
  if (d[0] !== 1) {
    console.error("Servidor recusou o IMEI: cadastre-o no campo Rastreador do caminhão.");
    sock.end();
    return;
  }
  aceito = true;
  console.log("IMEI aceito, enviando posições a cada", passoS, "segundos");
  const enviar = () => {
    const evento = Math.random() < 0.08;
    const regs = evento ? [registro(IO.conducao, [[IO.conducao, 2n]])] : [registro()];
    sock.write(montarPacote(regs));
  };
  enviar();
  setInterval(enviar, passoS * 1000);
});
sock.on("close", () => {
  console.log("Conexão encerrada");
  process.exit(0);
});
sock.on("error", (e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
