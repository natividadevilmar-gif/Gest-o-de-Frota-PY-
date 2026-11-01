-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "caminhaoId" TEXT,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fornecedor" TEXT,
    "moeda" TEXT NOT NULL DEFAULT 'USD',
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "valorUsd" DOUBLE PRECISION NOT NULL,
    "vencimento" DATE NOT NULL,
    "pagoEm" DATE,
    "grupo" TEXT,
    "parcela" INTEGER,
    "parcelas" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaPagar_clienteId_vencimento_idx" ON "ContaPagar"("clienteId", "vencimento");

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

