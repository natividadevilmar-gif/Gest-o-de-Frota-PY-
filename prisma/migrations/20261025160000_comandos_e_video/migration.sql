-- AlterTable
ALTER TABLE "Caminhao" ADD COLUMN     "motorBloqueado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Comando" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "resposta" TEXT,
    "motivo" TEXT,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "Comando_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Midia" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "ocorrenciaId" TEXT,
    "tipo" TEXT NOT NULL,
    "camera" TEXT NOT NULL,
    "gatilho" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "velocidadeKmh" INTEGER,
    "duracaoS" INTEGER,
    "formato" TEXT,
    "conteudo" BYTEA,
    "tamanho" INTEGER,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "chave" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Midia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comando_caminhaoId_status_idx" ON "Comando"("caminhaoId", "status");

-- CreateIndex
CREATE INDEX "Comando_clienteId_criadoEm_idx" ON "Comando"("clienteId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Midia_chave_key" ON "Midia"("chave");

-- CreateIndex
CREATE INDEX "Midia_clienteId_data_idx" ON "Midia"("clienteId", "data");

-- CreateIndex
CREATE INDEX "Midia_caminhaoId_data_idx" ON "Midia"("caminhaoId", "data");

-- AddForeignKey
ALTER TABLE "Comando" ADD CONSTRAINT "Comando_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comando" ADD CONSTRAINT "Comando_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

