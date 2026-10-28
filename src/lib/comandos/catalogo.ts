// Comandos que a KM Cero manda aos rastreadores Teltonika (Codec 12) e às câmeras DualCam.
// Arquivo sem banco: usado pelas telas, pelo receptor e pelos testes.

export type TipoComando = "bloquear" | "desbloquear" | "posicao" | "status" | "info" | "reiniciar" | "foto" | "video" | "livre";

export const COMANDOS: Record<TipoComando, { rotulo: string; descricao: string; texto: string }> = {
  bloquear: { rotulo: "Bloquear motor", descricao: "Corta a partida pelo relé do rastreador. Só é aplicado com o caminhão parado ou abaixo de 10 km/h.", texto: "setdigout 1" },
  desbloquear: { rotulo: "Desbloquear motor", descricao: "Libera a partida de novo.", texto: "setdigout 0" },
  posicao: { rotulo: "Pedir posição agora", descricao: "O aparelho responde com o GPS do momento.", texto: "getgps" },
  status: { rotulo: "Status do aparelho", descricao: "Sinal do celular, GPS e conexão.", texto: "getstatus" },
  info: { rotulo: "Informações do aparelho", descricao: "Data, versão e contadores internos.", texto: "getinfo" },
  reiniciar: { rotulo: "Reiniciar rastreador", descricao: "Reinicia o aparelho; ele volta a conectar em cerca de 1 minuto.", texto: "cpureset" },
  foto: { rotulo: "Pedir foto", descricao: "Tira uma foto da câmera escolhida.", texto: "camreq:1,1" },
  video: { rotulo: "Pedir vídeo", descricao: "Envia os últimos segundos gravados pela câmera.", texto: "camreq:0,1" },
  livre: { rotulo: "Comando livre", descricao: "Texto enviado como está ao aparelho (só equipe KM Cero).", texto: "" },
};

/** Bloqueio remoto do motor desligado na plataforma: não se pede nem se envia. O desbloqueio continua. */
export const BLOQUEIO_ATIVO = false;
/** Comando livre que liga a saída do relé (o mesmo que bloquear). */
export const ehTextoDeBloqueio = (texto: string) => /setdigout\s*1/i.test(texto);

/** O bloqueio espera o caminhão ficar abaixo desta velocidade, por segurança. */
export const VELOCIDADE_MAX_BLOQUEIO = 10;
/** Sem resposta neste tempo, o comando enviado vira erro. */
export const ESPERA_RESPOSTA_MS = 90_000;
export const DURACAO_VIDEO_S = 10;

export const NOME_STATUS_COMANDO: Record<string, string> = {
  pendente: "Na fila",
  aguardando: "Esperando parar",
  enviado: "Enviado",
  respondido: "Respondido",
  erro: "Sem resposta",
  cancelado: "Cancelado",
};

/** Texto que vai ao aparelho. Câmera: 1 frontal (estrada), 2 cabine. */
export function textoComando(tipo: TipoComando, opcoes: { camera?: "frontal" | "cabine"; agora?: Date; livre?: string } = {}): string {
  const cam = opcoes.camera === "cabine" ? 2 : 1;
  if (tipo === "foto") return `camreq:1,${cam}`;
  if (tipo === "video") {
    const fim = Math.floor((opcoes.agora ?? new Date()).getTime() / 1000);
    return `camreq:0,${cam},${fim - DURACAO_VIDEO_S},${DURACAO_VIDEO_S}`;
  }
  if (tipo === "livre") return (opcoes.livre ?? "").trim();
  return COMANDOS[tipo].texto;
}

/** O que a resposta do aparelho muda no caminhão (motor bloqueado ou não). */
export function efeitoNoMotor(tipo: string): boolean | null {
  return tipo === "bloquear" ? true : tipo === "desbloquear" ? false : null;
}

/** Pode sair agora? O bloqueio só com o caminhão (quase) parado. */
export function podeEnviar(tipo: string, velocidadeKmh: number | null): boolean {
  return tipo !== "bloquear" || (velocidadeKmh ?? 0) <= VELOCIDADE_MAX_BLOQUEIO;
}
