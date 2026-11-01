// CRT: Carta de Porte Internacional por Carretera / Conhecimento de Transporte Internacional por Rodovia
// (Acordo de Transporte Internacional Terrestre, ATIT). Os números são os dos campos do formulário.
import { z } from "zod";
import { lerValor } from "@/lib/formato";
import { NOME_PAIS, prazoDias } from "@/lib/micDta";

export type CampoCrt = { n: string; chave: keyof DadosCrt; es: string; pt: string; linhas?: number };

export const CAMPOS_CRT: CampoCrt[] = [
  { n: "1", chave: "remitente", es: "Nombre y domicilio del remitente", pt: "Nome e endereço do remetente", linhas: 3 },
  { n: "2", chave: "numero", es: "Número", pt: "Número" },
  { n: "3", chave: "porteador", es: "Nombre y domicilio del porteador", pt: "Nome e endereço do transportador", linhas: 3 },
  { n: "3", chave: "permiso", es: "Permiso internacional (licencia) Nº", pt: "Licença internacional Nº" },
  { n: "4", chave: "destinatario", es: "Nombre y domicilio del destinatario", pt: "Nome e endereço do destinatário", linhas: 3 },
  { n: "5", chave: "consignatario", es: "Nombre y domicilio del consignatario", pt: "Nome e endereço do consignatário", linhas: 3 },
  { n: "6", chave: "notificar", es: "Notificar a", pt: "Notificar a", linhas: 2 },
  { n: "7", chave: "lugarEmision", es: "Lugar y país de emisión", pt: "Local e país de emissão" },
  { n: "8", chave: "lugarCarga", es: "Lugar, país y fecha en que el porteador se hace cargo de las mercaderías", pt: "Local, país e data em que o transportador se responsabiliza pelas mercadorias", linhas: 2 },
  { n: "9", chave: "lugarEntrega", es: "Lugar, país y plazo de entrega", pt: "Local, país e prazo de entrega", linhas: 2 },
  { n: "10", chave: "porteadoresSucesivos", es: "Porteadores sucesivos", pt: "Transportadores sucessivos", linhas: 2 },
  { n: "11", chave: "descripcion", es: "Cantidad y clase de bultos, marcas y números, tipo de mercaderías, contenedores y accesorios", pt: "Quantidade e categoria de volumes, marcas e números, tipos de mercadorias, contêineres e acessórios", linhas: 5 },
  { n: "12", chave: "pesoBruto", es: "Peso bruto (kg)", pt: "Peso bruto (kg)" },
  { n: "12", chave: "pesoNeto", es: "Peso neto (kg)", pt: "Peso líquido (kg)" },
  { n: "13", chave: "volumen", es: "Volumen en m³", pt: "Volume em m³" },
  { n: "14", chave: "valor", es: "Valor", pt: "Valor" },
  { n: "14", chave: "incoterm", es: "Incoterms", pt: "Incoterms" },
  { n: "14", chave: "moneda", es: "Moneda", pt: "Moeda" },
  { n: "15", chave: "flete", es: "Flete", pt: "Frete" },
  { n: "15", chave: "seguro", es: "Seguro", pt: "Seguro" },
  { n: "15", chave: "otros", es: "Otros gastos", pt: "Outras despesas" },
  { n: "15", chave: "pagador", es: "Gastos a pagar por", pt: "Despesas pagas por" },
  { n: "16", chave: "declaracionValor", es: "Declaración del valor de las mercaderías", pt: "Declaração do valor das mercadorias" },
  { n: "17", chave: "documentosAnexos", es: "Documentos anexos", pt: "Documentos anexos", linhas: 2 },
  { n: "18", chave: "instruccionesAduana", es: "Instrucciones sobre formalidades de aduana", pt: "Instruções sobre formalidades de alfândega", linhas: 2 },
  { n: "19", chave: "fleteExterno", es: "Monto del flete externo", pt: "Valor do frete externo" },
  { n: "20", chave: "reembolso", es: "Monto de reembolso contra entrega", pt: "Valor de reembolso contra entrega" },
  { n: "22", chave: "observaciones", es: "Declaraciones y observaciones del porteador", pt: "Declarações e observações do transportador", linhas: 3 },
  { n: "21", chave: "fechaEmision", es: "Fecha de emisión", pt: "Data de emissão" },
];

const texto = (max = 300) => z.string().trim().max(max).default("");

export const esquemaCrt = z.object({
  remitente: texto(), numero: texto(40), porteador: texto(), permiso: texto(60),
  destinatario: texto(), consignatario: texto(), notificar: texto(),
  lugarEmision: texto(), lugarCarga: texto(), lugarEntrega: texto(), porteadoresSucesivos: texto(),
  descripcion: texto(1200), pesoBruto: texto(40), pesoNeto: texto(40), volumen: texto(40),
  valor: texto(40), incoterm: texto(20), moneda: texto(20),
  flete: texto(40), seguro: texto(40), otros: texto(40), pagador: z.enum(["REMITENTE", "DESTINATARIO"]).default("REMITENTE"),
  declaracionValor: texto(80), documentosAnexos: texto(), instruccionesAduana: texto(),
  fleteExterno: texto(40), reembolso: texto(40), observaciones: texto(), fechaEmision: texto(20),
});

