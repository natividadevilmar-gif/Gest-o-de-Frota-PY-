// Contrato de prestação de serviço gerado no cadastro do cliente, em português ou espanhol.
// Texto-base para revisão de um advogado antes do primeiro uso; os dados da KM Cero ficam em EMPRESA.

import { NOME_PLANO, PRECO_MENSAL, type Plano } from "./indicadores";

/** Dados da contratada. Os entre colchetes ainda precisam ser preenchidos. */
export const EMPRESA = {
  razaoSocial: "KM Cero [razão social completa]",
  ruc: "[RUC da KM Cero]",
  endereco: "[endereço da KM Cero]",
  cidade: "Asunción",
  foro: "Asunción, República del Paraguay",
};

export const DIAS_SUSPENSAO = 15;

export type DadosContrato = {
  numero: string;
  cliente: { nome: string; ruc: string | null; endereco: string | null; cidade: string; representante: string; email: string };
  plano: Plano;
  caminhoes: number;
  prazoMeses: number;
  diaVencimento: number;
  inicio: Date;
};

const COBERTURA: Record<"pt" | "es", Record<Plano, string[]>> = {
  pt: {
    BASICO: [
      "rastreador KM Cero instalado em cada caminhão, em comodato",
      "mapa ao vivo e trajeto do dia",
      "central de monitoramento com alertas de excesso de velocidade, falta de sinal, uso de madrugada e cercas virtuais",
      "comandos remotos: bloqueio e desbloqueio do motor, posição e status do aparelho",
      "painel da frota, fretes, caixa dos motoristas e acesso dos motoristas pelo celular",
    ],
    GESTAO: [
      "tudo do plano Básico",
      "lançamento de despesas com leitura da foto do recibo",
      "custo por km, consumo e ranking de motoristas pela rede CAN",
      "controle de revisões, margem por viagem e relatórios em Excel",
    ],
    VIDEO: [
      "tudo dos planos Básico e Gestão",
      "duas câmeras por caminhão (estrada e cabine), em comodato",
      "gravação automática de vídeo em freadas, curvas, excesso de velocidade e impactos",
      "pedido de foto ou vídeo pela central e galeria de gravações",
    ],
  },
  es: {
    BASICO: [
      "rastreador KM Cero instalado en cada camión, en comodato",
      "mapa en vivo y recorrido del día",
      "central de monitoreo con alertas de exceso de velocidad, falta de señal, uso de madrugada y geocercas",
      "comandos remotos: bloqueo y desbloqueo del motor, posición y estado del equipo",
      "panel de la flota, fletes, caja de los choferes y acceso de los choferes por el celular",
    ],
    GESTAO: [
      "todo lo del plan Básico",
      "carga de gastos con lectura de la foto del comprobante",
      "costo por km, consumo y ranking de choferes por la red CAN",
      "control de mantenimientos, margen por viaje e informes en Excel",
    ],
    VIDEO: [
      "todo lo de los planes Básico y Gestión",
      "dos cámaras por camión (ruta y cabina), en comodato",
      "grabación automática de video en frenadas, curvas, exceso de velocidad e impactos",
      "pedido de foto o video desde la central y galería de grabaciones",
    ],
  },
};

const NOME_PLANO_ES: Record<Plano, string> = { BASICO: "Básico", GESTAO: "Gestión", VIDEO: "Video" };

