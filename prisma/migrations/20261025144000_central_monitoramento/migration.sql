-- AlterTable
ALTER TABLE "Caminhao" ADD COLUMN     "cercaAtualId" TEXT;

-- CreateTable
CREATE TABLE "Cerca" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "raioM" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cerca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "velocidadeKmh" INTEGER,
    "chave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "atendidaPor" TEXT,
    "atendidaEm" TIMESTAMP(3),
    "resolvidaEm" TIMESTAMP(3),
    "observacao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ocorrencia_chave_key" ON "Ocorrencia"("chave");

-- CreateIndex
CREATE INDEX "Ocorrencia_clienteId_status_criadaEm_idx" ON "Ocorrencia"("clienteId", "status", "criadaEm");

-- AddForeignKey
ALTER TABLE "Cerca" ADD CONSTRAINT "Cerca_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cercas de demonstração para os clientes de demonstração: o pátio em Santa Rita,
-- o porto de Asunción, um cliente em Coronel Oviedo e as fronteiras.
INSERT INTO "Cerca" (id, "clienteId", nome, tipo, lat, lng, "raioM")
SELECT 'demo_cerca_' || md5(cl.id || c.nome), cl.id, c.nome, c.tipo, c.lat, c.lng, c.raio
FROM "Cliente" cl
CROSS JOIN (VALUES
  ('Pátio Santa Rita', 'patio', -25.7900, -55.0900, 2500),
  ('Porto de Asunción', 'cliente', -25.2828, -57.6359, 4000),
  ('Cliente Coronel Oviedo', 'cliente', -25.4473, -56.4400, 3000),
  ('Fronteira Ciudad del Este · Foz', 'fronteira', -25.5097, -54.6111, 3000),
  ('Fronteira Encarnación · Posadas', 'fronteira', -27.3306, -55.8667, 3000),
  ('Fronteira Pedro Juan Caballero', 'fronteira', -22.5470, -55.7330, 3000)
) AS c(nome, tipo, lat, lng, raio)
WHERE cl.nome IN ('AVM Truck', 'Agrotransporte Naranjal', 'Combustibles del Este', 'Cooperativa San Alberto', 'Fletes Los Cedrales', 'Logística Itapúa')
ON CONFLICT (id) DO NOTHING;
