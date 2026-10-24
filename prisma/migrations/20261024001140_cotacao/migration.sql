-- AlterTable
ALTER TABLE "public"."Despesa" ADD COLUMN     "cotacao" DOUBLE PRECISION,
ADD COLUMN     "moeda" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "valorOriginal" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."Cotacao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "pygPorUsd" DOUBLE PRECISION NOT NULL,
    "brlPorUsd" DOUBLE PRECISION NOT NULL,
    "fonte" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cotacao_data_key" ON "public"."Cotacao"("data");
