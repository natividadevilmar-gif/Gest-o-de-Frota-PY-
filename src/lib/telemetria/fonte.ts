// Contrato que cada fornecedor de rastreamento implementa. Trocar de white-label
// (Wialon, Navixy, Flespi...) é escrever um novo adaptador, sem mexer no resto.

export type DadosDia = {
  km: number;
  /** Litros consumidos lidos da rede CAN; null se o equipamento não lê CAN. */
  litrosCan: number | null;
  odometroKm: number;
  marchaLentaPct: number;
  excessosVelocidade: number;
  frenagensBruscas: number;
  rpmAltoPct: number;
};

export type EquipamentoRef = {
  rastreadorId: string;
  /** Odômetro conhecido antes do dia pedido, usado pelo simulador. */
  odometroAnteriorKm: number;
  leCan: boolean;
};

export interface FonteTelemetria {
  nome: string;
  buscarDia(equipamento: EquipamentoRef, dia: Date): Promise<DadosDia | null>;
}
