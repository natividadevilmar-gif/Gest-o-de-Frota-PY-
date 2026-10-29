import type { PrismaClient } from "@prisma/client";
import { diasDoParaguai, gravarDia } from "../telemetria/sincronizar";

// CUSAT (gps.cusat.com.py) e outras plataformas feitas com o GPSWOX, como mais uma entrada
// de posições. O admin entra com o e-mail e a senha da conta do cliente na central; a senha
// não fica guardada, só a chave (user_api_hash) que a plataforma devolve no login.
// A cada minuto o espelho lê a última posição de cada aparelho e grava em Posicao, igual
// ao Wialon e ao receptor próprio. Cada caminhão é ligado ao aparelho pelo IMEI.

export const SERVIDOR_CUSAT = "gps.cusat.com.py";

const normalizarPlaca = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

type Sensor = { type?: string; name?: string; value?: unknown; val?: unknown };
export type AparelhoGpswox = {
  id: number;
  name: string;
  lat?: number | string | null;
  lng?: number | string | null;
  speed?: number | string | null;
  course?: number | string | null;
  timestamp?: number | null;
  sensors?: Sensor[] | null;
  device_data?: { imei?: string | null; plate_number?: string | null } | null;
};

const numero = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/** Ignição pelo sensor de ignição/ACC/motor do aparelho (val true/false ou "On"/"Off"). */
function ignicaoDe(sensores: Sensor[]): boolean | null {
  const s = sensores.find((x) => /^(acc|ignition|engine)$/i.test(x.type ?? "") || /igni|acc|motor|engine/i.test(x.name ?? ""));
  if (!s) return null;
  if (typeof s.val === "boolean") return s.val;
  const t = String(s.val ?? s.value ?? "").trim().toLowerCase();
  if (/^(1|true|on|si|sí|sim|ligad|encendid)/.test(t)) return true;
  if (/^(0|false|off|no|não|deslig|apagad)/.test(t)) return false;
  return null;
}

const sensorNumero = (sensores: Sensor[], tipo: RegExp, nome: RegExp) => {
  const s = sensores.find((x) => tipo.test(x.type ?? "") || nome.test(x.name ?? ""));
  return s ? numero(s.val) ?? numero(s.value) : undefined;
};

export const imeiDe = (a: AparelhoGpswox) => {
  const i = String(a.device_data?.imei ?? "").trim();
  return /^\d{15}$/.test(i) ? i : null;
};

/** Converte a última posição de um aparelho para a linha gravada em Posicao (sem posição, não grava). */
export function paraPosicaoGpswox(a: AparelhoGpswox) {
  const lat = numero(a.lat), lng = numero(a.lng);
  if (lat === undefined || lng === undefined || !a.timestamp || (lat === 0 && lng === 0)) return null;
  const sensores = a.sensors ?? [];
  return {
    data: new Date(a.timestamp * 1000),
    lat,
    lng,
    velocidadeKmh: Math.round(numero(a.speed) ?? 0),
    direcao: Math.round(numero(a.course) ?? 0),
    satelites: 0,
    ignicao: ignicaoDe(sensores),
    odometroKm: sensorNumero(sensores, /^odometer$/i, /od[oó]metro|odometer|kilometraje/i) ?? null,
    litrosTotal: null,
    nivelCombustivelL: sensorNumero(sensores, /^fuel_tank$/i, /combust|fuel|tanque/i) ?? null,
    rpm: sensorNumero(sensores, /^tachometer$/i, /rpm/i) ?? null,
    evento: null,
  };
}

/** Aparelho de cada caminhão: pelo IMEI do cadastro ou, sem IMEI, pela placa no nome ou na placa do aparelho. */
export function ligarAparelhos<C extends { placa: string; rastreadorId: string | null }>(caminhoes: C[], aparelhos: AparelhoGpswox[]) {
  const porImei = new Map<string, AparelhoGpswox>();
  const porPlaca = new Map<string, AparelhoGpswox>();
  for (const a of aparelhos) {
    const imei = imeiDe(a);
    if (imei) porImei.set(imei, a);
    for (const p of [a.device_data?.plate_number ?? "", a.name, ...a.name.split(/[\s/|(),-]+/)]) {
      const k = normalizarPlaca(p);
      if (k.length >= 5 && !porPlaca.has(k)) porPlaca.set(k, a);
    }
  }
  // Placa no meio do nome (ex.: "Brendon 02 - ABC 123"): só quando a placa tem 6 ou mais letras e números.
  const contem = (k: string) => (k.length >= 6 ? aparelhos.find((a) => normalizarPlaca(a.name).includes(k)) : undefined);
  return caminhoes.map((c) => {
    const k = normalizarPlaca(c.placa);
    return { caminhao: c, aparelho: (c.rastreadorId ? porImei.get(c.rastreadorId) : undefined) ?? porPlaca.get(k) ?? contem(k) ?? null };
  });
}

