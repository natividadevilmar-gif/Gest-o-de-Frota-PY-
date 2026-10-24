// Cores da plataforma por país de origem do cliente. O Paraguai é o padrão.
// Cada tema define a cor de destaque, a barra lateral e as faixas da bandeira
// que aparecem ao lado do nome.

export type Tema = {
  nome: string;
  /** Faixas da bandeira, na ordem em que aparecem. */
  faixas: string[];
  destaque: string;
  destaqueTexto: string;
  destaqueSuave: string;
  barra: string;
  barraTexto: string;
  /** Destaque um pouco mais claro para o modo escuro. */
  destaqueEscuro: string;
  destaqueSuaveEscuro: string;
};

export const TEMAS: Record<string, Tema> = {
  PY: { nome: "Paraguai", faixas: ["#D52B1E", "#FFFFFF", "#0038A8"], destaque: "#C8261B", destaqueTexto: "#FFFFFF", destaqueSuave: "#F8DEDB", barra: "#0B2E6F", barraTexto: "#EEF2FA", destaqueEscuro: "#F0675C", destaqueSuaveEscuro: "#3E1D1A" },
  DE: { nome: "Alemanha", faixas: ["#000000", "#DD0000", "#FFCE00"], destaque: "#C40000", destaqueTexto: "#FFFFFF", destaqueSuave: "#F9DCDC", barra: "#151515", barraTexto: "#F2F2F2", destaqueEscuro: "#FFCE00", destaqueSuaveEscuro: "#3A3110" },
  BR: { nome: "Brasil", faixas: ["#009C3B", "#FFDF00", "#002776"], destaque: "#00843D", destaqueTexto: "#FFFFFF", destaqueSuave: "#D6EFDF", barra: "#002776", barraTexto: "#EEF2FA", destaqueEscuro: "#FFDF00", destaqueSuaveEscuro: "#3A3510" },
  AR: { nome: "Argentina", faixas: ["#74ACDF", "#FFFFFF", "#74ACDF"], destaque: "#2F79B8", destaqueTexto: "#FFFFFF", destaqueSuave: "#DDEBF7", barra: "#1D3F5E", barraTexto: "#EEF4FA", destaqueEscuro: "#8FC0EA", destaqueSuaveEscuro: "#1A2C3C" },
  UY: { nome: "Uruguai", faixas: ["#FFFFFF", "#0038A8", "#FFFFFF"], destaque: "#0038A8", destaqueTexto: "#FFFFFF", destaqueSuave: "#DCE5F5", barra: "#0B2350", barraTexto: "#EEF2FA", destaqueEscuro: "#FCD116", destaqueSuaveEscuro: "#3A3312" },
  NL: { nome: "Holanda", faixas: ["#AE1C28", "#FFFFFF", "#21468B"], destaque: "#E06A00", destaqueTexto: "#FFFFFF", destaqueSuave: "#FBE4D0", barra: "#21468B", barraTexto: "#EEF2FA", destaqueEscuro: "#FF9233", destaqueSuaveEscuro: "#3D2A16" },
  IT: { nome: "Itália", faixas: ["#009246", "#FFFFFF", "#CE2B37"], destaque: "#008C45", destaqueTexto: "#FFFFFF", destaqueSuave: "#D6EFE1", barra: "#1C2A22", barraTexto: "#F1F5F2", destaqueEscuro: "#E2505B", destaqueSuaveEscuro: "#3D1C1F" },
  ES: { nome: "Espanha", faixas: ["#AA151B", "#F1BF00", "#AA151B"], destaque: "#AA151B", destaqueTexto: "#FFFFFF", destaqueSuave: "#F5DADB", barra: "#2A1010", barraTexto: "#F7EEEE", destaqueEscuro: "#F1BF00", destaqueSuaveEscuro: "#3A3110" },
  US: { nome: "Estados Unidos", faixas: ["#B22234", "#FFFFFF", "#3C3B6E"], destaque: "#B22234", destaqueTexto: "#FFFFFF", destaqueSuave: "#F6DADE", barra: "#3C3B6E", barraTexto: "#F0F0F7", destaqueEscuro: "#E8576A", destaqueSuaveEscuro: "#3D1C21" },
  JP: { nome: "Japão", faixas: ["#FFFFFF", "#BC002D", "#FFFFFF"], destaque: "#BC002D", destaqueTexto: "#FFFFFF", destaqueSuave: "#F6D9E0", barra: "#222222", barraTexto: "#F2F2F2", destaqueEscuro: "#EB4D6E", destaqueSuaveEscuro: "#3D1A22" },
};

export const PAIS_PADRAO = "PY";

export function temaDoPais(pais: string | null | undefined): Tema {
  return TEMAS[pais ?? PAIS_PADRAO] ?? TEMAS[PAIS_PADRAO];
}
