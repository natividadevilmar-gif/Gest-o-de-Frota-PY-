// Idiomas da plataforma. O português é o idioma em que as telas são escritas;
// os outros saem do dicionário em src/lib/i18n/frases.
export const IDIOMAS = ["pt", "es", "en", "de", "it"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export type IdiomaTraduzido = Exclude<Idioma, "pt">;

export const NOME_IDIOMA: Record<Idioma, string> = { pt: "Português", es: "Español", en: "English", de: "Deutsch", it: "Italiano" };
export const SIGLA_IDIOMA: Record<Idioma, string> = { pt: "PT", es: "ES", en: "EN", de: "DE", it: "IT" };
export const LANG_HTML: Record<Idioma, string> = { pt: "pt-BR", es: "es-PY", en: "en", de: "de", it: "it" };

/** Idioma escolhido antes do login (ou num aparelho sem usuário). */
export const COOKIE_IDIOMA = "gf_idioma";

export function idiomaValido(x: unknown): Idioma | null {
  return typeof x === "string" && (IDIOMAS as readonly string[]).includes(x) ? (x as Idioma) : null;
}
