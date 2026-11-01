import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Plano, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { micPadrao, numeroMic } from "@/lib/micDta";
import { datasParcelas } from "@/lib/pagar";
import { diaNoParaguai, rotaDemoDoCaminhao } from "@/lib/rastreio/rotas";
import { simulador } from "@/lib/telemetria/simulador";

// Empresa de apresentação: uma transportadora fictícia com caminhões andando no mapa, motoristas,
// 60 dias de telemetria, despesas, fretes (um com link de rastreio), revisões e alertas na Central,
// e o financeiro de exemplo (contas a receber e a pagar, MIC/DTA, caixas com acerto de viagem),
// para mostrar a KM Cero a clientes novos sem usar os dados de um cliente de verdade.

export const NOME_APRESENTACAO = "KM Cero Apresentação";
export const LOGIN_APRESENTACAO = "apresentacao@kmcero.com.py";

const PYG_POR_USD = 7300;
const PRECO_DIESEL_PYG = 7150;
const DIA = 86_400_000;

const FROTA: { placa: string; modelo: string; ref: number; motorista: string; plano: Plano; odo: number; seg: number; dep: number }[] = [
  { placa: "KMC 101", modelo: "Scania R450", ref: 2.6, motorista: "Rodrigo Giménez", plano: "VIDEO", odo: 312000, seg: 260, dep: 1250 },
  { placa: "KMC 102", modelo: "Volvo FH 540", ref: 2.5, motorista: "Marcelo Schneider", plano: "GESTAO", odo: 254000, seg: 290, dep: 1480 },
  { placa: "KMC 103", modelo: "Mercedes-Benz Actros 2651", ref: 2.6, motorista: "Diego Benítez", plano: "GESTAO", odo: 401000, seg: 270, dep: 1300 },
  { placa: "KMC 104", modelo: "VW Constellation 25.420", ref: 2.8, motorista: "Anderson Kuhn", plano: "GESTAO", odo: 488000, seg: 220, dep: 900 },
  { placa: "KMC 105", modelo: "Scania R540", ref: 2.5, motorista: "Víctor Ayala", plano: "VIDEO", odo: 168000, seg: 300, dep: 1600 },
  { placa: "KMC 106", modelo: "DAF XF 530", ref: 2.6, motorista: "Fernando Ríos", plano: "GESTAO", odo: 223000, seg: 280, dep: 1400 },
];

const PAIS: Record<string, string> = { Cascavel: "BR", Formosa: "AR" };
const EMBARCADORES = ["Cooperativa Colonias Unidas", "Agrofértil S.A.", "Molinos del Este", "Fertilizantes del Este", "Distribuidora Monday", "Granos del Paraná"];
const CARGAS = ["Soja", "Milho", "Trigo", "Fertilizante", "Carga geral", "Soja"];

