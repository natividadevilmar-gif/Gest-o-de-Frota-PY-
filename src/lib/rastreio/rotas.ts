// Rotas reais do Paraguai usadas pelo simulador de aparelho e pela demonstração do mapa
// enquanto os caminhões ainda não têm rastreador instalado.

export type Ponto = { lat: number; lng: number };
export type PosicaoSimulada = Ponto & { velocidadeKmh: number; direcao: number; ignicao: boolean; data: Date; rpm: number; local: string };

export const ROTAS: { nome: string; pontos: Ponto[] }[] = [
  {
    nome: "Asunción → Ciudad del Este (PY02)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.3397, lng: -57.5089 }, { lat: -25.3926, lng: -57.3542 },
      { lat: -25.3866, lng: -57.1409 }, { lat: -25.4237, lng: -56.8822 }, { lat: -25.4473, lng: -56.4400 },
      { lat: -25.4655, lng: -56.0160 }, { lat: -25.4170, lng: -55.6900 }, { lat: -25.4440, lng: -55.2440 },
      { lat: -25.5097, lng: -54.6111 },
    ],
  },
  {
    nome: "Encarnación → Asunción (PY01)",
    pontos: [
      { lat: -27.3306, lng: -55.8667 }, { lat: -27.1700, lng: -56.2500 }, { lat: -26.9000, lng: -56.8300 },
      { lat: -26.6700, lng: -57.1500 }, { lat: -26.2400, lng: -57.1800 }, { lat: -25.9000, lng: -57.2200 },
      { lat: -25.6200, lng: -57.1500 }, { lat: -25.4300, lng: -57.4300 }, { lat: -25.2828, lng: -57.6359 },
    ],
  },
  {
    nome: "Encarnación → Ciudad del Este (PY06)",
    pontos: [
      { lat: -27.3306, lng: -55.8667 }, { lat: -27.0800, lng: -55.6500 }, { lat: -26.7900, lng: -55.3400 },
      { lat: -26.5000, lng: -55.2300 }, { lat: -26.1000, lng: -55.1300 }, { lat: -25.7900, lng: -55.0900 },
      { lat: -25.6500, lng: -54.7200 }, { lat: -25.5097, lng: -54.6111 },
    ],
  },
  {
    nome: "Asunción → Pedro Juan Caballero (PY03/PY05)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.1300, lng: -57.5300 }, { lat: -24.8000, lng: -57.3100 },
      { lat: -24.4000, lng: -57.0500 }, { lat: -24.0700, lng: -56.4400 }, { lat: -23.4000, lng: -56.4400 },
      { lat: -23.3800, lng: -55.9000 }, { lat: -22.5470, lng: -55.7330 },
    ],
  },
  {
    nome: "Asunción → Concepción (PY03/PY05)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.1700, lng: -57.4900 }, { lat: -25.0600, lng: -57.1000 },
      { lat: -24.6500, lng: -56.4400 }, { lat: -23.8000, lng: -56.5100 }, { lat: -23.3400, lng: -57.0600 },
      { lat: -23.4100, lng: -57.4300 },
    ],
  },
  {
    nome: "Asunción → Filadelfia (Transchaco)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.1000, lng: -57.5300 }, { lat: -24.4500, lng: -58.1500 },
      { lat: -23.4900, lng: -58.7900 }, { lat: -22.6200, lng: -59.7300 }, { lat: -22.3500, lng: -60.0300 },
    ],
  },
  {
    nome: "Asunción → Pilar (PY04)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.5000, lng: -57.5600 }, { lat: -25.8800, lng: -57.8000 },
      { lat: -26.1900, lng: -58.1300 }, { lat: -26.8600, lng: -58.3000 },
    ],
  },
  {
    nome: "Ciudad del Este → Salto del Guairá (PY07/PY10)",
    pontos: [
      { lat: -25.5097, lng: -54.6111 }, { lat: -25.4000, lng: -54.6400 }, { lat: -24.9300, lng: -55.2100 },
      { lat: -24.2500, lng: -54.7600 }, { lat: -24.0600, lng: -54.3100 },
    ],
  },
  {
    nome: "Ciudad del Este → Cascavel (BR-277)",
    pontos: [
      { lat: -25.5097, lng: -54.6111 }, { lat: -25.5200, lng: -54.5500 }, { lat: -25.2900, lng: -54.0900 },
      { lat: -25.1300, lng: -53.8500 }, { lat: -24.9600, lng: -53.4600 },
    ],
  },
  {
    nome: "Asunción → Formosa (RN11)",
    pontos: [
      { lat: -25.2828, lng: -57.6359 }, { lat: -25.2900, lng: -57.7200 }, { lat: -25.6000, lng: -57.9500 },
      { lat: -26.1800, lng: -58.1800 },
    ],
  },
  {
    nome: "Coronel Oviedo → Villarrica (PY08)",
    pontos: [
      { lat: -25.4473, lng: -56.4400 }, { lat: -25.6000, lng: -56.4300 }, { lat: -25.7500, lng: -56.4300 },
    ],
  },
];

const R = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rumo(a: Ponto, b: Ponto): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

export function comprimentoKm(pontos: Ponto[]): number {
  let t = 0;
  for (let i = 1; i < pontos.length; i++) t += distanciaKm(pontos[i - 1], pontos[i]);
  return t;
}

