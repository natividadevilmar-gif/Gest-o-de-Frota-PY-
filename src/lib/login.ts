// Identificador de login: e-mail para gestores e equipe; número de celular
// (só dígitos) para motoristas.
export function normalizarLogin(v: string): string {
  const t = v.trim().toLowerCase();
  return t.includes("@") ? t : t.replace(/\D/g, "");
}

/** Páginas que o motorista pode abrir; o resto redireciona para Lançar despesa. */
export const PAGINAS_MOTORISTA = ["/despesas", "/senha", "/recibos/", "/carga/"];
