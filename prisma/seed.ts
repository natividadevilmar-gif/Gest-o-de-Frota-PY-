// Dados de exemplo para demonstração. Nenhum cliente ou número aqui é real.
// Uso: npm run db:seed  (apaga e recria tudo)
import { PrismaClient, type Plano } from "@prisma/client";
import bcrypt from "bcryptjs";
import { simulador } from "../src/lib/telemetria/simulador";

const db = new PrismaClient();
const DIESEL_USD_L = 0.98;

const hoje = new Date();
const dia = (offset: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + offset));

const CLIENTES = [
  { nome: "Transportes Monday S.A.", cidade: "Santa Rita", diasEmAtraso: 0, frota: true },
  { nome: "Agrotransporte Naranjal", cidade: "Naranjal", diasEmAtraso: 0, planos: { BASICO: 18, GESTAO: 12, VIDEO: 0 } },
  { nome: "Combustibles del Este", cidade: "Ciudad del Este", diasEmAtraso: 9, idioma: "es", planos: { BASICO: 0, GESTAO: 4, VIDEO: 14 } },
  { nome: "Cooperativa San Alberto", cidade: "San Alberto", diasEmAtraso: 0, planos: { BASICO: 25, GESTAO: 10, VIDEO: 0 } },
  { nome: "Fletes Los Cedrales", cidade: "Los Cedrales", diasEmAtraso: 18, idioma: "es", planos: { BASICO: 12, GESTAO: 0, VIDEO: 0 } },
  { nome: "Logística Itapúa", cidade: "María Auxiliadora", diasEmAtraso: 0, planos: { BASICO: 6, GESTAO: 15, VIDEO: 4 } },
] as const;

const FROTA = [
  { placa: "AAFR 218", modelo: "Scania R450", ref: 2.6, motorista: "Carlos Benítez", plano: "GESTAO", odo: 405000, seg: 260, dep: 1250, desvio: 1.01 },
  { placa: "AAGT 507", modelo: "Volvo FH 540", ref: 2.5, motorista: "Lucas Hoffmann", plano: "VIDEO", odo: 282000, seg: 290, dep: 1480, desvio: 1.057 },
  { placa: "AAHM 331", modelo: "Mercedes-Benz Actros 2651", ref: 2.6, motorista: "Ramón Ortiz", plano: "GESTAO", odo: 349000, seg: 270, dep: 1300, desvio: 1.006 },
  { placa: "AACX 904", modelo: "VW Constellation 25.420", ref: 2.8, motorista: "Jair Pereira", plano: "GESTAO", odo: 514000, seg: 220, dep: 900, desvio: 1.012 },
  { placa: "AAJP 146", modelo: "Scania G410", ref: 2.7, motorista: "Hugo Cáceres", plano: "GESTAO", odo: 598000, seg: 220, dep: 850, desvio: 1.008 },
  { placa: "AAKD 672", modelo: "Volvo FH 540", ref: 2.5, motorista: "Fábio Lenz", plano: "VIDEO", odo: 191000, seg: 290, dep: 1480, desvio: 1.005 },
  { placa: "AABN 389", modelo: "Mercedes-Benz Actros 2651", ref: 2.6, motorista: "Nelson Duarte", plano: "GESTAO", odo: 434000, seg: 270, dep: 1300, desvio: 1.006 },
  { placa: "AALS 755", modelo: "Scania R450", ref: 2.6, motorista: "Osmar Wiebe", plano: "BASICO", odo: 370000, seg: 260, dep: 1250, desvio: 1 },
] as const;

