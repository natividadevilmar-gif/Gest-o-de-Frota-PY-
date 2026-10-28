import type { PrismaClient } from "@prisma/client";
import { IO } from "./teltonika";

// Wialon (Gurtam) como mais uma entrada de posições, ao lado do receptor próprio.
// O espelho lê as mensagens de cada unidade pela Remote API e grava em Posicao, igual
// ao que o receptor faz com os aparelhos ligados direto nele. Assim mapa, cercas,
// alertas da central e o resumo diário funcionam sem saber de onde veio o dado.
//
// Variáveis: WIALON_TOKEN (obrigatória), WIALON_HOST (padrão hst-api.wialon.com),
// WIALON_CLIENTES (nomes dos clientes que usam o Wialon, separados por vírgula; vazio = todos).
// Cada caminhão é ligado à unidade do Wialon pelo IMEI (campo Rastreador do cadastro),
// que o Wialon guarda como identificador único da unidade.

export type MensagemWialon = {
  t: number;
  pos: { x: number; y: number; s: number; c: number; sc: number } | null;
  p?: Record<string, number | string>;
};

export type UnidadeWialon = { id: number; nm: string; uid?: string; lmsg?: MensagemWialon | null };

/** Nomes dos parâmetros no Wialon: aparelhos Teltonika chegam como io_<código>. */
const P = {
  ignicao: [`io_${IO.ignicao}`, "ignition", "ign"],
  odometroCanM: [`io_${IO.odometroCan}`],
  odometroGpsM: [`io_${IO.odometroGps}`],
  combustivelDecilitros: [`io_${IO.combustivelCan}`],
  rpm: [`io_${IO.rpm}`, "rpm", "engine_rpm"],
  conducao: [`io_${IO.conducao}`],
  excesso: [`io_${IO.excesso}`],
};

