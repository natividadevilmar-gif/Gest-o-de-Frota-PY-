// Mensagem de WhatsApp para o motorista, aberta pelo link wa.me (sem custo e sem API).

/** Código de cada país (DDI) e o tamanho mínimo do número internacional completo. */
export const PAISES_DDI = [
  { pais: "PY", ddi: "595", nome: "🇵🇾 +595", min: 12 },
  { pais: "BR", ddi: "55", nome: "🇧🇷 +55", min: 12 },
  { pais: "AR", ddi: "54", nome: "🇦🇷 +54", min: 12 },
  { pais: "UY", ddi: "598", nome: "🇺🇾 +598", min: 11 },
  { pais: "BO", ddi: "591", nome: "🇧🇴 +591", min: 11 },
  { pais: "CL", ddi: "56", nome: "🇨🇱 +56", min: 11 },
];

/**
 * Separa o código do país e o número local. Número com código já incluído (sem o 0 da frente
 * e com o tamanho de número internacional) mantém o código; senão usa o país padrão.
 */
export function separarNumero(celular: string, paisPadrao: string): { ddi: string; local: string } {
  const d = celular.replace(/\D/g, "");
  const padrao = (PAISES_DDI.find((p) => p.pais === paisPadrao) ?? PAISES_DDI[0]).ddi;
  if (!d.startsWith("0")) {
    const p = PAISES_DDI.find((x) => d.startsWith(x.ddi) && d.length >= x.min);
    if (p) return { ddi: p.ddi, local: d.slice(p.ddi.length) };
  }
  return { ddi: padrao, local: d.replace(/^0+/, "") };
}

/** Número internacional só com dígitos: código do país + número local sem o 0 da frente. */
export function numeroInternacional(celular: string, pais: string): string {
  const { ddi, local } = separarNumero(celular, pais);
  return local ? ddi + local : "";
}

