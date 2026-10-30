import type { PrismaClient } from "@prisma/client";
import { diasDoParaguai, gravarDia } from "../telemetria/sincronizar";
import { espelharGpswox } from "./gpswox";
import { IO } from "./teltonika";

// Wialon (Gurtam) como mais uma entrada de posições, ao lado do receptor próprio.
// O espelho lê as mensagens de cada unidade pela Remote API e grava em Posicao, igual
// ao que o receptor faz com os aparelhos ligados direto nele. Assim mapa, cercas,
// alertas da central e o resumo diário funcionam sem saber de onde veio o dado.
//
// Cada cliente pode ter a própria conta: o admin cola o token em Caminhões e planos e ele
// fica no cadastro do cliente. Sem token no cadastro, vale o das variáveis WIALON_TOKEN e
// WIALON_HOST (padrão hst-api.wialon.com) para os clientes de WIALON_CLIENTES (vazio = todos).
// Cada caminhão é ligado à unidade do Wialon pelo IMEI (campo Rastreador do cadastro),
// que o Wialon guarda como identificador único da unidade.

export type MensagemWialon = {
  t: number;
  pos: { x: number; y: number; s: number; c: number; sc: number } | null;
  p?: Record<string, number | string>;
  /** Diesel já calculado pelos sensores da unidade no Wialon (nível e consumo total, em litros). */
  sens?: { nivelL?: number; consumoL?: number };
};

/** Sensor configurado na unidade do Wialon: n = nome, t = tipo (ex.: "fuel level"), p = parâmetro bruto. */
export type SensorWialon = { id: number; n: string; t: string; p?: string };
export type UnidadeWialon = { id: number; nm: string; uid?: string; lmsg?: MensagemWialon | null; sens?: Record<string, SensorWialon> | null };

/**
 * Sensores de diesel da unidade. É deles que sai o diesel do relatório do Wialon: muitas vezes o
 * rastreador manda só um valor bruto (tensão da boia, pulsos) e a calibração fica no sensor.
 */
export function sensoresDiesel(u: Pick<UnidadeWialon, "sens">) {
  const lista = Object.values(u.sens ?? {});
  const doTipo = (re: RegExp) => lista.find((s) => re.test(s.t ?? ""))?.id;
  return {
    nivel: tanquesDiesel(lista),
    consumo: doTipo(/^absolute fuel consumption$/i) ?? doTipo(/^impulse fuel consumption$/i),
  };
}

/**
 * Sensores de nível que somados dão o diesel do caminhão (os caminhões têm dois tanques).
 * Um sensor calculado no Wialon, como "Combustible" = [Tanque 1]+[Tanque 2], já é o total.
 */
function tanquesDiesel(lista: SensorWialon[]): number[] | undefined {
  const nivel = lista.filter((s) => /fuel level/i.test(s.t ?? ""));
  if (!nivel.length) return undefined;
  const total = nivel.find((s) => nivel.some((o) => o !== s && (s.p ?? "").includes(`[${o.n}]`)));
  return total ? [total.id] : nivel.map((s) => s.id);
}

/** Soma do nível dos tanques numa leitura; se o total calculado bater com a soma dos outros, usa só ele. */
export function somaTanques(valores: (number | undefined)[]): number | undefined {
  if (!valores.length || valores.some((v) => v === undefined)) return undefined;
  const v = valores as number[];
  const soma = v.reduce((a, b) => a + b, 0);
  const maior = Math.max(...v);
  if (v.length >= 3 && Math.abs(soma - maior - maior) <= Math.max(2, maior * 0.02)) return maior;
  return soma;
}

/** Valor que o Wialon devolve quando o sensor não tem leitura na mensagem. */
const SEM_VALOR = -348201.3876;
const valorSensor = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v - SEM_VALOR) > 0.01 ? v : undefined);

/**
 * Nomes dos parâmetros no Wialon: aparelhos Teltonika chegam como io_<código>; outras
 * marcas usam nomes como can_mileage e can_fuel_used, já em km e litros.
 */
