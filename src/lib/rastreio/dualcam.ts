// Protocolo das câmeras Teltonika DualCam / DashCam (envio de fotos e vídeos).
// O aparelho abre uma conexão própria para as câmeras, manda um pacote de início com
// o IMEI e o servidor pede os arquivos. Cada mensagem: comando (2 bytes), tamanho (2)
// e os dados. Os pedaços de arquivo (até 1024 bytes) terminam com um CRC-16.
// Referência: wiki da Teltonika, "DashCam Communication Protocol".

export const CMD = {
  fechar: 0x0000,
  inicio: 0x0001,
  retomar: 0x0002,
  sincronizar: 0x0003,
  dados: 0x0004,
  situacao: 0x0005,
  pedirArquivo: 0x0008,
  repetirInicio: 0x0009,
} as const;

/** Arquivos que o servidor pode pedir à câmera. */
export const ARQUIVOS = [
  { id: "%photof", tipo: "foto", camera: "frontal" },
  { id: "%photor", tipo: "foto", camera: "cabine" },
  { id: "%videof", tipo: "video", camera: "frontal" },
  { id: "%videor", tipo: "video", camera: "cabine" },
] as const;

export type MensagemCamera = { cmd: number; dados: Buffer; usados: number };

/**
 * Lê uma mensagem do início do buffer; null se ainda incompleta.
 * O pacote de início (cmd 0) do aparelho tem tamanho fixo de 14 bytes de dados.
 */
export function lerMensagemCamera(buf: Buffer): MensagemCamera | null {
  if (buf.length < 4) return null;
  const cmd = buf.readUInt16BE(0);
  const n = buf.readUInt16BE(2);
  if (buf.length < 4 + n) return null;
  return { cmd, dados: Buffer.from(buf.subarray(4, 4 + n)), usados: 4 + n };
}

export function montarMensagemCamera(cmd: number, dados: Buffer = Buffer.alloc(0)): Buffer {
  const cab = Buffer.alloc(4);
  cab.writeUInt16BE(cmd, 0);
  cab.writeUInt16BE(dados.length, 2);
  return Buffer.concat([cab, dados]);
}

/**
 * Pacote de início enviado pela câmera: versão do protocolo (2 bytes), IMEI (8 bytes,
 * número) e ajustes (4 bytes, quais arquivos estão disponíveis).
 */
export function lerInicioCamera(dados: Buffer): { protocolo: number; imei: string; ajustes: number } {
  if (dados.length < 14) throw new Error("Pacote de início da câmera incompleto");
  return { protocolo: dados.readUInt16BE(0), imei: dados.readBigUInt64BE(2).toString().padStart(15, "0"), ajustes: dados.readUInt32BE(10) };
}

export function montarInicioCamera(imei: string, ajustes = 0x0f, protocolo = 5): Buffer {
  const d = Buffer.alloc(14);
  d.writeUInt16BE(protocolo, 0);
  d.writeBigUInt64BE(BigInt(imei), 2);
  d.writeUInt32BE(ajustes, 10);
  return montarMensagemCamera(CMD.fechar, d);
}

/** CRC-16 dos pedaços de arquivo (polinômio 0x8408), encadeado com o CRC do pedaço anterior. */
export function crcCamera(dados: Buffer, anterior = 0): number {
  let crc = anterior;
  for (const b of dados) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return crc & 0xffff;
}

export const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

/** Divide um arquivo em mensagens de dados (usado pelo simulador e pelos testes). */
export function montarPedacos(arquivo: Buffer): Buffer[] {
  const pedacos: Buffer[] = [];
  let crc = 0;
  for (let i = 0; i < arquivo.length; i += 1024) {
    const parte = arquivo.subarray(i, i + 1024);
    crc = crcCamera(parte, crc);
    const fim = Buffer.alloc(2);
    fim.writeUInt16BE(crc);
    pedacos.push(montarMensagemCamera(CMD.dados, Buffer.concat([parte, fim])));
  }
  return pedacos;
}

/** Monta o arquivo recebido conferindo o CRC encadeado de cada pedaço. */
export class ArquivoCamera {
  partes: Buffer[] = [];
  private crc = 0;
  constructor(readonly total: number) {}
  /** Retorna false se o CRC não conferir (o servidor pede para retomar). */
  receber(dados: Buffer): boolean {
    const parte = dados.subarray(0, dados.length - 2);
    const crc = crcCamera(parte, this.crc);
    if (crc !== dados.readUInt16BE(dados.length - 2)) return false;
    this.crc = crc;
    this.partes.push(Buffer.from(parte));
    return true;
  }
  get completo() {
    return this.partes.length >= this.total;
  }
  conteudo() {
    return Buffer.concat(this.partes);
  }
}

/** Formato pelo começo do arquivo: JPEG ou vídeo H.265 cru. */
export function formatoArquivo(b: Buffer): string {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  return "video/h265";
}
