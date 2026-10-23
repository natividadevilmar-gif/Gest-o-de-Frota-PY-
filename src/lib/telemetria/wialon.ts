import type { FonteTelemetria } from "./fonte";

// Esqueleto do adaptador para o white-label. Preencher quando o fornecedor for
// escolhido: autenticação por token, relatório diário por unidade (km, combustível
// CAN, eventos de condução) e mapeamento para DadosDia.
export const wialon: FonteTelemetria = {
  nome: "wialon",
  async buscarDia() {
    throw new Error("Adaptador Wialon ainda não configurado: defina WIALON_TOKEN e implemente a leitura do relatório diário.");
  },
};
