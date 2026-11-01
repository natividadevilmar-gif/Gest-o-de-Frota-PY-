-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "viagemId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valorUsd" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recebimento_viagemId_idx" ON "Recebimento"("viagemId");

-- CreateIndex
CREATE INDEX "Recebimento_data_idx" ON "Recebimento"("data");

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

