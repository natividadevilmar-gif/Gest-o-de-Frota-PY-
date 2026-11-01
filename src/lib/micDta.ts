// MIC/DTA: Manifiesto Internacional de Carga por Carretera / Declaración de Tránsito Aduanero
// (Acordo de Transporte Internacional Terrestre, ATIT). Os números são os dos campos do formulário.
import { z } from "zod";

export type CampoMic = { n: string; chave: keyof DadosMic; es: string; pt: string; linhas?: number };

/** Campos do formulário na ordem oficial; o caminhão substituto (16 a 22) fica em branco para a aduana. */
export const CAMPOS_MIC: CampoMic[] = [
  { n: "1", chave: "porteador", es: "Nombre y domicilio del porteador", pt: "Nome e endereço do transportador", linhas: 3 },
  { n: "2", chave: "porteadorRuc", es: "Rol de contribuyente", pt: "Cadastro geral de contribuintes" },
  { n: "1", chave: "permiso", es: "Permiso internacional (licencia) Nº", pt: "Licença internacional Nº" },
  { n: "3", chave: "transito", es: "Tránsito aduanero", pt: "Trânsito aduaneiro" },
  { n: "4", chave: "numero", es: "Nº", pt: "Nº" },
  { n: "5", chave: "hoja", es: "Hoja", pt: "Folha" },
  { n: "6", chave: "fechaEmision", es: "Fecha de emisión", pt: "Data de emissão" },
  { n: "7", chave: "aduanaPartida", es: "Aduana, ciudad y país de partida", pt: "Alfândega, cidade e país de partida" },
  { n: "8", chave: "destinoFinal", es: "Ciudad y país de destino final", pt: "Cidade e país de destino final" },
  { n: "9", chave: "propietario", es: "Camión original: nombre y domicilio del propietario", pt: "Caminhão original: nome e endereço do proprietário", linhas: 2 },
  { n: "10", chave: "propietarioRuc", es: "Rol de contribuyente", pt: "Cadastro geral de contribuintes" },
  { n: "11", chave: "placa", es: "Placa de camión", pt: "Placa do caminhão" },
  { n: "12", chave: "marcaNumero", es: "Marca y número", pt: "Marca e número" },
  { n: "13", chave: "capacidad", es: "Capacidad de arrastre (t)", pt: "Capacidade de tração (t)" },
  { n: "14", chave: "ano", es: "Año", pt: "Ano" },
  { n: "15", chave: "remolque", es: "Semirremolque / Remolque: placa", pt: "Semirreboque / Reboque: placa" },
  { n: "23", chave: "crt", es: "Nº carta de porte", pt: "Nº do conhecimento" },
  { n: "24", chave: "aduanaDestino", es: "Aduana de destino", pt: "Alfândega de destino" },
  { n: "25", chave: "moneda", es: "Moneda", pt: "Moeda" },
  { n: "26", chave: "origenMercaderias", es: "Origen de las mercaderías", pt: "Origem das mercadorias" },
  { n: "27", chave: "valorFot", es: "Valor FOT", pt: "Valor FOT" },
  { n: "28", chave: "flete", es: "Flete en US$", pt: "Frete em US$" },
  { n: "29", chave: "seguro", es: "Seguro en US$", pt: "Seguro em US$" },
  { n: "30", chave: "tipoBultos", es: "Tipo de bultos", pt: "Tipo dos volumes" },
  { n: "31", chave: "cantidadBultos", es: "Cantidad de bultos", pt: "Quantidade de volumes" },
  { n: "32", chave: "pesoBruto", es: "Peso bruto (kg)", pt: "Peso bruto (kg)" },
  { n: "33", chave: "remitente", es: "Remitente", pt: "Remetente", linhas: 2 },
  { n: "34", chave: "destinatario", es: "Destinatario", pt: "Destinatário", linhas: 2 },
  { n: "35", chave: "consignatario", es: "Consignatario", pt: "Consignatário", linhas: 2 },
  { n: "36", chave: "documentosAnexos", es: "Documentos anexos", pt: "Documentos anexos", linhas: 2 },
  { n: "37", chave: "precintos", es: "Número de precintos", pt: "Número dos lacres" },
  { n: "38", chave: "descripcion", es: "Marcas y números de los bultos, descripción de las mercaderías", pt: "Marcas e números dos volumes, descrição das mercadorias", linhas: 4 },
  { n: "40", chave: "rutaPlazo", es: "Nº DTA, ruta y plazo de transporte", pt: "Nº DTA, rota e prazo de transporte", linhas: 2 },
];

const texto = (max = 300) => z.string().trim().max(max).default("");

