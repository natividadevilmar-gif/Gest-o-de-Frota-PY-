// Relatório da semana (segunda a domingo, no horário do Paraguai): contas puras, sem banco.

const DIA = 86_400_000;

/** Segunda-feira (00:00 UTC da data) da semana que contém `dia` (uma data já no dia do Paraguai). */
export function segundaDaSemana(dia: Date): Date {
  const d = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate()));
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA);
}

/** Semana completa mais recente (a passada), a partir do dia de hoje no Paraguai. */
export function semanaPassada(hoje: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(segundaDaSemana(hoje).getTime() - 7 * DIA);
  return { inicio, fim: new Date(inicio.getTime() + 7 * DIA) };
}

export type LinhaCaminhao = {
  id: string; placa: string; motorista: string | null;
  km: number; litrosCan: number | null; litrosAbastecidos: number; excessos: number; freadas: number;
};

export type ResumoCaminhao = LinhaCaminhao & { litros: number | null; kmL: number | null; excessos100: number | null };

const MIN_KM = 100;

export function resumirSemana(linhas: LinhaCaminhao[]) {
  const caminhoes: ResumoCaminhao[] = linhas.map((l) => {
    // Litros pela CAN quando há; senão os abastecimentos lançados na semana.
    const litros = l.litrosCan ?? (l.litrosAbastecidos > 0 ? l.litrosAbastecidos : null);
    return {
      ...l, litros,
      kmL: litros && l.km >= MIN_KM ? l.km / litros : null,
      excessos100: l.km >= MIN_KM ? (l.excessos / l.km) * 100 : null,
    };
  }).sort((a, b) => b.km - a.km);
  const km = caminhoes.reduce((a, c) => a + c.km, 0);
  const comLitros = caminhoes.filter((c) => c.litros && c.km > 0);
  const litros = comLitros.reduce((a, c) => a + c.litros!, 0);
  const kmComLitros = comLitros.reduce((a, c) => a + c.km, 0);
  const comMotorista = caminhoes.filter((c) => c.motorista && c.km >= MIN_KM);
  // Melhor: menos excessos por 100 km e, no empate, mais km/l. Pior: o contrário.
  const ordem = [...comMotorista].sort((a, b) => (a.excessos100! - b.excessos100!) || ((b.kmL ?? 0) - (a.kmL ?? 0)));
  return {
    caminhoes,
    km,
    litros: litros || null,
    kmL: litros ? kmComLitros / litros : null,
    excessos: caminhoes.reduce((a, c) => a + c.excessos, 0),
    freadas: caminhoes.reduce((a, c) => a + c.freadas, 0),
    rodaram: caminhoes.filter((c) => c.km > 0).length,
    melhor: ordem[0] ?? null,
    pior: ordem.length > 1 ? ordem.at(-1)! : null,
  };
}
