// Protocolo dos aparelhos Teltonika (FMB, FMC, FMM...) em TCP: Codec 8 e Codec 8 Extended.
// O aparelho abre a conexão, manda o IMEI, espera o "aceito" (0x01) e depois envia
// pacotes de registros AVL. Cada pacote é respondido com o número de registros aceitos.

export type Registro = {
  data: Date;
  prioridade: number;
  lat: number;
  lng: number;
  altitude: number;
  direcao: number;
  satelites: number;
  velocidadeKmh: number;
  /** IO que disparou o registro (0 quando é um registro periódico). */
  eventoIo: number;
  io: Map<number, bigint | Buffer>;
};

/** CRC-16/IBM usado pela Teltonika (polinômio 0xA001, início 0). */
export function crc16(buf: Buffer): number {
  let crc = 0;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

/** Lê o IMEI da primeira mensagem (2 bytes de tamanho + texto). Null se ainda incompleto. */
export function lerImei(buf: Buffer): { imei: string; usados: number } | null {
  if (buf.length < 2) return null;
  const n = buf.readUInt16BE(0);
  if (buf.length < 2 + n) return null;
  return { imei: buf.subarray(2, 2 + n).toString("ascii"), usados: 2 + n };
}

/**
 * Lê um pacote AVL completo do início do buffer.
 * Retorna null se o pacote ainda não chegou inteiro; lança erro se estiver corrompido.
 */
export function lerPacote(buf: Buffer): { registros: Registro[]; usados: number; resposta?: string } | null {
  if (buf.length < 8) return null;
  if (buf.readUInt32BE(0) !== 0) throw new Error("Pacote sem o preâmbulo de zeros");
  const tamanho = buf.readUInt32BE(4);
  const total = 8 + tamanho + 4;
  if (buf.length < total) return null;
  const dados = buf.subarray(8, 8 + tamanho);
  const crc = buf.readUInt32BE(8 + tamanho);
  if (crc16(dados) !== crc) throw new Error("CRC do pacote não confere");

  const codec = dados[0];
  if (codec === 0x0c) return { registros: [], usados: total, resposta: lerCodec12(dados) };
  if (codec !== 0x08 && codec !== 0x8e) throw new Error(`Codec não suportado: 0x${codec.toString(16)}`);
  const estendido = codec === 0x8e;
  const qtd = dados[1];
  let p = 2;
  const u8 = () => dados[p++];
  const u16 = () => { const v = dados.readUInt16BE(p); p += 2; return v; };
  const id = () => (estendido ? u16() : u8());
  const cont = () => (estendido ? u16() : u8());

  const registros: Registro[] = [];
  for (let r = 0; r < qtd; r++) {
    const data = new Date(Number(dados.readBigUInt64BE(p))); p += 8;
    const prioridade = u8();
    const lng = dados.readInt32BE(p) / 1e7; p += 4;
    const lat = dados.readInt32BE(p) / 1e7; p += 4;
    const altitude = dados.readInt16BE(p); p += 2;
    const direcao = u16();
    const satelites = u8();
    const velocidadeKmh = u16();
    const eventoIo = id();
    cont(); // total de IOs
    const io = new Map<number, bigint | Buffer>();
    for (const bytes of [1, 2, 4, 8]) {
      const n = cont();
      for (let i = 0; i < n; i++) {
        const k = id();
        const v = bytes === 1 ? BigInt(dados[p]) : bytes === 2 ? BigInt(dados.readUInt16BE(p)) : bytes === 4 ? BigInt(dados.readUInt32BE(p)) : dados.readBigUInt64BE(p);
        p += bytes;
        io.set(k, v);
      }
    }
    if (estendido) {
      const n = u16();
      for (let i = 0; i < n; i++) {
        const k = u16();
        const len = u16();
        io.set(k, Buffer.from(dados.subarray(p, p + len)));
        p += len;
      }
    }
    registros.push({ data, prioridade, lat, lng, altitude, direcao, satelites, velocidadeKmh, eventoIo, io });
  }
  if (dados[p] !== qtd) throw new Error("Número de registros no fim do pacote não confere");
  return { registros, usados: total };
}

// ---- Codec 12: comandos do servidor para o aparelho (ex.: "setdigout 1") ----
// Mesmo envelope dos pacotes AVL: zeros, tamanho, 0x0C, 1, tipo (5 = comando,
// 6 = resposta), tamanho do texto, texto, 1 e CRC.

function lerCodec12(dados: Buffer): string {
  if (dados[1] !== 1 || dados.at(-1) !== 1) throw new Error("Codec 12 com quantidade inválida");
  const n = dados.readUInt32BE(3);
  return dados.subarray(7, 7 + n).toString("ascii").trim();
}

function montarCodec12(tipo: 5 | 6, texto: string): Buffer {
  const txt = Buffer.from(texto, "ascii");
  const dados = Buffer.alloc(3 + 4 + txt.length + 1);
  dados[0] = 0x0c;
  dados[1] = 1;
  dados[2] = tipo;
  dados.writeUInt32BE(txt.length, 3);
  txt.copy(dados, 7);
  dados[7 + txt.length] = 1;
  const cab = Buffer.alloc(8);
  cab.writeUInt32BE(dados.length, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc16(dados));
  return Buffer.concat([cab, dados, crc]);
}

/** Comando de texto do servidor para o aparelho. */
export const montarComando = (texto: string) => montarCodec12(5, texto);
/** Resposta do aparelho a um comando (usada pelo simulador e pelos testes). */
export const montarRespostaComando = (texto: string) => montarCodec12(6, texto);

/** Resposta ao pacote: número de registros aceitos, em 4 bytes. */
export function confirmacao(qtd: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(qtd);
  return b;
}

/** Monta um pacote Codec 8 Extended (usado pelo simulador e pelos testes). */
export function montarPacote(registros: Registro[]): Buffer {
  const partes: Buffer[] = [Buffer.from([0x8e, registros.length])];
  for (const r of registros) {
    const cab = Buffer.alloc(8 + 1 + 15);
    cab.writeBigUInt64BE(BigInt(r.data.getTime()), 0);
    cab.writeUInt8(r.prioridade, 8);
    cab.writeInt32BE(Math.round(r.lng * 1e7), 9);
    cab.writeInt32BE(Math.round(r.lat * 1e7), 13);
    cab.writeInt16BE(r.altitude, 17);
    cab.writeUInt16BE(r.direcao, 19);
    cab.writeUInt8(r.satelites, 21);
    cab.writeUInt16BE(r.velocidadeKmh, 22);
    partes.push(cab);

    const grupos = new Map<number, [number, bigint][]>([[1, []], [2, []], [4, []], [8, []]]);
    const variaveis: [number, Buffer][] = [];
    for (const [k, v] of r.io) {
      if (Buffer.isBuffer(v)) variaveis.push([k, v]);
      else grupos.get(v < 256n ? 1 : v < 65536n ? 2 : v < 4294967296n ? 4 : 8)!.push([k, v]);
    }
    const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
    partes.push(u16(r.eventoIo), u16(r.io.size));
    for (const [bytes, itens] of grupos) {
      partes.push(u16(itens.length));
      for (const [k, v] of itens) {
        const b = Buffer.alloc(bytes);
        if (bytes === 1) b.writeUInt8(Number(v));
        else if (bytes === 2) b.writeUInt16BE(Number(v));
        else if (bytes === 4) b.writeUInt32BE(Number(v));
        else b.writeBigUInt64BE(v);
        partes.push(u16(k), b);
      }
    }
    partes.push(u16(variaveis.length));
    for (const [k, v] of variaveis) partes.push(u16(k), u16(v.length), v);
  }
  partes.push(Buffer.from([registros.length]));
  const dados = Buffer.concat(partes);
  const cab = Buffer.alloc(8);
  cab.writeUInt32BE(dados.length, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc16(dados));
  return Buffer.concat([cab, dados, crc]);
}

/** Mensagem inicial com o IMEI. */
export function montarImei(imei: string): Buffer {
  const b = Buffer.alloc(2 + imei.length);
  b.writeUInt16BE(imei.length);
  b.write(imei, 2, "ascii");
  return b;
}

// Números de IO dos aparelhos Teltonika usados pelo KM Cero. Conferir no
// Teltonika Configurator do modelo comprado; se algum mudar, basta ajustar aqui.
export const IO = {
  ignicao: 239,
  odometroGps: 16, // metros
  odometroCan: 87, // metros (rede CAN)
  combustivelCan: 83, // litros × 10 consumidos (rede CAN)
  rpm: 85,
  conducao: 253, // 1 aceleração brusca, 2 freada brusca, 3 curva brusca
  excesso: 255, // excesso de velocidade (km/h no momento do evento)
} as const;

const num = (v: bigint | Buffer | undefined) => (typeof v === "bigint" ? Number(v) : undefined);

/** Converte um registro do aparelho para a linha gravada em Posicao. */
export function paraPosicao(r: Registro) {
  const odoM = num(r.io.get(IO.odometroCan)) ?? num(r.io.get(IO.odometroGps));
  const comb = num(r.io.get(IO.combustivelCan));
  const ign = num(r.io.get(IO.ignicao));
  const conducao = r.eventoIo === IO.conducao ? num(r.io.get(IO.conducao)) : undefined;
  const evento =
    r.eventoIo === IO.excesso ? "excesso" : conducao === 1 ? "aceleracao" : conducao === 2 ? "freada" : conducao === 3 ? "curva" : null;
  return {
    data: r.data,
    lat: r.lat,
    lng: r.lng,
    velocidadeKmh: r.velocidadeKmh,
    direcao: r.direcao,
    satelites: r.satelites,
    ignicao: ign === undefined ? null : ign === 1,
    odometroKm: odoM === undefined ? null : odoM / 1000,
    litrosTotal: comb === undefined ? null : comb / 10,
    rpm: num(r.io.get(IO.rpm)) ?? null,
    evento,
  };
}
