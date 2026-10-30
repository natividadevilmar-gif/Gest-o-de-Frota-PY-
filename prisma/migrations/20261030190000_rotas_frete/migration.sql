-- Rotas pré-definidas do simulador de frete.
CREATE TABLE "RotaFrete" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "paisOrigem" TEXT NOT NULL DEFAULT 'PY',
    "destino" TEXT NOT NULL,
    "paisDestino" TEXT NOT NULL DEFAULT 'PY',
    "km" INTEGER NOT NULL,
    "rotaPedagioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaFrete_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RotaFrete_clienteId_idx" ON "RotaFrete"("clienteId");

ALTER TABLE "RotaFrete" ADD CONSTRAINT "RotaFrete_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
