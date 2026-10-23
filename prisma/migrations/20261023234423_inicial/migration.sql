-- CreateEnum
CREATE TYPE "public"."Plano" AS ENUM ('BASICO', 'GESTAO', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."Papel" AS ENUM ('ADMIN', 'GESTOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "public"."Idioma" AS ENUM ('pt', 'es');

-- CreateEnum
CREATE TYPE "public"."CategoriaDespesa" AS ENUM ('DIESEL', 'PNEUS', 'MANUTENCAO', 'PEDAGIO', 'OUTROS');

-- CreateEnum
CREATE TYPE "public"."Gatilho" AS ENUM ('KM', 'DATA', 'FALHA');

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ruc" TEXT,
    "cidade" TEXT NOT NULL,
    "idioma" "public"."Idioma" NOT NULL DEFAULT 'pt',
    "diasEmAtraso" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "public"."Papel" NOT NULL,
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Motorista" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Caminhao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER,
    "plano" "public"."Plano" NOT NULL DEFAULT 'BASICO',
    "consumoRefKmL" DOUBLE PRECISION NOT NULL,
    "odometroKm" INTEGER NOT NULL DEFAULT 0,
    "rastreadorId" TEXT,
    "motoristaId" TEXT,
    "salarioMotorista" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seguroMensal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depreciacaoMensal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Caminhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Despesa" (
    "id" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "categoria" "public"."CategoriaDespesa" NOT NULL,
    "valorUsd" DOUBLE PRECISION NOT NULL,
    "litros" DOUBLE PRECISION,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TelemetriaDia" (
    "id" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "litrosCan" DOUBLE PRECISION,
    "odometroKm" INTEGER NOT NULL,
    "marchaLentaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "excessosVelocidade" INTEGER NOT NULL DEFAULT 0,
    "frenagensBruscas" INTEGER NOT NULL DEFAULT 0,
    "rpmAltoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TelemetriaDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ItemRevisao" (
    "id" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gatilho" "public"."Gatilho" NOT NULL,
    "intervaloKm" INTEGER,
    "ultimoKm" INTEGER,
    "vencimento" DATE,
    "intervaloDias" INTEGER,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItemRevisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServicoRevisao" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "odometroKm" INTEGER NOT NULL,
    "custoUsd" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "ServicoRevisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Viagem" (
    "id" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "carga" TEXT NOT NULL,
    "toneladas" DOUBLE PRECISION NOT NULL,
    "freteUsd" DOUBLE PRECISION NOT NULL,
    "kmCarregado" DOUBLE PRECISION NOT NULL,
    "kmVazio" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "public"."Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Caminhao_clienteId_placa_key" ON "public"."Caminhao"("clienteId", "placa");

-- CreateIndex
CREATE INDEX "Despesa_caminhaoId_data_idx" ON "public"."Despesa"("caminhaoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetriaDia_caminhaoId_data_key" ON "public"."TelemetriaDia"("caminhaoId", "data");

-- CreateIndex
CREATE INDEX "Viagem_caminhaoId_data_idx" ON "public"."Viagem"("caminhaoId", "data");

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Motorista" ADD CONSTRAINT "Motorista_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Caminhao" ADD CONSTRAINT "Caminhao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Caminhao" ADD CONSTRAINT "Caminhao_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "public"."Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Despesa" ADD CONSTRAINT "Despesa_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "public"."Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TelemetriaDia" ADD CONSTRAINT "TelemetriaDia_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "public"."Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ItemRevisao" ADD CONSTRAINT "ItemRevisao_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "public"."Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServicoRevisao" ADD CONSTRAINT "ServicoRevisao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."ItemRevisao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Viagem" ADD CONSTRAINT "Viagem_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "public"."Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