/** Apaga a empresa de apresentação (se houver) e cria de novo, com as datas de hoje. Devolve a senha do login. */
export async function recriarApresentacao(agora = new Date()): Promise<{ senha: string; clienteId: string }> {
  await db.cliente.deleteMany({ where: { nome: NOME_APRESENTACAO } });
  await db.usuario.deleteMany({ where: { email: LOGIN_APRESENTACAO } });

  const hoje = diaNoParaguai(agora);
  const dia = (n: number) => new Date(hoje.getTime() + n * DIA);
  const cliente = await db.cliente.create({
    data: { nome: NOME_APRESENTACAO, ruc: "80000000-0", endereco: "Av. Colonos 1250", cidade: "Santa Rita", pais: "PY", planoContratado: "VIDEO", caminhoesContratados: FROTA.length, contratoInicio: dia(-90) },
  });
  const senha = randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8);
  await db.usuario.create({ data: { email: LOGIN_APRESENTACAO, nome: "Apresentação KM Cero", senhaHash: await bcrypt.hash(senha, 10), papel: "GESTOR", clienteId: cliente.id } });

  const telemetria: Prisma.TelemetriaDiaCreateManyInput[] = [];
  const despesas: Prisma.DespesaCreateManyInput[] = [];
  const revisoes: Prisma.ItemRevisaoCreateManyInput[] = [];
  const viagens: Prisma.ViagemCreateManyInput[] = [];
  const caminhoes: { id: string; placa: string; motoristaId: string }[] = [];

  for (const [i, f] of FROTA.entries()) {
    const motorista = await db.motorista.create({ data: { clienteId: cliente.id, nome: f.motorista, ddi: "595" } });
    const cam = await db.caminhao.create({
      data: {
        clienteId: cliente.id, placa: f.placa, modelo: f.modelo, ano: 2018 + (i % 6), plano: f.plano, consumoRefKmL: f.ref, odometroKm: f.odo,
        // "SIM-" faz o caminhão andar sozinho no mapa (rotas de demonstração), sem rastreador de verdade.
        rastreadorId: `SIM-${cliente.id.slice(-5)}-${i + 1}`, motoristaId: motorista.id,
        salarioMotorista: 1125, seguroMensal: f.seg, depreciacaoMensal: f.dep, camera: i === 4 ? "mdvr4" : "dualcam",
      },
    });
    caminhoes.push({ id: cam.id, placa: f.placa, motoristaId: motorista.id });

    // Rota fixa por onde o caminhão anda no mapa: os fretes de exemplo usam a mesma, ida e volta.
    const r = rotaDemoDoCaminhao(cam.id);
    const rota = r.pontos.map((p) => [p.lat, p.lng]) as Prisma.InputJsonValue;
    const km = Math.round(r.km);
    // Preço por tonelada que dá uma margem de 15 a 25% contando a volta vazia.
    const precoT = Math.round((km * 0.058 + 4 + i) * 100) / 100;

    let odo = f.odo;
    let litrosSemana = 0;
    let kmFrete = 0;
    let nFrete = 0;
    for (let d = -60; d <= 0; d++) {
      const data = dia(d);
      const t = await simulador.buscarDia({ rastreadorId: cam.rastreadorId!, odometroAnteriorKm: odo, leCan: true }, data);
      odo = t.odometroKm;
      telemetria.push({ caminhaoId: cam.id, data, ...t });
      litrosSemana += t.litrosCan ?? t.km / f.ref;
      // Sábado acerta a semana; hoje só abastece o rodado desde sábado, para o custo/km do mês não disparar.
      const sabado = data.getUTCDay() === 6;
      if ((sabado || d === 0) && litrosSemana >= 1) {
        const litros = Math.round(litrosSemana * (i === 1 ? 1.06 : 1.01));
        const pyg = litros * PRECO_DIESEL_PYG;
        despesas.push({
          caminhaoId: cam.id, data, categoria: "DIESEL", litros, precoLitro: PRECO_DIESEL_PYG, odometroKm: odo, tanqueCheio: true,
          posto: ["Copetrol Santa Rita", "Petrobras Naranjal", "Shell Ruta 6", "Puma Ciudad del Este"][(i + d) & 3],
          moeda: "PYG", valorOriginal: pyg, cotacao: PYG_POR_USD, valorUsd: Math.round((pyg / PYG_POR_USD) * 100) / 100,
        });
        const comida = 150_000 + ((i * 7 + d) & 3) * 10_000;
        if (sabado) despesas.push({ caminhaoId: cam.id, data, categoria: "ALIMENTACAO", moeda: "PYG", valorOriginal: comida, cotacao: PYG_POR_USD, valorUsd: Math.round((comida / PYG_POR_USD) * 100) / 100, descricao: "Refeições da semana" });
        if (sabado) despesas.push({ caminhaoId: cam.id, data, categoria: "PEDAGIO", valorUsd: 18 + i * 3, descricao: "Pedágios da semana" });
        litrosSemana = 0;
      }
      if (data.getUTCDate() === 10) despesas.push({ caminhaoId: cam.id, data, categoria: "PNEUS", valorUsd: 340 + i * 15, descricao: "Borracharia" });
      if (data.getUTCDate() === 18) despesas.push({ caminhaoId: cam.id, data, categoria: "MANUTENCAO", valorUsd: i === 2 ? 1280 : 360 + i * 25, descricao: i === 2 ? "Embreagem" : "Revisão preventiva" });

      // Um frete a cada ida e volta rodada (fretes de hoje ficam só o do link, criado depois).
      kmFrete += t.km;
      if (kmFrete >= 2 * km && d < 0) {
        kmFrete -= 2 * km;
        nFrete++;
        const ton = 27 + ((i + nFrete) % 6);
        const saida = d - Math.max(1, Math.round(km / 450));
        viagens.push({
          caminhaoId: cam.id, motoristaId: motorista.id, data: dia(saida), dataEntrega: data, origem: r.origem, destino: r.destino,
          paisOrigem: PAIS[r.origem] ?? "PY", paisDestino: PAIS[r.destino] ?? "PY", carga: CARGAS[(i + nFrete) % 6], toneladas: ton,
          precoTonelada: precoT, valorOriginal: Math.round(precoT * ton * 100) / 100, freteUsd: Math.round(precoT * ton * 100) / 100,
          kmCarregado: km, kmVazio: km, embarcador: EMBARCADORES[(i + nFrete) % 6], recebido: d < -12,
          // Uns clientes pagam em 7 dias, outros em 15: assim há fretes vencidos para cobrar.
          vencimento: dia(d + ((i + nFrete) % 3 === 0 ? 7 : 15)),
          documento: `CRT ${String(4000 + i * 100 + nFrete).padStart(5, "0")}`, rota, rotaKm: km,
        });
      }
    }
    await db.caminhao.update({ where: { id: cam.id }, data: { odometroKm: odo } });

    revisoes.push(
      { caminhaoId: cam.id, nome: "Óleo e filtros do motor", gatilho: "KM", intervaloKm: 30000, ultimoKm: odo - [28600, 12000, 31200, 8000, 22000, 15000][i] },
      { caminhaoId: cam.id, nome: "Rodízio de pneus", gatilho: "KM", intervaloKm: 25000, ultimoKm: odo - 14000 - i * 1500 },
      { caminhaoId: cam.id, nome: "Inspeção técnica veicular", gatilho: "DATA", vencimento: dia(i === 3 ? -3 : 25 + i * 9) },
    );
    if (i === 2) revisoes.push({ caminhaoId: cam.id, nome: "Código de falha SPN 3251 (filtro DPF)", gatilho: "FALHA" });

  }

  await db.telemetriaDia.createMany({ data: telemetria });
  await db.despesa.createMany({ data: despesas });
  await db.itemRevisao.createMany({ data: revisoes });
  const fretesCriados = await db.viagem.createManyAndReturn({ data: viagens });

  // Frete em curso hoje no caminhão de rota mais longa, com o link de rastreio já pronto para mostrar.
  const c0 = caminhoes.reduce((a, b) => (rotaDemoDoCaminhao(b.id).km > rotaDemoDoCaminhao(a.id).km ? b : a));
  const r0 = rotaDemoDoCaminhao(c0.id);
  const km0 = Math.round(r0.km);
  const preco0 = Math.round((km0 * 0.058 + 5) * 100) / 100;
  const frete0 = Math.round(preco0 * 31 * 100) / 100;
  await db.viagem.create({
    data: {
      caminhaoId: c0.id, motoristaId: c0.motoristaId, data: hoje, origem: r0.origem, destino: r0.destino,
      paisOrigem: PAIS[r0.origem] ?? "PY", paisDestino: PAIS[r0.destino] ?? "PY", carga: "Soja", toneladas: 31,
      precoTonelada: preco0, valorOriginal: frete0, freteUsd: frete0, kmCarregado: km0, kmVazio: km0,
      embarcador: "Cooperativa Colonias Unidas", documento: "CRT 04321", vencimento: dia(15),
      rota: r0.pontos.map((p) => [p.lat, p.lng]) as Prisma.InputJsonValue, rotaKm: km0,
      linkToken: randomBytes(18).toString("base64url"), linkExpiraEm: new Date(agora.getTime() + 10 * DIA),
    },
  });

  // Caixa de viagem de cada motorista: o anterior (já encerrado pelo novo, com acerto para imprimir) e o atual.
  const usdDe = (pyg: number) => Math.round((pyg / PYG_POR_USD) * 100) / 100;
  await db.caixaViagem.createMany({
    data: caminhoes.flatMap((c, i) => [
      { clienteId: cliente.id, motoristaId: c.motoristaId, caminhaoId: c.id, data: dia(-17 - (i % 3)), moeda: "PYG", valorOriginal: 12_000_000, valorUsd: usdDe(12_000_000), observacao: "Adiantamento da viagem anterior" },
      { clienteId: cliente.id, motoristaId: c.motoristaId, caminhaoId: c.id, data: dia(-3 - (i % 3)), moeda: "PYG", valorOriginal: 7_000_000, valorUsd: usdDe(7_000_000), observacao: "Adiantamento para combustível, pedágio e comida" },
    ]),
  });

  await financeiroDeExemplo(cliente, caminhoes, fretesCriados, hoje);

  const h = (min: number) => new Date(agora.getTime() - min * 60_000);
  await db.ocorrencia.createMany({
    data: [
      { clienteId: cliente.id, caminhaoId: caminhoes[3].id, tipo: "queda_diesel", gravidade: "alta", titulo: `${caminhoes[3].placa}: sumiram 120 L do tanque`, detalhe: "Tanque caiu de 610 L para 490 L em 25 minutos, com o caminhão parado. Confira se houve furto ou vazamento.", lat: -25.5097, lng: -54.6111, velocidadeKmh: 0, chave: `apresentacao:${cliente.id}:diesel`, criadaEm: h(40) },
      { clienteId: cliente.id, caminhaoId: caminhoes[1].id, tipo: "excesso", gravidade: "alta", titulo: `${caminhoes[1].placa} a 104 km/h`, detalhe: "Acima do limite de 80 km/h · PY02, km 182", lat: -25.4237, lng: -56.8822, velocidadeKmh: 104, chave: `apresentacao:${cliente.id}:excesso`, criadaEm: h(15) },
      { clienteId: cliente.id, caminhaoId: caminhoes[5].id, tipo: "ignicao_noturna", gravidade: "media", titulo: `${caminhoes[5].placa} rodando às 2h`, detalhe: "Caminhão em movimento fora do horário normal · PY06", lat: -26.9, lng: -55.9, velocidadeKmh: 62, chave: `apresentacao:${cliente.id}:noturna`, criadaEm: h(420) },
      { clienteId: cliente.id, caminhaoId: caminhoes[2].id, tipo: "freada", gravidade: "baixa", titulo: `${caminhoes[2].placa} · Freada brusca`, detalhe: "A 71 km/h, informado pelo aparelho.", lat: -25.39, lng: -57.35, velocidadeKmh: 71, chave: `apresentacao:${cliente.id}:freada`, criadaEm: h(95) },
    ],
  });

  return { senha, clienteId: cliente.id };
}