/** Junta o código escolhido com o número digitado (aceita o número já com o código). */
export function juntarNumero(ddi: string, local: string): string {
  const d = local.replace(/\D/g, "").replace(/^0+/, "");
  return d ? ddi + (d.startsWith(ddi) && d.length > 9 ? d.slice(ddi.length) : d) : "";
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

const SITE = "gest-o-de-frota-py.vercel.app/motorista";

/** Cobrança urgente do pedágio não lançado, no idioma do motorista. */
export function mensagemPedagio(o: { nome: string | null; placa: string; detalhe: string }, idioma: "pt" | "es"): string {
  const m = /Passou por (.+) em (\S+) \(previsto (.+?)\)/.exec(o.detalhe);
  const pracas = m?.[1] ?? "";
  const dia = m?.[2] ?? "";
  const previsto = m?.[3] ?? "";
  const ola = o.nome ? ` ${o.nome.split(" ")[0]}` : "";
  return idioma === "es"
    ? `⚠️ URGENTE · Peaje sin registrar\n\nHola${ola}, el camión ${o.placa} pasó por el peaje ${pracas} el ${dia} (previsto ${previsto}) y el gasto no fue cargado.\n\nCargá ahora el comprobante del peaje en la app: ${SITE}\n\nSi no tenés el comprobante, respondé este mensaje explicando lo que pasó.`
    : `⚠️ URGENTE · Pedágio não registrado\n\nOlá${ola}, o caminhão ${o.placa} passou pelo pedágio ${pracas} em ${dia} (previsto ${previsto}) e a despesa não foi lançada.\n\nLance agora o recibo do pedágio no app: ${SITE}\n\nSe não tiver o recibo, responda esta mensagem explicando o que aconteceu.`;
}

type Ocorr = { tipo: string; titulo: string; detalhe: string; placa: string; nome: string | null };

/** Texto pronto para qualquer alerta da central, no idioma do motorista. O operador pode editar antes de enviar. */
export function mensagemOcorrencia(o: Ocorr, idioma: "pt" | "es"): string {
  if (o.tipo === "pedagio_sem_registro") return mensagemPedagio(o, idioma);
  const es = idioma === "es";
  const ola = `${es ? "Hola" : "Olá"}${o.nome ? ` ${o.nome.split(" ")[0]}` : ""}`;
  const vel = /a (\d+) km\/h/.exec(o.titulo)?.[1];
  const textos: Record<string, [string, string]> = {
    excesso: [
      `⚠️ Excesso de velocidade\n\n${ola}, o caminhão ${o.placa} está${vel ? ` a ${vel} km/h` : " acima do limite"}. Reduza a velocidade agora, por favor. Segurança em primeiro lugar.`,
      `⚠️ Exceso de velocidad\n\n${ola}, el camión ${o.placa} está${vel ? ` a ${vel} km/h` : " por encima del límite"}. Reducí la velocidad ahora, por favor. La seguridad primero.`,
    ],
    sem_sinal: [
      `📡 Sem sinal do rastreador\n\n${ola}, o caminhão ${o.placa} está sem enviar posição. Está tudo bem? Responda com sua localização, por favor.`,
      `📡 Sin señal del rastreador\n\n${ola}, el camión ${o.placa} no está enviando posición. ¿Está todo bien? Respondé con tu ubicación, por favor.`,
    ],
    ignicao_noturna: [
      `🌙 Caminhão rodando de madrugada\n\n${ola}, o caminhão ${o.placa} está em movimento fora do horário. Está tudo bem? Responda o motivo, por favor.`,
      `🌙 Camión circulando de madrugada\n\n${ola}, el camión ${o.placa} está en movimiento fuera de horario. ¿Está todo bien? Respondé el motivo, por favor.`,
    ],
    entrada_cerca: [
      `📍 Aviso de localização\n\n${ola}, o caminhão ${o.placa}: ${o.titulo.replace(`${o.placa} `, "")}. Confirme se está tudo certo, por favor.`,
      `📍 Aviso de ubicación\n\n${ola}, el camión ${o.placa} entró en un área controlada. Confirmá si está todo bien, por favor.`,
    ],
    desvio_rota: [
      `🛣️ Desvio de rota\n\n${ola}, o caminhão ${o.placa} saiu da rota prevista do frete (${o.detalhe}). Está tudo bem? Responda o motivo, por favor.`,
      `🛣️ Desvío de ruta\n\n${ola}, el camión ${o.placa} salió de la ruta prevista del flete. ¿Está todo bien? Respondé el motivo, por favor.`,
    ],
    saida_cerca: [
      `📍 Aviso de localização\n\n${ola}, o caminhão ${o.placa}: ${o.titulo.replace(`${o.placa} `, "")}. Confirme se está tudo certo, por favor.`,
      `📍 Aviso de ubicación\n\n${ola}, el camión ${o.placa} salió de un área controlada. Confirmá si está todo bien, por favor.`,
    ],
  };
  const direcao: [string, string] = [
    `⚠️ Direção\n\n${ola}, o rastreador do caminhão ${o.placa} registrou ${o.titulo.split(" · ")[1]?.toLowerCase() ?? "um evento de direção"}. Dirija com cuidado, por favor. Está tudo bem?`,
    `⚠️ Conducción\n\n${ola}, el rastreador del camión ${o.placa} registró una maniobra brusca. Manejá con cuidado, por favor. ¿Está todo bien?`,
  ];
  const t = textos[o.tipo] ?? (["freada", "aceleracao", "curva"].includes(o.tipo) ? direcao : null);
  if (t) return `${t[es ? 1 : 0]}\n\nKM Cero · ${es ? "Central de monitoreo" : "Central de monitoramento"}`;
  return es
    ? `${ola}, te escribimos por el camión ${o.placa}. Por favor, respondé este mensaje.\n\nKM Cero · Central de monitoreo`
    : `${ola}, sobre o caminhão ${o.placa}: ${o.titulo}. ${o.detalhe}\n\nResponda esta mensagem, por favor.\n\nKM Cero · Central de monitoramento`;
}
