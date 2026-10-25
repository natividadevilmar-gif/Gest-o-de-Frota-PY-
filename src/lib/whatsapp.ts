// Mensagem de WhatsApp para o motorista, aberta pelo link wa.me (sem custo e sem API).

const DDI: Record<string, string> = { PY: "595", BR: "55", AR: "54", UY: "598", BO: "591", CL: "56" };

/** Número no formato internacional só com dígitos. Celular local (0981…) recebe o código do país. */
export function numeroInternacional(celular: string, pais: string): string {
  const d = celular.replace(/\D/g, "");
  if (!d) return "";
  if (celular.trim().startsWith("+") || Object.values(DDI).some((c) => d.startsWith(c) && d.length >= c.length + 9)) return d;
  return (DDI[pais] ?? DDI.PY) + d.replace(/^0+/, "");
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
