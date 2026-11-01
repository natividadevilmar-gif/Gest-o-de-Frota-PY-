-- CreateTable
CREATE TABLE "Crt" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "viagemId" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Crt_viagemId_key" ON "Crt"("viagemId");

-- CreateIndex
CREATE INDEX "Crt_clienteId_atualizadoEm_idx" ON "Crt"("clienteId", "atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Crt_clienteId_sequencia_key" ON "Crt"("clienteId", "sequencia");

-- AddForeignKey
ALTER TABLE "Crt" ADD CONSTRAINT "Crt_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crt" ADD CONSTRAINT "Crt_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

