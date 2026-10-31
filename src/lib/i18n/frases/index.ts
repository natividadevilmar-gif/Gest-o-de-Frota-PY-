// Dicionário completo. Carregado só quando o idioma escolhido não é o português.
import type { Linha } from "../traduzir";
import { FINANCEIRO } from "./financeiro";
import { FROTA } from "./frota";
import { GERAL } from "./geral";
import { OPERACAO } from "./operacao";
import { VIAGENS } from "./viagens";

export const FRASES: Linha[] = [...GERAL, ...FROTA, ...FINANCEIRO, ...OPERACAO, ...VIAGENS];
