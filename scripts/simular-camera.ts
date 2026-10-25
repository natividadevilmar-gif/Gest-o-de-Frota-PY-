// Finge ser uma câmera Teltonika DualCam para testar o recebimento de fotos e vídeos.
// Gera uma foto e um vídeo de teste com o ffmpeg e entrega quando o servidor pede.
//
// Uso: npm run simular:camera -- <IMEI> [servidor] [porta]
import { connect } from "node:net";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CMD, lerMensagemCamera, montarInicioCamera, montarMensagemCamera, montarPedacos, u32 } from "../src/lib/rastreio/dualcam";

const [imei, host = "localhost", porta = "5028"] = process.argv.slice(2);
if (!imei) {
  console.error("Uso: npm run simular:camera -- <IMEI> [servidor] [porta]");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "camera-"));
function gerar(saida: string, args: string[]): Buffer | null {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args, join(dir, saida)]);
  return r.status === 0 ? readFileSync(join(dir, saida)) : null;
}
const foto = gerar("foto.jpg", ["-f", "lavfi", "-i", "testsrc=size=1280x720", "-frames:v", "1"]);
const video = gerar("video.h265", ["-f", "lavfi", "-i", "testsrc=size=1280x720:rate=25", "-t", "5", "-c:v", "libx265", "-f", "hevc"]);
// Esta câmera de teste só tem a frontal.
const arquivos: Record<string, Buffer | null> = { "%photof": foto, "%videof": video };

const sock = connect(Number(porta), host, () => {
  console.log(`Câmera ${imei} conectada a ${host}:${porta}`);
  sock.write(montarInicioCamera(imei));
});

let buf = Buffer.alloc(0);
let pedacos: Buffer[] = [];
sock.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  for (let m = lerMensagemCamera(buf); m; m = lerMensagemCamera(buf)) {
    buf = buf.subarray(m.usados);
    if (m.cmd === CMD.pedirArquivo) {
      const id = m.dados.toString("ascii");
      const arq = arquivos[id];
      if (!arq) {
        console.log(`Servidor pediu ${id}: não disponível`);
        sock.write(montarMensagemCamera(CMD.situacao, u32(0x11)));
        continue;
      }
      pedacos = montarPedacos(arq);
      console.log(`Servidor pediu ${id}: ${pedacos.length} pedaços`);
      sock.write(montarMensagemCamera(CMD.inicio, Buffer.concat([u32(pedacos.length), Buffer.alloc(2)])));
    } else if (m.cmd === CMD.retomar) {
      const desde = m.dados.readUInt32BE(0);
      sock.write(montarMensagemCamera(CMD.sincronizar, u32(desde)));
      for (const p of pedacos.slice(desde - 1)) sock.write(p);
    } else if (m.cmd === CMD.repetirInicio) {
      sock.write(montarInicioCamera(imei));
    } else if (m.cmd === CMD.fechar) {
      console.log("Servidor encerrou a sessão");
      sock.end();
    }
  }
});
sock.on("close", () => process.exit(0));
sock.on("error", (e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