export type DadosCrt = z.infer<typeof esquemaCrt>;

/** Campos que se repetem do último CRT do mesmo remetente (quem recebe a carga costuma ser o mesmo). */
export const CAMPOS_DO_REMETENTE = ["destinatario", "consignatario", "notificar", "instruccionesAduana", "incoterm", "documentosAnexos"] as const;
export const CAMPOS_DA_EMPRESA_CRT = ["porteador", "permiso"] as const;

type Entrada = {
  viagem: {
    data: Date; origem: string; destino: string; paisOrigem: string; paisDestino: string; carga: string; toneladas: number;
    freteUsd: number; embarcador: string | null; documento: string | null; rotaKm: number | null; kmCarregado: number;
  };
  cliente: { nome: string; ruc: string | null; endereco: string | null; cidade: string; pais: string };
  numero: string;
  /** Último CRT do mesmo remetente e da mesma empresa, de onde vêm os dados que se repetem. */
  anteriorRemetente?: Partial<DadosCrt> | null;
  anteriorEmpresa?: Partial<DadosCrt> | null;
  /** Licença internacional já usada no MIC/DTA, se ainda não houver CRT. */
  permisoMic?: string | null;
};

const dataEs = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const pais = (p: string) => NOME_PAIS[p] ?? p;

/** Número do CRT: o do documento do frete (sem o "CRT") ou país + licença + sequência (ex.: PY0815000123). */
export function numeroCrt(paisEmpresa: string, permiso: string | null | undefined, sequencia: number, documento?: string | null): string {
  const doc = documento?.replace(/^\s*CRT[\s.:Nº°-]*/i, "").trim();
  if (doc) return doc;
  const licenca = (permiso ?? "").replace(/\D/g, "").slice(0, 4).padStart(4, "0");
  return `${paisEmpresa}${licenca}${String(sequencia).padStart(6, "0")}`;
}

/** Preenche o CRT com o que a KM Cero já sabe do frete e da transportadora. */
export function crtPadrao(e: Entrada): DadosCrt {
  const { viagem: v, cliente } = e;
  const domicilio = [cliente.endereco, cliente.cidade, pais(cliente.pais)].filter(Boolean).join(", ");
  const kg = Math.round(v.toneladas * 1000);
  const km = v.rotaKm ?? v.kmCarregado;
  const base: DadosCrt = esquemaCrt.parse({
    remitente: v.embarcador ?? "",
    numero: e.numero,
    porteador: `${cliente.nome}${cliente.ruc ? ` · RUC ${cliente.ruc}` : ""}\n${domicilio}`,
    permiso: e.permisoMic ?? "",
    lugarEmision: `${cliente.cidade}, ${pais(cliente.pais)}`,
    lugarCarga: `${v.origem}, ${pais(v.paisOrigem)}, ${dataEs(v.data)}`,
    lugarEntrega: `${v.destino}, ${pais(v.paisDestino)} · plazo ${prazoDias(km)} días`,
    descripcion: `${v.carga} a granel, ${kg.toLocaleString("es-PY")} kg`,
    pesoBruto: String(kg),
    pesoNeto: String(kg),
    moneda: "USD",
    flete: v.freteUsd.toFixed(2),
    pagador: "REMITENTE",
    documentosAnexos: "Factura comercial",
    fleteExterno: v.freteUsd.toFixed(2),
    fechaEmision: dataEs(v.data),
  });
  const copia = (de: Partial<DadosCrt> | null | undefined, chaves: readonly (keyof DadosCrt)[]) => {
    for (const k of chaves) {
      const valor = de?.[k];
      if (typeof valor === "string" && valor.trim()) (base as Record<string, string>)[k] = valor;
    }
  };
  copia(e.anteriorEmpresa, CAMPOS_DA_EMPRESA_CRT);
  // O remetente só repete quando é o mesmo cliente que paga o frete.
  if (e.anteriorRemetente?.remitente?.split("\n")[0].trim() === (v.embarcador ?? "").trim()) {
    copia(e.anteriorRemetente, ["remitente", ...CAMPOS_DO_REMETENTE]);
  }
  return base;
}

/** Soma dos gastos do campo 15 (frete + seguro + outros), lendo "1.234,56" ou "1234.56". */
export function totalGastos(d: Pick<DadosCrt, "flete" | "seguro" | "otros">): number {
  const ler = (s: string) => (s.trim() ? lerValor(s) || 0 : 0);
  return Math.round((ler(d.flete) + ler(d.seguro) + ler(d.otros)) * 100) / 100;
}