export const esquemaMic = z.object({
  porteador: texto(), porteadorRuc: texto(40), permiso: texto(60), transito: z.enum(["SI", "NO"]).default("SI"),
  numero: texto(40), hoja: texto(10), fechaEmision: texto(20),
  aduanaPartida: texto(), destinoFinal: texto(),
  propietario: texto(), propietarioRuc: texto(40), placa: texto(20), marcaNumero: texto(120), capacidad: texto(20), ano: texto(10), remolque: texto(40),
  crt: texto(60), aduanaDestino: texto(), moneda: texto(20), origenMercaderias: texto(120),
  valorFot: texto(40), flete: texto(40), seguro: texto(40),
  tipoBultos: texto(80), cantidadBultos: texto(40), pesoBruto: texto(40),
  remitente: texto(), destinatario: texto(), consignatario: texto(), documentosAnexos: texto(),
  precintos: texto(120), descripcion: texto(1200), rutaPlazo: texto(),
});

export type DadosMic = z.infer<typeof esquemaMic>;

export const NOME_PAIS: Record<string, string> = { PY: "Paraguay", BR: "Brasil", AR: "Argentina", BO: "Bolivia", UY: "Uruguay", CL: "Chile" };

/** Campos que vêm do caminhão e da transportadora: repetidos do último MIC salvo para não digitar de novo. */
export const CAMPOS_DO_VEICULO = ["propietario", "propietarioRuc", "marcaNumero", "capacidad", "ano", "remolque"] as const;
export const CAMPOS_DA_EMPRESA = ["porteador", "porteadorRuc", "permiso"] as const;

type Entrada = {
  viagem: {
    data: Date; origem: string; destino: string; paisOrigem: string; paisDestino: string; carga: string; toneladas: number;
    freteUsd: number; embarcador: string | null; documento: string | null; rotaKm: number | null; kmCarregado: number;
  };
  caminhao: { placa: string; modelo: string; ano: number | null };
  cliente: { nome: string; ruc: string | null; endereco: string | null; cidade: string; pais: string };
  numero: string;
  /** Último MIC do mesmo caminhão e da mesma empresa, de onde vêm os dados fixos. */
  anteriorCaminhao?: Partial<DadosMic> | null;
  anteriorEmpresa?: Partial<DadosMic> | null;
};

const dataEs = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/** Dias de viagem para o campo 40: 450 km por dia, no mínimo 2. */
export function prazoDias(km: number): number {
  return Math.max(2, Math.ceil(km / 450));
}

/** Preenche o MIC com o que a KM Cero já sabe do frete, do caminhão e da transportadora. */
export function micPadrao(e: Entrada): DadosMic {
  const { viagem: v, caminhao: c, cliente } = e;
  const domicilio = [cliente.endereco, cliente.cidade, NOME_PAIS[cliente.pais] ?? cliente.pais].filter(Boolean).join(", ");
  const empresa = `${cliente.nome}\n${domicilio}`;
  const km = v.rotaKm ?? v.kmCarregado;
  const base: DadosMic = esquemaMic.parse({
    porteador: empresa,
    porteadorRuc: cliente.ruc ?? "",
    transito: "SI",
    numero: e.numero,
    hoja: "1/1",
    fechaEmision: dataEs(v.data),
    aduanaPartida: `${v.origem}, ${NOME_PAIS[v.paisOrigem] ?? v.paisOrigem}`,
    destinoFinal: `${v.destino}, ${NOME_PAIS[v.paisDestino] ?? v.paisDestino}`,
    propietario: empresa,
    propietarioRuc: cliente.ruc ?? "",
    placa: c.placa,
    marcaNumero: c.modelo,
    ano: c.ano ? String(c.ano) : "",
    crt: v.documento ?? "",
    aduanaDestino: `${v.destino}, ${NOME_PAIS[v.paisDestino] ?? v.paisDestino}`,
    moneda: "USD",
    origenMercaderias: NOME_PAIS[v.paisOrigem] ?? v.paisOrigem,
    flete: v.freteUsd.toFixed(2),
    tipoBultos: "A granel",
    pesoBruto: String(Math.round(v.toneladas * 1000)),
    remitente: v.embarcador ?? "",
    descripcion: `${v.carga} a granel, ${Math.round(v.toneladas * 1000).toLocaleString("es-PY")} kg`,
    documentosAnexos: v.documento ? `CRT ${v.documento.replace(/^CRT\s*/i, "")}, factura comercial` : "CRT, factura comercial",
    rutaPlazo: `${v.origem} – ${v.destino} · ${prazoDias(km)} días`,
  });
  const copia = (de: Partial<DadosMic> | null | undefined, chaves: readonly (keyof DadosMic)[]) => {
    for (const k of chaves) {
      const valor = de?.[k];
      if (typeof valor === "string" && valor.trim()) (base as Record<string, string>)[k] = valor;
    }
  };
  copia(e.anteriorEmpresa, CAMPOS_DA_EMPRESA);
  copia(e.anteriorCaminhao, CAMPOS_DO_VEICULO);
  return base;
}

/** Número sugerido: sigla do país, ano com dois dígitos e sequência do ano (ex.: PY26000123). */
export function numeroMic(pais: string, ano: number, sequencia: number): string {
  return `${pais}${String(ano % 100).padStart(2, "0")}${String(sequencia).padStart(6, "0")}`;
}