/** Ponto a `km` do início da rota (limitado ao fim), com o rumo do trecho. */
export function pontoNaRota(pontos: Ponto[], km: number): Ponto & { direcao: number } {
  let resta = Math.max(0, km);
  for (let i = 1; i < pontos.length; i++) {
    const d = distanciaKm(pontos[i - 1], pontos[i]);
    if (resta <= d) {
      const f = d ? resta / d : 0;
      const a = pontos[i - 1], b = pontos[i];
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, direcao: rumo(a, b) };
    }
    resta -= d;
  }
  const n = pontos.length;
  return { ...pontos[n - 1], direcao: rumo(pontos[n - 2], pontos[n - 1]) };
}

export function hash(texto: string): number {
  let h = 2166136261;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const FUSO_PY_H = -3;

/**
 * Jornada de demonstração do caminhão num dia: sempre a mesma para o mesmo caminhão
 * e dia. Começa num ponto variado da sua rota, sai entre 3h e 11h (hora do Paraguai),
 * roda a ~65 km/h indo e voltando pela rota e encosta entre 17h e 20h.
 * Cerca de 1 em cada 10 caminhões fica parado o dia todo.
 */
function viagemDemo(caminhaoId: string, dia: Date) {
  const chave = `${caminhaoId}:${dia.toISOString().slice(0, 10)}`;
  const h = hash(chave);
  const rota = ROTAS[hash(caminhaoId) % ROTAS.length];
  const ida = hash(chave + "s") % 2 === 0;
  const pontos = ida ? rota.pontos : [...rota.pontos].reverse();
  const total = comprimentoKm(pontos);
  const kmIni = total * ((hash(chave + "i") % 90) / 100);
  const inicioDia = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate()) - FUSO_PY_H * 3600_000;
  const folga = hash(chave + "folga") % 10 === 0;
  const saida = inicioDia + (folga ? 30 : 3 + (h % 480) / 60) * 3600_000;
  const chegada = inicioDia + (17 + (hash(chave + "c") % 180) / 60) * 3600_000;
  const media = 58 + (h % 15);
  const [, a, b, cod] = /^(.+) → (.+?)(?: \((.+)\))?$/.exec(rota.nome) ?? [];
  const [origem, destino] = ida ? [a, b] : [b, a];
  return { pontos, total, saida, chegada, media, kmIni, origem, destino, rodovia: cod ?? null, nome: ida ? rota.nome : rota.nome.split(" → ").reverse().join(" → ").replace(/ \((.+)\)$/, "") };
}

/** Distância percorrida `d` a partir de `kmIni`, indo e voltando numa rota de `total` km. */
function vaiEVolta(kmIni: number, d: number, total: number): { km: number; volta: boolean } {
  const m = (kmIni + d) % (2 * total);
  return m <= total ? { km: m, volta: false } : { km: 2 * total - m, volta: true };
}

/** Data (meia-noite UTC) do dia no Paraguai em que cai o instante `t`. */
export function diaNoParaguai(t: Date): Date {
  const l = new Date(t.getTime() + FUSO_PY_H * 3600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}

export function posicaoDemo(caminhaoId: string, agora: Date): PosicaoSimulada {
  const v = viagemDemo(caminhaoId, diaNoParaguai(agora));
  const t = agora.getTime();
  const rodando = t > v.saida && t < v.chegada;
  const d = t <= v.saida ? 0 : ((Math.min(t, v.chegada) - v.saida) / 3600_000) * v.media;
  const { km, volta } = vaiEVolta(v.kmIni, d, v.total);
  const p = pontoNaRota(v.pontos, km);
  const direcao = volta ? (p.direcao + 180) % 360 : p.direcao;
  // Pequena variação de velocidade para parecer real.
  const vel = rodando ? Math.max(20, Math.round(v.media + Math.sin(t / 90_000 + hash(caminhaoId)) * 14)) : 0;
  // Parados, cada um fica num ponto diferente da cidade (até ~1,5 km), como num pátio ou posto.
  const dLat = rodando ? 0 : ((hash(caminhaoId + "lat") % 1000) / 1000 - 0.5) * 0.028;
  const dLng = rodando ? 0 : ((hash(caminhaoId + "lng") % 1000) / 1000 - 0.5) * 0.03;
  const rpm = rodando ? Math.round(1100 + vel * 6 + Math.sin(t / 40_000 + hash(caminhaoId)) * 80) : 0;
  // Ex.: "PY02, km 182 → Ciudad del Este" (km contado a partir da origem da rota).
  const trecho = `${v.rodovia ? `${v.rodovia}, ` : ""}km ${Math.round(km)}`;
  const local = rodando ? `${trecho} → ${volta ? v.origem : v.destino}` : trecho;
  return { lat: p.lat + dLat, lng: p.lng + dLng, direcao, velocidadeKmh: vel, ignicao: rodando, data: agora, rpm, local };
}

/** Trajeto de demonstração do dia até `ate`, um ponto a cada 5 minutos. */
export function trajetoDemo(caminhaoId: string, dia: Date, ate: Date): PosicaoSimulada[] {
  const v = viagemDemo(caminhaoId, dia);
  const fim = Math.min(ate.getTime(), v.chegada);
  const pts: PosicaoSimulada[] = [];
  for (let t = v.saida; t <= fim; t += 5 * 60_000) pts.push(posicaoDemo(caminhaoId, new Date(t)));
  return pts;
}

export function rotaDemoNome(caminhaoId: string, dia: Date): string {
  return viagemDemo(caminhaoId, dia).nome;
}