const P = {
  ignicao: [`io_${IO.ignicao}`, "ignition", "ign", "can_ignition"],
  odometroCanM: [`io_${IO.odometroCan}`],
  odometroKm: ["can_mileage", "can_odometer", "can_total_mileage", "vehicle_mileage", "odometer", "mileage"],
  odometroGpsM: [`io_${IO.odometroGps}`],
  combustivelDecilitros: [`io_${IO.combustivelCan}`],
  combustivelL: ["can_fuel_used", "can_fuel_consumed", "can_total_fuel_used", "total_fuel_used", "fuel_used", "can_fuel_total"],
  nivelDecilitros: [`io_${IO.nivelCombustivel}`],
  nivelL: ["can_fuel_level", "fuel_level", "fuel_lvl", "fls", "lls", "can_fuel_litres"],
  rpm: [`io_${IO.rpm}`, "can_rpm", "can_engine_rpm", "engine_rpm", "rpm"],
  conducao: [`io_${IO.conducao}`],
  excesso: [`io_${IO.excesso}`],
};

/** Odômetro em km; um valor grande demais para km (mais de 5 milhões) veio em metros. */
const kmDe = (v: number | undefined) => (v === undefined ? undefined : v > 5_000_000 ? v / 1000 : v);

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
  const odoM = ler(p, P.odometroCanM);
  const odoKm = odoM !== undefined ? odoM / 1000 : kmDe(ler(p, P.odometroKm)) ?? (ler(p, P.odometroGpsM) ?? NaN) / 1000;
  const decilitros = ler(p, P.combustivelDecilitros);
  const litros = m.sens?.consumoL ?? (decilitros !== undefined ? decilitros / 10 : ler(p, P.combustivelL));
  const nivelDl = ler(p, P.nivelDecilitros);
  const nivel = m.sens?.nivelL ?? (nivelDl !== undefined ? nivelDl / 10 : ler(p, P.nivelL));
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
    odometroKm: Number.isFinite(odoKm) ? odoKm : null,
    litrosTotal: litros ?? null,
    nivelCombustivelL: nivel ?? null,
    rpm: ler(p, P.rpm) ?? null,
    evento,
  };
}

export type TelemetriaUnidade = { odometro: boolean; diesel: boolean; tanque: boolean; rpm: boolean; ignicao: boolean; eventos: boolean; parametros: string[] };

/** O que a última mensagem da unidade traz de telemetria, para conferir na central. */
export function telemetriaDaMensagem(m: MensagemWialon | null | undefined, u: Pick<UnidadeWialon, "sens"> = {}): TelemetriaUnidade {
  const p = m?.p;
  const tem = (nomes: string[]) => ler(p, nomes) !== undefined;
  const sd = sensoresDiesel(u);
  return {
    odometro: tem([...P.odometroCanM, ...P.odometroKm, ...P.odometroGpsM]),
    diesel: sd.consumo !== undefined || tem([...P.combustivelDecilitros, ...P.combustivelL]),
    tanque: sd.nivel !== undefined || tem([...P.nivelDecilitros, ...P.nivelL]),
    rpm: tem(P.rpm),
    ignicao: tem(P.ignicao),
    eventos: tem([...P.conducao, ...P.excesso]),
    parametros: [...Object.keys(p ?? {}).sort(), ...Object.values(u.sens ?? {}).map((x) => `sensor "${x.n}" (${x.t}${x.p ? `: ${x.p}` : ""})`)],
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
    const r = await fetch(`https://${this.host}/wialon/ajax.html`, { method: "POST", body: corpo, signal: AbortSignal.timeout(60_000) })
      .catch(() => { throw new Error(`Sem conexão com o Wialon (${this.host}).`); });
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
      // 0x1 dados básicos, 0x100 IMEI e aparelho, 0x400 última mensagem, 0x1000 sensores.
      flags: 0x1 | 0x100 | 0x400 | 0x1000,
      from: 0,
      to: 0,
    });
    return j.items ?? [];
  }

  /**
   * Mensagens com dados (não SMS nem eventos) de uma unidade entre dois instantes. Se a unidade
   * tem sensores de diesel, cada mensagem vem também com o valor calculado por eles.
   */
  async mensagens(u: Pick<UnidadeWialon, "id" | "sens">, de: Date, ate: Date): Promise<MensagemWialon[]> {
    const j = await this.chamar<{ messages: MensagemWialon[] }>("messages/load_interval", {
      itemId: u.id,
      timeFrom: Math.floor(de.getTime() / 1000),
      timeTo: Math.floor(ate.getTime() / 1000),
      flags: 0x0000,
      flagsMask: 0xff00,
      loadCount: 0xffffffff,
    });
    const msgs = j.messages ?? [];
    const sd = sensoresDiesel(u);
    if (!msgs.length || (sd.nivel === undefined && sd.consumo === undefined)) return msgs;
    // Os sensores são calculados sobre as mensagens que acabaram de ser carregadas na sessão.
    const valores = await this.chamar<Record<string, unknown>[]>("unit/calc_sensors", {
      source: "", indexFrom: 0, indexTo: msgs.length - 1, unitId: u.id, sensorId: 0,
    }).catch((e) => { console.error((e as Error).message); return null; });
    if (!Array.isArray(valores) || valores.length !== msgs.length) return msgs;
    return msgs.map((m, i) => ({
      ...m,
      sens: {
        nivelL: sd.nivel ? somaTanques(sd.nivel.map((id) => valorSensor(valores[i]?.[id]))) : undefined,
        consumoL: sd.consumo !== undefined ? valorSensor(valores[i]?.[sd.consumo]) : undefined,
      },
    }));
  }
}

