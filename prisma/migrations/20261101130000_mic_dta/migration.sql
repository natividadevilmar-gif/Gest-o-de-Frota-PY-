-- CreateTable
CREATE TABLE "MicDta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "viagemId" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicDta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicDta_viagemId_key" ON "MicDta"("viagemId");

-- CreateIndex
CREATE INDEX "MicDta_caminhaoId_atualizadoEm_idx" ON "MicDta"("caminhaoId", "atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "MicDta_clienteId_ano_sequencia_key" ON "MicDta"("clienteId", "ano", "sequencia");

-- AddForeignKey
ALTER TABLE "MicDta" ADD CONSTRAINT "MicDta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicDta" ADD CONSTRAINT "MicDta_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

