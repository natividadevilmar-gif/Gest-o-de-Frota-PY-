// Regras da foto e do vídeo da carga feitos pelo motorista.

/** Foto reduzida no celular (~300 KB); vídeo gravado em baixa taxa (15 s ≈ 1,5 MB). */
export const MAX_FOTO_BYTES = 1_500_000;
export const MAX_VIDEO_BYTES = 4_000_000;
export const MAX_VIDEO_S = 15;

const FORMATOS = { foto: ["image/jpeg"], video: ["video/webm", "video/mp4"] } as const;

export type TipoRegistro = keyof typeof FORMATOS;

/** Tira parâmetros como ";codecs=vp8" e confere tipo, formato e tamanho. Devolve o formato limpo ou o erro. */
export function validarArquivo(tipo: string, formato: string, tamanho: number): { ok: true; formato: string } | { ok: false; erro: string } {
  if (tipo !== "foto" && tipo !== "video") return { ok: false, erro: "Tipo inválido." };
  const limpo = formato.split(";")[0].trim().toLowerCase();
  if (!(FORMATOS[tipo] as readonly string[]).includes(limpo)) return { ok: false, erro: "Formato de arquivo não aceito." };
  if (tamanho <= 0) return { ok: false, erro: "Arquivo vazio." };
  const max = tipo === "foto" ? MAX_FOTO_BYTES : MAX_VIDEO_BYTES;
  if (tamanho > max) return { ok: false, erro: tipo === "foto" ? "Foto grande demais." : "Vídeo grande demais. Grave até 15 segundos." };
  return { ok: true, formato: limpo };
}

/** Lê o cabeçalho Range ("bytes=100-" ou "bytes=100-199"), que o Safari exige para tocar vídeo. */
export function faixaPedida(range: string | null, total: number): { inicio: number; fim: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range?.trim() ?? "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let inicio: number;
  let fim: number;
  if (m[1] === "") {
    // "bytes=-500": os últimos 500 bytes.
    inicio = Math.max(0, total - Number(m[2]));
    fim = total - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (inicio > fim || inicio >= total) return null;
  return { inicio, fim };
}