async function main() {
  await db.cliente.deleteMany();
  await db.usuario.deleteMany();

  const senha = await bcrypt.hash("frota2026", 10);
  await db.usuario.create({ data: { email: "admin@gestaodefrota.com.py", nome: "Equipe Gestão de Frota PY", senhaHash: senha, papel: "ADMIN" } });

  for (const c of CLIENTES) {
    const cliente = await db.cliente.create({
      data: { nome: c.nome, cidade: c.cidade, diasEmAtraso: c.diasEmAtraso, idioma: "idioma" in c ? c.idioma : "pt" },
    });

    if (!("frota" in c)) {
      // Clientes da visão interna: só os caminhões e planos, sem telemetria.
      let n = 0;
      for (const [plano, qtd] of Object.entries(c.planos)) {
        for (let i = 0; i < qtd; i++) {
          n++;
          await db.caminhao.create({
            data: { clienteId: cliente.id, placa: `EX${String(n).padStart(3, "0")}`, modelo: "Exemplo", plano: plano as Plano, consumoRefKmL: 2.6 },
          });
        }
      }
      continue;
    }

    await db.usuario.create({
      data: { email: "gestor@transportesmonday.com.py", nome: "Gestor Monday", senhaHash: senha, papel: "GESTOR", clienteId: cliente.id },
    });

    for (const f of FROTA) {
      const motorista = await db.motorista.create({ data: { clienteId: cliente.id, nome: f.motorista } });
      const cam = await db.caminhao.create({
        data: {
          clienteId: cliente.id,
          placa: f.placa,
          modelo: f.modelo,
          plano: f.plano,
          consumoRefKmL: f.ref,
          odometroKm: f.odo,
          rastreadorId: `SIM-${f.placa.replace(" ", "")}`,
          motoristaId: motorista.id,
          salarioMotorista: 1125,
          seguroMensal: f.seg,
          depreciacaoMensal: f.dep,
        },
      });

      // Telemetria dos últimos 60 dias pelo simulador, com abastecimentos semanais.
      let odo: number = f.odo;
      let litrosSemana = 0;
      for (let d = -60; d <= -1; d++) {
        const data = dia(d);
        const t = await simulador.buscarDia({ rastreadorId: cam.rastreadorId!, odometroAnteriorKm: odo, leCan: f.plano !== "BASICO" }, data);
        odo = t.odometroKm;
        await db.telemetriaDia.create({ data: { caminhaoId: cam.id, data, ...t } });
        litrosSemana += t.litrosCan ?? t.km / f.ref;
        // Abastece aos sábados e no último dia do mês, para os litros caírem no mês certo.
        const fimDoMes = new Date(data.getTime() + 86_400_000).getUTCDate() === 1;
        if (data.getUTCDay() === 6 || fimDoMes || d === -1) {
          const litros = Math.round(litrosSemana * f.desvio);
          await db.despesa.create({
            data: { caminhaoId: cam.id, data, categoria: "DIESEL", litros, valorUsd: Math.round(litros * DIESEL_USD_L * 100) / 100, descricao: "Abastecimento" },
          });
          litrosSemana = 0;
        }
        if (data.getUTCDate() === 10) {
          await db.despesa.create({ data: { caminhaoId: cam.id, data, categoria: "PNEUS", valorUsd: 360 + (odo % 60) } });
          await db.despesa.create({ data: { caminhaoId: cam.id, data, categoria: "PEDAGIO", valorUsd: 95 } });
        }
        if (data.getUTCDate() === 18) {
          await db.despesa.create({ data: { caminhaoId: cam.id, data, categoria: "MANUTENCAO", valorUsd: f.placa === "AAJP 146" ? 1340 : 380 + (odo % 120) } });
        }
      }
      await db.caminhao.update({ where: { id: cam.id }, data: { odometroKm: odo } });

      // Plano de revisões
      await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Óleo e filtros do motor", gatilho: "KM", intervaloKm: 30000, ultimoKm: odo - [27380, 12000, 29400, 8000][FROTA.indexOf(f) % 4] } });
      await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Rodízio de pneus", gatilho: "KM", intervaloKm: 25000, ultimoKm: odo - 15000 } });
      if (f.placa === "AACX 904") await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Habilitação DINATRAN", gatilho: "DATA", vencimento: dia(-4) } });
      if (f.placa === "AALS 755") await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Seguro de carga", gatilho: "DATA", vencimento: dia(10) } });
      if (f.placa === "AAJP 146") await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Código de falha SPN 3251 (filtro DPF)", gatilho: "FALHA" } });
      await db.itemRevisao.create({ data: { caminhaoId: cam.id, nome: "Inspeção técnica veicular", gatilho: "DATA", vencimento: dia(80 + FROTA.indexOf(f) * 7) } });
    }

    const placa = async (p: string) => (await db.caminhao.findFirstOrThrow({ where: { clienteId: cliente.id, placa: p } })).id;
    const viagens = [
      ["AAFR 218", "Santa Rita", "Ciudad del Este", "Soja", 30, 410, 215, 215, -3],
      ["AAGT 507", "Naranjal", "Porto de Villeta", "Soja", 32, 960, 520, 520, -5],
      ["AACX 904", "Santa Rita", "Porto de Villeta", "Milho", 31, 900, 500, 500, -6],
      ["AAKD 672", "San Alberto", "Encarnación", "Fertilizante", 28, 430, 255, 255, -2],
      ["AABN 389", "Los Cedrales", "Ciudad del Este", "Carga geral", 24, 210, 95, 95, -1],
      ["AAHM 331", "Santa Rosa del Monday", "Porto de Villeta", "Soja", 30, 790, 505, 505, -8],
    ] as const;
    for (const v of viagens) {
      await db.viagem.create({
        data: { caminhaoId: await placa(v[0]), origem: v[1], destino: v[2], carga: v[3], toneladas: v[4], freteUsd: v[5], kmCarregado: v[6], kmVazio: v[7], data: dia(v[8]) },
      });
    }
  }
  console.log("Dados de exemplo criados. Logins (senha frota2026): admin@gestaodefrota.com.py, gestor@transportesmonday.com.py");
}

main().finally(() => db.$disconnect());
