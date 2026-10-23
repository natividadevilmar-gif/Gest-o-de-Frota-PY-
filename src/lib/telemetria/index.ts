import type { FonteTelemetria } from "./fonte";
import { simulador } from "./simulador";
import { wialon } from "./wialon";

const FONTES: Record<string, FonteTelemetria> = { simulador, wialon };

export function fonteTelemetria(): FonteTelemetria {
  const nome = process.env.TELEMETRIA_FONTE ?? "simulador";
  const f = FONTES[nome];
  if (!f) throw new Error(`Fonte de telemetria desconhecida: ${nome}`);
  return f;
}
