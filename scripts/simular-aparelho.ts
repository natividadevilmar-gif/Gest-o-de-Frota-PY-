// Finge ser um rastreador Teltonika rodando numa rota real, para testar o receptor
// sem caminhão. Fala o mesmo protocolo do aparelho (Codec 8 Extended).
//
// Uso: npm run simular:aparelho -- <IMEI> [servidor] [porta] [vezes]
//   vezes: quantos minutos de viagem cada pacote representa (padrão 10, para ver o
//   caminhão andar no mapa em poucos minutos).
import { connect } from "node:net";
import { IO, montarImei, montarPacote, type Registro } from "../src/lib/rastreio/teltonika";
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

function registro(eventoIo = 0, extra: [number, bigint][] = []): Registro {
  const vel = Math.round(60 + Math.random() * 25);
  const avanco = (vel * passoS * Number(vezes)) / 3600;
  km += avanco;
  odometroM += Math.round(avanco * 1000);
  combustivelDl += Math.round((avanco / 2.5) * 10);
  const p = pontoNaRota(rota.pontos, km);
  return {
    data: new Date(), prioridade: eventoIo ? 1 : 0, lat: p.lat, lng: p.lng, altitude: 150, direcao: p.direcao,
    satelites: 11, velocidadeKmh: vel, eventoIo,
    io: new Map<number, bigint | Buffer>([
      [IO.ignicao, 1n], [IO.odometroCan, BigInt(odometroM)], [IO.combustivelCan, BigInt(combustivelDl)],
      [IO.rpm, BigInt(1200 + Math.round(Math.random() * 600))], ...extra,
    ]),
  };
}

const sock = connect(Number(porta), host, () => {
  console.log(`Conectado a ${host}:${porta} como ${imei}, rota ${rota.nome}`);
  sock.write(montarImei(imei));
});

let aceito = false;
sock.on("data", (d) => {
  if (!aceito) {
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
    return;
  }
  console.log(`Servidor confirmou ${d.readUInt32BE(0)} registro(s) · km ${km.toFixed(1)} de ${rota.nome}`);
});
sock.on("close", () => {
  console.log("Conexão encerrada");
  process.exit(0);
});
sock.on("error", (e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
