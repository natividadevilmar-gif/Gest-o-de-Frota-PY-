-- DropForeignKey
ALTER TABLE "CaixaInicial" DROP CONSTRAINT "CaixaInicial_clienteId_fkey";

-- DropTable
DROP TABLE "CaixaInicial";

-- CreateTable
CREATE TABLE "CaixaViagem" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "caminhaoId" TEXT,
    "data" DATE NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'PYG',
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "valorUsd" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "fechadoEm" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaixaViagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaixaViagem_motoristaId_data_idx" ON "CaixaViagem"("motoristaId", "data");

-- AddForeignKey
ALTER TABLE "CaixaViagem" ADD CONSTRAINT "CaixaViagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaViagem" ADD CONSTRAINT "CaixaViagem_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaViagem" ADD CONSTRAINT "CaixaViagem_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Caixa de viagem de exemplo para os motoristas da AVM Truck (o de demonstração saiu há 4 dias).
INSERT INTO "CaixaViagem" ("id", "clienteId", "motoristaId", "caminhaoId", "data", "moeda", "valorOriginal", "valorUsd", "observacao")
SELECT 'demo_caixa_' || c."id", cl."id", c."motoristaId", c."id",
  CURRENT_DATE - CASE WHEN m."nome" = 'Nelson Duarte' THEN 4 ELSE 3 END,
  'PYG', CASE WHEN m."nome" = 'Nelson Duarte' THEN 6000000 ELSE 8000000 END,
  round((CASE WHEN m."nome" = 'Nelson Duarte' THEN 6000000 ELSE 8000000 END / COALESCE((SELECT "pygPorUsd" FROM "Cotacao" ORDER BY "data" DESC LIMIT 1), 7300))::numeric, 2),
  'Adiantamento para combustível, pedágio e comida'
FROM "Caminhao" c
JOIN "Cliente" cl ON cl."id" = c."clienteId" AND cl."nome" = 'AVM Truck'
JOIN "Motorista" m ON m."id" = c."motoristaId"
ON CONFLICT ("id") DO NOTHING;

-- Para a demonstração, os gastos de viagem recentes do caminhão do motorista de exemplo passam a ser dele.
UPDATE "Despesa" d SET "usuarioId" = (SELECT u."id" FROM "Usuario" u WHERE u."email" = '0981123456')
FROM "Caminhao" c JOIN "Motorista" m ON m."id" = c."motoristaId" AND m."nome" = 'Nelson Duarte'
JOIN "Cliente" cl ON cl."id" = c."clienteId" AND cl."nome" = 'AVM Truck'
WHERE d."caminhaoId" = c."id" AND d."usuarioId" IS NULL AND d."data" >= CURRENT_DATE - 4
  AND d."categoria" IN ('DIESEL', 'PEDAGIO', 'ALIMENTACAO')
  AND EXISTS (SELECT 1 FROM "Usuario" u WHERE u."email" = '0981123456');

-- Fretes dos meses anteriores na demonstração, para o saldo acumulado mês a mês fazer sentido
-- (cópias dos fretes deste mês, já recebidas, a partir do mês da primeira despesa).
INSERT INTO "Viagem" ("id","caminhaoId","data","origem","destino","carga","toneladas","freteUsd","kmCarregado","kmVazio","embarcador","paisOrigem","paisDestino","moeda","precoTonelada","documento","custosExtrasUsd","recebido","motoristaId","vencimento")
SELECT v."id" || '_m' || n, v."caminhaoId", (v."data" - make_interval(months => n))::date, v."origem", v."destino", v."carga", v."toneladas", v."freteUsd", v."kmCarregado", v."kmVazio",
  v."embarcador", v."paisOrigem", v."paisDestino", v."moeda", v."precoTonelada", v."documento" || '-' || n, v."custosExtrasUsd", true, v."motoristaId", (v."data" - make_interval(months => n))::date + 15
FROM "Viagem" v CROSS JOIN generate_series(1, 2) AS n
WHERE v."id" LIKE 'demo_frete_%' AND v."id" NOT LIKE '%\_m%' ESCAPE '\'
  AND (v."data" - make_interval(months => n))::date >= (SELECT date_trunc('month', min(d."data"))::date FROM "Despesa" d WHERE d."caminhaoId" = v."caminhaoId")
ON CONFLICT ("id") DO NOTHING;