export type ClienteWialon = { nome: string; wialonToken: string | null; wialonHost: string | null };

// Clientes que mudaram de nome: WIALON_CLIENTES ainda pode trazer o nome antigo.
const NOME_ANTIGO: Record<string, string> = { "svm trucks": "avm truck" };

/** Token e servidor do Wialon deste cliente, ou null se ele não usa o Wialon. */
export function credenciaisWialon(c: ClienteWialon, env: Record<string, string | undefined> = process.env): { token: string; host: string | undefined } | null {
  if (c.wialonToken) return { token: c.wialonToken, host: c.wialonHost || undefined };
  if (!env.WIALON_TOKEN) return null;
  const lista = (env.WIALON_CLIENTES ?? "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
  const nome = c.nome.trim().toLowerCase();
  if (lista.length && !lista.includes(nome) && !lista.includes(NOME_ANTIGO[nome] ?? "")) return null;
  return { token: env.WIALON_TOKEN, host: env.WIALON_HOST || undefined };
}

export const clienteUsaWialon = (c: ClienteWialon) => credenciaisWialon(c) !== null;

/** Servidores do Wialon Hosting, pelo endereço que o cliente usa para entrar. */
export const SERVIDORES_WIALON = [
  { host: "hst-api.wialon.us", site: "hosting.wialon.us" },
  { host: "hst-api.wialon.com", site: "hosting.wialon.com" },
  { host: "hst-api.wialon.eu", site: "hosting.wialon.eu" },
];

/** Link que abre o Wialon e devolve um token só de leitura, sem prazo. */
export const linkTokenWialon = (site: string) =>
  `https://${site}/login.html?client_id=GestaoFrotaPY&access_type=0x300&activation_time=0&duration=0&flags=0x1`;

// Uma sessão por conta, reaproveitada entre as rodadas.
const sessoes = new Map<string, Wialon>();
export function apiDoCliente(c: ClienteWialon) {
  const cred = credenciaisWialon(c);
  if (!cred) return null;
  const chave = `${cred.host ?? ""}|${cred.token}`;
  let api = sessoes.get(chave);
  if (!api) sessoes.set(chave, (api = new Wialon(cred.token, cred.host)));
  return api;
}

export const normalizarPlaca = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Sugere o IMEI de cada caminhão pela unidade do Wialon com o mesmo nome da placa
 * (ignorando espaços e traços). Só vale unidade com IMEI de 15 números.
 */
export function imeisPelaPlaca<C extends { placa: string }>(caminhoes: C[], unidades: UnidadeWialon[]) {
  const porNome = new Map<string, UnidadeWialon>();
  for (const u of unidades) {
    if (!u.uid || !/^\d{15}$/.test(u.uid)) continue;
    for (const pedaco of [u.nm, ...u.nm.split(/[\s/|(),-]+/)]) {
      const k = normalizarPlaca(pedaco);
      if (k.length >= 5 && !porNome.has(k)) porNome.set(k, u);
    }
  }
  return caminhoes.map((c) => ({ caminhao: c, unidade: porNome.get(normalizarPlaca(c.placa)) ?? null }));
}

// O site também espelha o Wialon quando alguém abre o mapa ou a central, no máximo a cada
// minuto. Assim funciona hospedado só na Vercel, sem o servidor do receptor.
const ESPELHO_MIN_MS = 60_000;
const ESPERA_MAX_MS = 8_000;
let ultimoEspelho = 0;

export async function espelharSeDevido(db: PrismaClient, agora = new Date()) {
  if (agora.getTime() - ultimoEspelho < ESPELHO_MIN_MS) return;
  ultimoEspelho = agora.getTime();
  const rodada = Promise.all([
    espelharWialon(db, agora).then(
      (r) => { if (r.erros.length) console.error("Wialon:", ...r.erros); },
      (e) => console.error("Wialon:", (e as Error).message),
    ),
    espelharGpswox(db, agora).then(
      (r) => { if (r.erros.length) console.error("CUSAT/GPSWOX:", ...r.erros); },
      (e) => console.error("CUSAT/GPSWOX:", (e as Error).message),
    ),
  ]);
  // Não segura a tela se o Wialon demorar: a próxima abertura já mostra o que chegou.
  await Promise.race([rodada, new Promise((ok) => setTimeout(ok, ESPERA_MAX_MS))]);
}

/** Na primeira leitura de um caminhão, quanto do passado buscar. */
const INICIO_MS = 48 * 3600_000;

/**
 * Traz as mensagens novas de cada caminhão ligado a uma unidade do Wialon para Posicao
 * e atualiza a última posição, conta por conta. Rodar a cada minuto ou dois.
 */
export async function espelharWialon(db: PrismaClient, agora = new Date()) {
  const clientes = await db.cliente.findMany({
    where: { OR: [{ wialonToken: { not: null } }, ...(process.env.WIALON_TOKEN ? [{}] : [])] },
    select: { id: true, nome: true, wialonToken: true, wialonHost: true },
  });
  let unidades = 0, gravadas = 0;
  const erros: string[] = [];
  for (const cl of clientes) {
    const api = apiDoCliente(cl);
    if (!api) continue;
    try {
      const r = await espelharConta(db, api, cl.id, agora);
      unidades += r.unidades;
      gravadas += r.gravadas;
      erros.push(...r.erros.map((e) => `${cl.nome} · ${e}`));
    } catch (e) {
      erros.push(`${cl.nome}: ${(e as Error).message}`);
    }
  }
  return { unidades, gravadas, erros };
}

const RESUMO_MIN_MS = 10 * 60_000;
const resumidoEm = new Map<string, number>();

async function espelharConta(db: PrismaClient, api: Wialon, clienteId: string, agora: Date) {
  const [caminhoes, unidades] = await Promise.all([
    db.caminhao.findMany({ where: { clienteId }, select: { id: true, placa: true, rastreadorId: true, ultimaPosicaoEm: true, odometroKm: true, plano: true } }),
    api.unidades(),
  ]);
  let gravadas = 0;
  const erros: string[] = [];
  for (const { caminhao: c, unidade: u } of ligarUnidades(caminhoes, unidades)) {
    if (!u.lmsg || (c.ultimaPosicaoEm && u.lmsg.t * 1000 <= c.ultimaPosicaoEm.getTime())) continue;
    try {
      const de = c.ultimaPosicaoEm ? new Date(c.ultimaPosicaoEm.getTime() + 1000) : new Date(agora.getTime() - INICIO_MS);
      const linhas = (await api.mensagens(u, de, new Date(u.lmsg.t * 1000)))
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
          ultimaVelocidade: ultima.velocidadeKmh, ultimaIgnicao: ultima.ignicao, ultimaDirecao: ultima.direcao,
          ...(ultima.odometroKm ? { odometroKm: Math.round(ultima.odometroKm) } : {}),
        },
      });
      gravadas += linhas.length;
      // O resumo do dia (km, diesel, alertas) acompanha as posições que chegam, sem esperar a madrugada.
      // O de hoje é refeito no máximo a cada 10 minutos, para não reler o dia inteiro a cada minuto.
      for (const dia of diasDoParaguai(linhas.map((l) => l.data))) {
        const chave = `${c.id}|${dia.getTime()}`;
        if (agora.getTime() - (resumidoEm.get(chave) ?? 0) < RESUMO_MIN_MS) continue;
        await gravarDia(db, null, c, dia);
        resumidoEm.set(chave, agora.getTime());
      }
    } catch (e) {
      erros.push(`${c.placa}: ${(e as Error).message}`);
    }
  }
  return { unidades: unidades.length, gravadas, erros };
}

