-- AlterTable
ALTER TABLE "Caminhao" ADD COLUMN     "ultimaIgnicao" BOOLEAN,
ADD COLUMN     "ultimaLat" DOUBLE PRECISION,
ADD COLUMN     "ultimaLng" DOUBLE PRECISION,
ADD COLUMN     "ultimaPosicaoEm" TIMESTAMP(3),
ADD COLUMN     "ultimaVelocidade" INTEGER;

-- CreateTable
CREATE TABLE "Posicao" (
    "id" BIGSERIAL NOT NULL,
    "caminhaoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "velocidadeKmh" INTEGER NOT NULL,
    "direcao" INTEGER NOT NULL DEFAULT 0,
    "satelites" INTEGER NOT NULL DEFAULT 0,
    "ignicao" BOOLEAN,
    "odometroKm" DOUBLE PRECISION,
    "litrosTotal" DOUBLE PRECISION,
    "rpm" INTEGER,
    "evento" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Posicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Posicao_caminhaoId_data_idx" ON "Posicao"("caminhaoId", "data");

-- AddForeignKey
ALTER TABLE "Posicao" ADD CONSTRAINT "Posicao_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "Caminhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