export class ErroGpswox extends Error {}

/** Cliente mínimo da API do GPSWOX. */
export class Gpswox {
  constructor(private hash: string, private host = SERVIDOR_CUSAT) {}

  private static async pedir(url: string, init?: RequestInit) {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }).catch(() => {
      throw new ErroGpswox(`Sem conexão com ${new URL(url).host}.`);
    });
    const j = await r.json().catch(() => null);
    if (r.status === 401 || (j && typeof j === "object" && "status" in j && j.status === 0)) {
      throw new ErroGpswox((j as { message?: string })?.message || "E-mail ou senha não aceitos.");
    }
    if (!r.ok || j === null) throw new ErroGpswox(`${new URL(url).host} respondeu HTTP ${r.status}.`);
    return j;
  }

  /** Entra com e-mail e senha e devolve a chave da API (a senha não é guardada). */
  static async entrar(host: string, email: string, senha: string) {
    const j = await Gpswox.pedir(`https://${host}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ email, password: senha }),
    });
    const hash = (j as { user_api_hash?: string }).user_api_hash;
    if (!hash) throw new ErroGpswox("A plataforma não devolveu a chave da API. Ela pode não ter a API liberada para esta conta.");
    return hash;
  }

  /** Todos os aparelhos da conta, com a última posição e os sensores. */
  async aparelhos(): Promise<AparelhoGpswox[]> {
    const q = new URLSearchParams({ user_api_hash: this.hash, lang: "es" });
    const j = await Gpswox.pedir(`https://${this.host}/api/get_devices?${q}`, { headers: { Accept: "application/json" } });
    const grupos = Array.isArray(j) ? j : [];
    return grupos.flatMap((g: { items?: AparelhoGpswox[] }) => (Array.isArray(g?.items) ? g.items : [])).filter((a) => a && typeof a.name === "string");
  }
}

export type ClienteGpswox = { gpswoxHash: string | null; gpswoxHost: string | null };
export const clienteUsaGpswox = (c: ClienteGpswox) => !!c.gpswoxHash;
export const apiGpswox = (c: ClienteGpswox) => (c.gpswoxHash ? new Gpswox(c.gpswoxHash, c.gpswoxHost || SERVIDOR_CUSAT) : null);

const RESUMO_MIN_MS = 10 * 60_000;
const resumidoEm = new Map<string, number>();

/** Grava a posição nova de cada caminhão ligado a um aparelho, conta por conta. Rodar a cada minuto. */
export async function espelharGpswox(db: PrismaClient, agora = new Date()) {
  const clientes = await db.cliente.findMany({ where: { gpswoxHash: { not: null } }, select: { id: true, nome: true, gpswoxHash: true, gpswoxHost: true } });
  let gravadas = 0;
  const erros: string[] = [];
  for (const cl of clientes) {
    try {
      const [caminhoes, aparelhos] = await Promise.all([
        db.caminhao.findMany({ where: { clienteId: cl.id, rastreadorId: { not: null } }, select: { id: true, placa: true, rastreadorId: true, ultimaPosicaoEm: true, odometroKm: true, plano: true } }),
        apiGpswox(cl)!.aparelhos(),
      ]);
      for (const { caminhao: c, aparelho: a } of ligarAparelhos(caminhoes, aparelhos)) {
        if (!a || c.rastreadorId !== imeiDe(a)) continue;
        const l = paraPosicaoGpswox(a);
        if (!l || (c.ultimaPosicaoEm && l.data <= c.ultimaPosicaoEm)) continue;
        await db.posicao.create({ data: { caminhaoId: c.id, ...l } });
        await db.caminhao.update({
          where: { id: c.id },
          data: {
            ultimaPosicaoEm: l.data, ultimaLat: l.lat, ultimaLng: l.lng, ultimaVelocidade: l.velocidadeKmh, ultimaIgnicao: l.ignicao,
            ...(l.odometroKm ? { odometroKm: Math.round(l.odometroKm) } : {}),
          },
        });
        gravadas++;
        for (const dia of diasDoParaguai([l.data])) {
          const chave = `${c.id}|${dia.getTime()}`;
          if (agora.getTime() - (resumidoEm.get(chave) ?? 0) < RESUMO_MIN_MS) continue;
          await gravarDia(db, null, c, dia);
          resumidoEm.set(chave, agora.getTime());
        }
      }
    } catch (e) {
      erros.push(`${cl.nome}: ${(e as Error).message}`);
    }
  }
  return { gravadas, erros };
}