const usd = (v: number) => `USD ${v.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataLonga = (d: Date, idioma: "pt" | "es") =>
  d.toLocaleDateString(idioma === "pt" ? "pt-BR" : "es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "long", year: "numeric" });

export function numeroContrato(clienteId: string, inicio: Date) {
  return `KMC-${inicio.getUTCFullYear()}-${clienteId.slice(-6).toUpperCase()}`;
}

export function valoresContrato(d: Pick<DadosContrato, "plano" | "caminhoes" | "prazoMeses">) {
  const porCaminhao = PRECO_MENSAL[d.plano];
  const mensal = porCaminhao * d.caminhoes;
  return { porCaminhao, mensal, total: mensal * d.prazoMeses };
}

export type Secao = { titulo: string; paragrafos: string[]; lista?: string[] };

export function textoContrato(d: DadosContrato, idioma: "pt" | "es"): { titulo: string; secoes: Secao[]; local: string } {
  const v = valoresContrato(d);
  const c = d.cliente;
  const ident = (pt: string, es: string) => (idioma === "pt" ? pt : es);
  const nomePlano = idioma === "pt" ? NOME_PLANO[d.plano] : NOME_PLANO_ES[d.plano];
  const docCliente = c.ruc ? `, RUC ${c.ruc}` : "";
  const endCliente = c.endereco ? `, ${ident("com sede em", "con domicilio en")} ${c.endereco}, ${c.cidade}` : `, ${c.cidade}`;

  const secoes: Secao[] = [
    {
      titulo: ident("Partes", "Partes"),
      paragrafos: [
        ident(
          `CONTRATADA: ${EMPRESA.razaoSocial}, RUC ${EMPRESA.ruc}, com sede em ${EMPRESA.endereco}, ${EMPRESA.cidade}, doravante "KM CERO".`,
          `PRESTADORA: ${EMPRESA.razaoSocial}, RUC ${EMPRESA.ruc}, con domicilio en ${EMPRESA.endereco}, ${EMPRESA.cidade}, en adelante "KM CERO".`,
        ),
        ident(
          `CONTRATANTE: ${c.nome}${docCliente}${endCliente}, representada por ${c.representante} (${c.email}), doravante "CLIENTE".`,
          `CLIENTE: ${c.nome}${docCliente}${endCliente}, representada por ${c.representante} (${c.email}), en adelante "EL CLIENTE".`,
        ),
      ],
    },
    {
      titulo: ident("1. Objeto", "1. Objeto"),
      paragrafos: [
        ident(
          `A KM CERO presta ao CLIENTE o serviço de rastreamento, monitoramento e gestão de frota pela plataforma KM Cero, no plano ${nomePlano}, para ${d.caminhoes} ${d.caminhoes === 1 ? "caminhão" : "caminhões"}. O plano inclui:`,
          `KM CERO presta al CLIENTE el servicio de rastreo, monitoreo y gestión de flota mediante la plataforma KM Cero, en el plan ${nomePlano}, para ${d.caminhoes} ${d.caminhoes === 1 ? "camión" : "camiones"}. El plan incluye:`,
        ),
      ],
      lista: COBERTURA[idioma][d.plano],
    },
    {
      titulo: ident("2. Preço e pagamento", "2. Precio y forma de pago"),
      paragrafos: [
        ident(
          `O CLIENTE paga ${usd(v.porCaminhao)} por caminhão por mês, totalizando ${usd(v.mensal)} mensais, com vencimento todo dia ${d.diaVencimento}. O valor pode ser pago em dólares ou em guaranis pela cotação do dia do pagamento.`,
          `EL CLIENTE abona ${usd(v.porCaminhao)} por camión por mes, totalizando ${usd(v.mensal)} mensuales, con vencimiento el día ${d.diaVencimento} de cada mes. El monto puede abonarse en dólares o en guaraníes al tipo de cambio del día del pago.`,
        ),
        ident(
          "Caminhões incluídos depois da assinatura são cobrados pelo mesmo valor a partir do mês da instalação. A mensalidade pode ser reajustada uma vez por ano, com aviso de 30 dias.",
          "Los camiones incorporados después de la firma se cobran al mismo valor desde el mes de la instalación. La mensualidad puede reajustarse una vez al año, con aviso de 30 días.",
        ),
        ident(
          `Com mais de ${DIAS_SUSPENSAO} dias de atraso, a KM CERO pode suspender o acesso à plataforma até a regularização, sem desligar o rastreamento dos caminhões.`,
          `Con más de ${DIAS_SUSPENSAO} días de atraso, KM CERO puede suspender el acceso a la plataforma hasta la regularización, sin desconectar el rastreo de los camiones.`,
        ),
      ],
    },
    {
      titulo: ident("3. Prazo", "3. Plazo"),
      paragrafos: [
        ident(
          `Este contrato vale por ${d.prazoMeses} meses a partir de ${dataLonga(d.inicio, "pt")} e se renova automaticamente por períodos iguais, salvo aviso de qualquer parte com 30 dias de antecedência.`,
          `Este contrato rige por ${d.prazoMeses} meses a partir del ${dataLonga(d.inicio, "es")} y se renueva automáticamente por períodos iguales, salvo aviso de cualquiera de las partes con 30 días de anticipación.`,
        ),
        ident(
          "Se o CLIENTE encerrar o contrato antes do prazo, paga 30% das mensalidades que faltariam até o fim do período, além dos equipamentos não devolvidos.",
          "Si EL CLIENTE rescinde el contrato antes del plazo, abona el 30% de las mensualidades que faltarían hasta el final del período, además de los equipos no devueltos.",
        ),
      ],
    },
    {
      titulo: ident("4. Equipamentos", "4. Equipos"),
      paragrafos: [
        ident(
          "Rastreadores, câmeras e acessórios são da KM CERO e ficam com o CLIENTE em comodato enquanto durar o contrato. A instalação e a manutenção por defeito são feitas pela KM CERO sem custo adicional.",
          "Los rastreadores, cámaras y accesorios son propiedad de KM CERO y quedan con EL CLIENTE en comodato mientras dure el contrato. La instalación y el mantenimiento por falla los realiza KM CERO sin costo adicional.",
        ),
        ident(
          "Danos por mau uso, violação, acidente, furto ou roubo do equipamento são cobrados do CLIENTE pelo valor de reposição. No fim do contrato, o CLIENTE permite a retirada dos equipamentos em até 15 dias.",
          "Los daños por mal uso, violación, accidente, hurto o robo del equipo se cobran al CLIENTE por el valor de reposición. Al terminar el contrato, EL CLIENTE permite el retiro de los equipos en un plazo de 15 días.",
        ),
      ],
    },
    {
      titulo: ident("5. Bloqueio do motor e alertas", "5. Bloqueo del motor y alertas"),
      paragrafos: [
        ident(
          "O bloqueio remoto do motor só é enviado por pedido de um gestor do CLIENTE e só é aplicado com o caminhão parado ou abaixo de 10 km/h. O CLIENTE é responsável pela decisão de bloquear e pelas consequências dessa decisão.",
          "El bloqueo remoto del motor solo se envía a pedido de un gestor del CLIENTE y solo se aplica con el camión detenido o a menos de 10 km/h. EL CLIENTE es responsable de la decisión de bloquear y de sus consecuencias.",
        ),
        ident(
          "O serviço depende da cobertura de celular e de GPS. A KM CERO não responde por falhas dessas redes, nem garante a recuperação de veículos roubados; os alertas são uma ferramenta de apoio e não substituem a vigilância do CLIENTE.",
          "El servicio depende de la cobertura celular y de GPS. KM CERO no responde por fallas de esas redes ni garantiza la recuperación de vehículos robados; las alertas son una herramienta de apoyo y no reemplazan la vigilancia del CLIENTE.",
        ),
      ],
    },
    {
      titulo: ident("6. Dados e imagens", "6. Datos e imágenes"),
      paragrafos: [
        ident(
          "Os dados de posição, despesas, fotos e vídeos pertencem ao CLIENTE e só são usados para prestar este serviço. O CLIENTE informa aos motoristas que o caminhão é rastreado e, no plano Vídeo, que a cabine é filmada.",
          "Los datos de posición, gastos, fotos y videos pertenecen al CLIENTE y solo se usan para prestar este servicio. EL CLIENTE informa a los choferes que el camión es rastreado y, en el plan Video, que la cabina es filmada.",
        ),
      ],
    },
    {
      titulo: ident("7. Foro", "7. Jurisdicción"),
      paragrafos: [
        ident(
          `As partes elegem o foro de ${EMPRESA.foro} para resolver qualquer questão deste contrato.`,
          `Las partes se someten a los tribunales de ${EMPRESA.foro} para resolver cualquier cuestión de este contrato.`,
        ),
      ],
    },
  ];

  return {
    titulo: ident("Contrato de prestação de serviços de rastreamento e gestão de frota", "Contrato de prestación de servicios de rastreo y gestión de flota"),
    secoes,
    local: `${EMPRESA.cidade}, ${dataLonga(d.inicio, idioma)}.`,
  };
}