function ler(p: MensagemWialon["p"], nomes: string[]): number | undefined {
  for (const n of nomes) {
    const v = p?.[n];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
}

/** Converte uma mensagem do Wialon para a linha gravada em Posicao (sem posição, não grava). */
export function paraPosicaoWialon(m: MensagemWialon) {
  if (!m.pos) return null;
  const p = m.p;
  const odoM = ler(p, P.odometroCanM) ?? ler(p, P.odometroGpsM);
  const comb = ler(p, P.combustivelDecilitros);
  const ign = ler(p, P.ignicao);
  const conducao = ler(p, P.conducao);
  const evento =
    ler(p, P.excesso) !== undefined ? "excesso" : conducao === 1 ? "aceleracao" : conducao === 2 ? "freada" : conducao === 3 ? "curva" : null;
  return {
    data: new Date(m.t * 1000),
    lat: m.pos.y,
    lng: m.pos.x,
    velocidadeKmh: Math.round(m.pos.s),
    direcao: Math.round(m.pos.c),
    satelites: m.pos.sc,
    ignicao: ign === undefined ? null : ign === 1,
    odometroKm: odoM === undefined ? null : odoM / 1000,
    litrosTotal: comb === undefined ? null : comb / 10,
    rpm: ler(p, P.rpm) ?? null,
    evento,
  };
}

/** Liga cada caminhão à unidade do Wialon com o mesmo IMEI. */
export function ligarUnidades<C extends { rastreadorId: string | null }>(caminhoes: C[], unidades: UnidadeWialon[]) {
  const porUid = new Map(unidades.filter((u) => u.uid).map((u) => [u.uid!, u]));
  return caminhoes.flatMap((c) => {
    const u = c.rastreadorId ? porUid.get(c.rastreadorId) : undefined;
    return u ? [{ caminhao: c, unidade: u }] : [];
  });
}

// Códigos de erro da Remote API que importam aqui.
const ERROS: Record<number, string> = {
  1: "sessão expirada",
  4: "parâmetros inválidos",
  5: "erro ao executar a consulta",
  7: "acesso negado (o token não dá acesso a essa unidade)",
  8: "token inválido ou vencido",
  1003: "só uma consulta por vez nesta sessão",
};

export class ErroWialon extends Error {
  constructor(public codigo: number, svc: string) {
    super(`Wialon ${svc}: ${ERROS[codigo] ?? `erro ${codigo}`}`);
  }
}

/** Cliente mínimo da Remote API: entra com o token e refaz o login se a sessão cair. */
export class Wialon {
  private sid: string | null = null;
  constructor(private token: string, private host = "hst-api.wialon.com") {}

  static doAmbiente() {
    const token = process.env.WIALON_TOKEN;
    if (!token) throw new Error("Defina WIALON_TOKEN para ler os dados do Wialon.");
    return new Wialon(token, process.env.WIALON_HOST || undefined);
  }

  private async enviar(svc: string, params: unknown, sid: string | null) {
    const corpo = new URLSearchParams({ svc, params: JSON.stringify(params) });
    if (sid) corpo.set("sid", sid);
    const r = await fetch(`https://${this.host}/wialon/ajax.html`, { method: "POST", body: corpo, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`Wialon ${svc}: HTTP ${r.status}`);
    const j = await r.json();
    if (j && typeof j === "object" && "error" in j && j.error) throw new ErroWialon(j.error, svc);
    return j;
  }

  private async entrar() {
    const j = await this.enviar("token/login", { token: this.token }, null);
    this.sid = j.eid as string;
  }

  async chamar<T = unknown>(svc: string, params: unknown): Promise<T> {
    if (!this.sid) await this.entrar();
    try {
      return await this.enviar(svc, params, this.sid);
    } catch (e) {
      if (!(e instanceof ErroWialon && e.codigo === 1)) throw e;
      await this.entrar();
      return this.enviar(svc, params, this.sid);
    }
  }

  async sair() {
    if (this.sid) await this.enviar("core/logout", {}, this.sid).catch(() => {});
    this.sid = null;
  }

  /** Unidades que o token enxerga, com IMEI e última mensagem. */
  async unidades(filtro?: { uid: string }): Promise<UnidadeWialon[]> {
    const j = await this.chamar<{ items: UnidadeWialon[] }>("core/search_items", {
      spec: {
        itemsType: "avl_unit",
        propName: filtro ? "sys_unique_id" : "sys_name",
        propValueMask: filtro?.uid ?? "*",
        sortType: "sys_name",
      },
      force: 1,
      // 0x1 dados básicos, 0x100 IMEI e aparelho, 0x400 última mensagem.
      flags: 0x1 | 0x100 | 0x400,
      from: 0,
      to: 0,
    });
    return j.items ?? [];
  }

  /** Mensagens com dados (não SMS nem eventos) de uma unidade entre dois instantes. */
  async mensagens(unidadeId: number, de: Date, ate: Date): Promise<MensagemWialon[]> {
    const j = await this.chamar<{ messages: MensagemWialon[] }>("messages/load_interval", {
      itemId: unidadeId,
      timeFrom: Math.floor(de.getTime() / 1000),
      timeTo: Math.floor(ate.getTime() / 1000),
      flags: 0x0000,
      flagsMask: 0xff00,
      loadCount: 0xffffffff,
    });
    return j.messages ?? [];
  }
}

/** Filtro dos caminhões que vêm do Wialon, pelos clientes de WIALON_CLIENTES. */
export function filtroClientesWialon(nomes = process.env.WIALON_CLIENTES) {
  const lista = (nomes ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  return lista.length ? { cliente: { nome: { in: lista, mode: "insensitive" as const } } } : {};
}

/** true quando as posições deste cliente vêm do Wialon (token definido e cliente na lista). */
export function clienteUsaWialon(nome: string, nomes = process.env.WIALON_CLIENTES) {
  if (!process.env.WIALON_TOKEN) return false;
  const lista = (nomes ?? "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
  return !lista.length || lista.includes(nome.trim().toLowerCase());
}

/** Na primeira leitura de um caminhão, quanto do passado buscar. */
const INICIO_MS = 48 * 3600_000;

/**
 * Traz as mensagens novas de cada caminhão ligado a uma unidade do Wialon para Posicao
 * e atualiza a última posição. Rodar a cada minuto ou dois.
 */
export async function espelharWialon(db: PrismaClient, api: Wialon, agora = new Date()) {
  const [caminhoes, unidades] = await Promise.all([
    db.caminhao.findMany({ where: filtroClientesWialon(), select: { id: true, placa: true, rastreadorId: true, ultimaPosicaoEm: true } }),
    api.unidades(),
  ]);
  let gravadas = 0;
  const erros: string[] = [];
  for (const { caminhao: c, unidade: u } of ligarUnidades(caminhoes, unidades)) {
    if (!u.lmsg || (c.ultimaPosicaoEm && u.lmsg.t * 1000 <= c.ultimaPosicaoEm.getTime())) continue;
    try {
      const de = c.ultimaPosicaoEm ? new Date(c.ultimaPosicaoEm.getTime() + 1000) : new Date(agora.getTime() - INICIO_MS);
      const linhas = (await api.mensagens(u.id, de, new Date(u.lmsg.t * 1000)))
        .map(paraPosicaoWialon)
        .filter((l) => l !== null)
        .map((l) => ({ caminhaoId: c.id, ...l }));
      if (!linhas.length) continue;
      await db.posicao.createMany({ data: linhas });
      const ultima = linhas.reduce((a, b) => (b.data > a.data ? b : a));
      await db.caminhao.updateMany({
        where: { id: c.id, OR: [{ ultimaPosicaoEm: null }, { ultimaPosicaoEm: { lt: ultima.data } }] },
        data: {
          ultimaPosicaoEm: ultima.data, ultimaLat: ultima.lat, ultimaLng: ultima.lng,
          ultimaVelocidade: ultima.velocidadeKmh, ultimaIgnicao: ultima.ignicao,
          ...(ultima.odometroKm ? { odometroKm: Math.round(ultima.odometroKm) } : {}),
        },
      });
      gravadas += linhas.length;
    } catch (e) {
      erros.push(`${c.placa}: ${(e as Error).message}`);
    }
  }
  return { unidades: unidades.length, gravadas, erros };
}