type FreteCriado = Awaited<ReturnType<typeof db.viagem.createManyAndReturn>>[number];

/** Recebimentos dos fretes pagos (e um pago em parte), contas a pagar do mês e MIC/DTA dos fretes internacionais. */
async function financeiroDeExemplo(
  cliente: { id: string; nome: string; ruc: string | null; endereco: string | null; cidade: string; pais: string },
  caminhoes: { id: string; placa: string; motoristaId: string }[],
  fretes: FreteCriado[],
  hoje: Date,
) {
  const dia = (n: number) => new Date(hoje.getTime() + n * DIA);
  const arred = (n: number) => Math.round(n * 100) / 100;

  // Dois fretes de exportação até o porto de Paranaguá, para sempre haver MIC/DTA de exemplo
  // (as rotas do mapa são sorteadas e podem ser todas dentro do Paraguai).
  const exportacao = await db.viagem.createManyAndReturn({
    data: [
      { c: caminhoes[0], saida: -24, chegada: -21, ton: 30, recebido: true, crt: "CRT 05011", emb: "Cooperativa Colonias Unidas" },
      { c: caminhoes[3], saida: -9, chegada: -6, ton: 29, recebido: false, crt: "CRT 05023", emb: "Granos del Paraná" },
    ].map((e) => {
      const frete = arred(e.ton * 71.5);
      return {
        caminhaoId: e.c.id, motoristaId: e.c.motoristaId, data: dia(e.saida), dataEntrega: dia(e.chegada), origem: "Santa Rita", destino: "Paranaguá",
        paisOrigem: "PY", paisDestino: "BR", carga: "Soja", toneladas: e.ton, precoTonelada: 71.5, valorOriginal: frete, freteUsd: frete,
        kmCarregado: 1150, kmVazio: 1150, rotaKm: 1150, embarcador: e.emb, documento: e.crt, recebido: e.recebido, vencimento: dia(e.chegada + 15),
      };
    }),
  });
  fretes = [...fretes, ...exportacao];

  // Contas a receber: o pago entra uns dias depois da entrega; um frete em aberto já tem metade paga.
  const recebimentos: Prisma.RecebimentoCreateManyInput[] = fretes
    .filter((f) => f.recebido)
    .map((f) => ({ viagemId: f.id, data: new Date((f.dataEntrega ?? f.data).getTime() + 8 * DIA), valorUsd: f.freteUsd, observacao: "Transferência bancária" }));
  const parcial = fretes.find((f) => !f.recebido);
  if (parcial) recebimentos.push({ viagemId: parcial.id, data: dia(-1), valorUsd: arred(parcial.freteUsd / 2), observacao: "Adiantamento de 50%" });
  await db.recebimento.createMany({ data: recebimentos });

  // Contas a pagar: financiamento de um caminhão, seguro, salários, contador, aluguel e oficina.
  const contas: Prisma.ContaPagarCreateManyInput[] = [];
  const conta = (c: Omit<Prisma.ContaPagarCreateManyInput, "clienteId" | "moeda" | "valorOriginal" | "pagoEm"> & { pyg?: number }, pago: boolean) => {
    const { pyg, ...resto } = c;
    contas.push({
      ...resto, clienteId: cliente.id,
      moeda: pyg ? "PYG" : "USD", valorOriginal: pyg ?? c.valorUsd,
      pagoEm: pago ? c.vencimento : null,
    });
  };
  const fin = caminhoes[4];
  datasParcelas(dia(-75), 24).forEach((v, k) =>
    conta({ descricao: `Financiamento ${fin.placa}`, categoria: "PARCELA", fornecedor: "Banco Continental", valorUsd: 2890, vencimento: v, caminhaoId: fin.id, grupo: `apresentacao-fin-${fin.id}`, parcela: k + 1, parcelas: 24 }, v < dia(-1)),
  );
  conta({ descricao: "Seguro da frota", categoria: "SEGURO", fornecedor: "Mapfre Paraguay", valorUsd: 1620, vencimento: dia(-20) }, true);
  conta({ descricao: "Seguro da frota", categoria: "SEGURO", fornecedor: "Mapfre Paraguay", valorUsd: 1620, vencimento: dia(10) }, false);
  conta({ descricao: "Salários dos motoristas", categoria: "SALARIO", valorUsd: usd(6 * 1125 * PYG_POR_USD), pyg: 6 * 1125 * PYG_POR_USD, vencimento: dia(-25) }, true);
  conta({ descricao: "Salários dos motoristas", categoria: "SALARIO", valorUsd: usd(6 * 1125 * PYG_POR_USD), pyg: 6 * 1125 * PYG_POR_USD, vencimento: dia(5) }, false);
  conta({ descricao: "Honorários do contador", categoria: "OUTRO", fornecedor: "Estudio Contable Benítez", valorUsd: usd(2_200_000), pyg: 2_200_000, vencimento: dia(-28) }, true);
  conta({ descricao: "Honorários do contador", categoria: "OUTRO", fornecedor: "Estudio Contable Benítez", valorUsd: usd(2_200_000), pyg: 2_200_000, vencimento: dia(2) }, false);
  conta({ descricao: "Aluguel do escritório e pátio", categoria: "ALUGUEL", fornecedor: "Inmobiliaria del Este", valorUsd: 850, vencimento: dia(-27) }, true);
  conta({ descricao: "Aluguel do escritório e pátio", categoria: "ALUGUEL", fornecedor: "Inmobiliaria del Este", valorUsd: 850, vencimento: dia(3) }, false);
  conta({ descricao: "IVA do mês", categoria: "IMPOSTO", fornecedor: "DNIT", valorUsd: 1340, vencimento: dia(-2) }, false);
  conta({ descricao: "Retífica do cabeçote", categoria: "OFICINA", fornecedor: "Taller Diesel Naranjal", valorUsd: 1800, vencimento: dia(12), caminhaoId: caminhoes[2].id }, false);
  await db.contaPagar.createMany({ data: contas });

  // MIC/DTA dos últimos fretes internacionais (no máximo quatro), numerados no ano.
  const ano = hoje.getUTCFullYear();
  const internacionais = fretes.filter((f) => f.paisOrigem !== f.paisDestino).sort((a, b) => +b.data - +a.data).slice(0, 4).reverse();
  const cams = await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true, modelo: true, ano: true } });
  const fixos = { permiso: "PY-ATIT 0815/2025", capacidad: "45", remolque: "KMR 210" };
  await db.micDta.createMany({
    data: internacionais.map((f, k) => {
      const c = cams.find((x) => x.id === f.caminhaoId)!;
      const dados = micPadrao({ viagem: f, caminhao: c, cliente, numero: numeroMic(cliente.pais, ano, k + 1), anteriorEmpresa: fixos, anteriorCaminhao: { ...fixos, remolque: `KMR ${210 + k}` } });
      return { clienteId: cliente.id, viagemId: f.id, caminhaoId: f.caminhaoId, ano, sequencia: k + 1, dados: { ...dados, destinatario: `Cargill Agrícola S.A.\n${f.destino}`, consignatario: "Cargill Agrícola S.A.", valorFot: arred(f.toneladas * 410).toFixed(2), seguro: arred(f.freteUsd * 0.003).toFixed(2), cantidadBultos: "1", precintos: `PY${ano % 100}-${String(30411 + k * 7)}` } };
    }),
  });
}

const usd = (pyg: number) => Math.round((pyg / PYG_POR_USD) * 100) / 100;