/** Pedaço do histórico lido por vez, para não trazer um mês inteiro numa resposta só. */
const PEDACO_HISTORICO_MS = 2 * 86_400_000;

/**
 * Traz do Wialon o histórico de posições e telemetria desde `desde`, para os caminhões
 * ligados da conta que ainda não têm esse período. Para quando o prazo acaba; chamar
 * de novo continua de onde parou. Devolve quantos caminhões ainda faltam.
 */
export async function historicoWialon(db: PrismaClient, api: Wialon, clienteId: string, desde: Date, prazoMs: number) {
  const fimDoPrazo = Date.now() + prazoMs;
  const [caminhoes, unidades] = await Promise.all([
    db.caminhao.findMany({ where: { clienteId }, select: { id: true, placa: true, rastreadorId: true, odometroKm: true, plano: true } }),
    api.unidades(),
  ]);
  const ligados = ligarUnidades(caminhoes, unidades);
  let gravadas = 0, faltam = 0;
  const erros: string[] = [];
  for (const { caminhao: c, unidade: u } of ligados) {
    // O que já existe vem do espelho; o histórico preenche só antes da primeira posição.
    const primeira = await db.posicao.findFirst({ where: { caminhaoId: c.id }, orderBy: { data: "asc" }, select: { data: true } });
    let ate = primeira ? new Date(primeira.data.getTime() - 1000) : new Date(u.lmsg ? u.lmsg.t * 1000 : Date.now());
    if (ate <= desde) continue;
    if (Date.now() > fimDoPrazo) { faltam++; continue; }
    try {
      const dias = new Set<number>();
      while (ate > desde && Date.now() < fimDoPrazo) {
        const de = new Date(Math.max(desde.getTime(), ate.getTime() - PEDACO_HISTORICO_MS));
        const linhas = (await api.mensagens(u, de, ate))
          .map(paraPosicaoWialon)
          .filter((l) => l !== null)
          .map((l) => ({ caminhaoId: c.id, ...l }));
        if (linhas.length) await db.posicao.createMany({ data: linhas });
        if (!primeira && linhas.length) {
          // Caminhão sem nenhuma posição ainda: marca a mais nova, para o espelho não trazer de novo as mesmas.
          const u2 = linhas.reduce((x, y) => (y.data > x.data ? y : x));
          await db.caminhao.updateMany({
            where: { id: c.id, ultimaPosicaoEm: null },
            data: { ultimaPosicaoEm: u2.data, ultimaLat: u2.lat, ultimaLng: u2.lng, ultimaVelocidade: u2.velocidadeKmh, ultimaIgnicao: u2.ignicao, ultimaDirecao: u2.direcao },
          });
        }
        for (const d of diasDoParaguai(linhas.map((l) => l.data))) dias.add(d.getTime());
        gravadas += linhas.length;
        ate = new Date(de.getTime() - 1000);
      }
      if (ate > desde) faltam++;
      // Do dia mais antigo para o mais novo, para o odômetro de cada dia partir do anterior.
      for (const t of [...dias].sort((a, b) => a - b)) await gravarDia(db, null, c, new Date(t));
    } catch (e) {
      erros.push(`${c.placa}: ${(e as Error).message}`);
    }
  }
  return { caminhoes: ligados.length, gravadas, faltam, erros };
}
