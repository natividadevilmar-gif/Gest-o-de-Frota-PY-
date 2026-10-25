// Dados de exemplo para demonstração. Nenhum cliente ou número aqui é real.
// Uso: npm run db:seed  (apaga e recria tudo)
//      SEED_SE_VAZIO=1 npm run db:seed  (só cria se o banco não tiver usuários; usado no deploy)
import { PrismaClient, type Plano } from "@prisma/client";
import bcrypt from "bcryptjs";
import { simulador } from "../src/lib/telemetria/simulador";

const db = new PrismaClient();
const PYG_POR_USD = 7300;
const PRECO_DIESEL_PYG = 7150; // cerca de USD 0,98 por litro

const hoje = new Date();
const dia = (offset: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + offset));

const CLIENTES = [
  { nome: "AVM Truck", ruc: "80012345-6", cidade: "Santa Rita", diasEmAtraso: 0, frota: true },
  { nome: "Agrotransporte Naranjal", cidade: "Naranjal", diasEmAtraso: 0, planos: { BASICO: 18, GESTAO: 12, VIDEO: 0 } },
  { nome: "Combustibles del Este", cidade: "Ciudad del Este", diasEmAtraso: 9, idioma: "es", planos: { BASICO: 0, GESTAO: 4, VIDEO: 14 } },
  { nome: "Cooperativa San Alberto", cidade: "San Alberto", diasEmAtraso: 0, planos: { BASICO: 25, GESTAO: 10, VIDEO: 0 } },
  { nome: "Fletes Los Cedrales", cidade: "Los Cedrales", diasEmAtraso: 18, pais: "DE", idioma: "es", planos: { BASICO: 12, GESTAO: 0, VIDEO: 0 } },
  { nome: "Logística Itapúa", cidade: "María Auxiliadora", diasEmAtraso: 0, pais: "BR", planos: { BASICO: 6, GESTAO: 15, VIDEO: 4 } },
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
  if (process.env.SEED_SE_VAZIO && (await db.usuario.count()) > 0) return console.log("Banco já tem dados; exemplo não recriado.");
  await db.cliente.deleteMany();
  await db.usuario.deleteMany();

  const senha = await bcrypt.hash("frota2026", 10);
  await db.usuario.create({ data: { email: "admin@gestaodefrota.com.py", nome: "Equipe Gestão de Frota PY", senhaHash: senha, papel: "ADMIN" } });

  for (const c of CLIENTES) {
    const cliente = await db.cliente.create({
      data: { nome: c.nome, ruc: "ruc" in c ? c.ruc : null, cidade: c.cidade, diasEmAtraso: c.diasEmAtraso, idioma: "idioma" in c ? c.idioma : "pt", pais: "pais" in c ? c.pais : "PY" },
    });

    if (!("frota" in c)) {
      // Clientes da visão interna: só os caminhões e planos, sem telemetria.
      let n = 0;
      for (const [plano, qtd] of Object.entries(c.planos)) {
        for (let i = 0; i < qtd; i++) {
          n++;
          await db.caminhao.create({
            data: { clienteId: cliente.id, placa: `EX${String(n).padStart(3, "0")}`, modelo: "Exemplo", plano: plano as Plano, consumoRefKmL: 2.6, rastreadorId: `SIM-${cliente.id.slice(-4)}-${n}` },
          });
        }
      }
      continue;
    }

    await db.usuario.create({
      data: { email: "gestor@avmtruck.com.py", nome: "Gestor AVM Truck", senhaHash: senha, papel: "GESTOR", clienteId: cliente.id },
    });

    for (const f of FROTA) {
      const motorista = await db.motorista.create({ data: { clienteId: cliente.id, nome: f.motorista } });
      if (f.motorista === "Nelson Duarte") {
        // Acesso de demonstração do motorista (em espanhol): celular 0981123456, PIN 123456.
        await db.usuario.create({
          data: { email: "0981123456", nome: f.motorista, senhaHash: await bcrypt.hash("123456", 10), papel: "MOTORISTA", clienteId: cliente.id, motoristaId: motorista.id, idioma: "es" },
        });
      }
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
          const posto = ["Copetrol Santa Rita", "Petrobras Naranjal", "Shell Ruta 6", "Puma Ciudad del Este"][Math.abs(odo) % 4];
          await db.despesa.create({
            data: {
              caminhaoId: cam.id, data, categoria: "DIESEL", litros, precoLitro: PRECO_DIESEL_PYG, posto, odometroKm: odo, tanqueCheio: true,
              moeda: "PYG", valorOriginal: litros * PRECO_DIESEL_PYG, cotacao: PYG_POR_USD,
              valorUsd: Math.round(((litros * PRECO_DIESEL_PYG) / PYG_POR_USD) * 100) / 100,
            },
          });
          const refeicao = 140_000 + (odo % 5) * 10_000;
          await db.despesa.create({
            data: { caminhaoId: cam.id, data, categoria: "ALIMENTACAO", moeda: "PYG", valorOriginal: refeicao, cotacao: PYG_POR_USD, valorUsd: Math.round((refeicao / PYG_POR_USD) * 100) / 100, descricao: "Refeições da semana" },
          });
          litrosSemana = 0;
        }
        if (data.getUTCDate() === 10) {
          await db.despesa.create({ data: { caminhaoId: cam.id, data, categoria: "PNEUS", valorUsd: 360 + (odo % 60), descricao: "Borracharia" } });
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
        data: {
          caminhaoId: await placa(v[0]), origem: v[1], destino: v[2], carga: v[3], toneladas: v[4], freteUsd: v[5], kmCarregado: v[6], kmVazio: v[7], data: dia(v[8]),
          embarcador: { Soja: "Cooperativa Colonias Unidas", Milho: "Agrofértil S.A.", Fertilizante: "Fertilizantes del Este" }[v[3] as string] ?? "Distribuidora Monday",
          precoTonelada: Math.round((v[5] / v[4]) * 100) / 100,
          recebido: v[8] < -4,
          vencimento: dia(v[8] + 15),
        },
      });
    }
    // Caixa de viagem entregue a cada motorista (o de demonstração saiu há 4 dias).
    for (const c of await db.caminhao.findMany({ where: { clienteId: cliente.id, motoristaId: { not: null } }, include: { motorista: true } })) {
      const demo = c.motorista!.nome === "Nelson Duarte";
      const valor = demo ? 6_000_000 : 8_000_000;
      await db.caixaViagem.create({
        data: { clienteId: cliente.id, motoristaId: c.motoristaId!, caminhaoId: c.id, data: dia(demo ? -4 : -3), moeda: "PYG", valorOriginal: valor, valorUsd: Math.round((valor / 7300) * 100) / 100, observacao: "Adiantamento para combustível, pedágio e comida" },
      });
    }
  }
  console.log("Dados de exemplo criados. Logins (senha frota2026): admin@gestaodefrota.com.py, gestor@avmtruck.com.py; motorista: 0981123456, PIN 123456");
}

main().finally(() => db.$disconnect());
