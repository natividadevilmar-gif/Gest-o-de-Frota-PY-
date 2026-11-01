-- CreateTable
CREATE TABLE "RegistroCarga" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "motoristaId" TEXT,
    "usuarioId" TEXT,
    "tipo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "duracaoS" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "precisaoM" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroCarga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroCarga_clienteId_criadoEm_idx" ON "RegistroCarga"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroCarga_caminhaoId_criadoEm_idx" ON "RegistroCarga"("caminhaoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "RegistroCarga" ADD CONSTRAINT "RegistroCarga_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCarga" ADD CONSTRAINT "RegistroCarga_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCarga" ADD CONSTRAINT "RegistroCarga_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

