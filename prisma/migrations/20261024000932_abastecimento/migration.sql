-- AlterEnum
ALTER TYPE "public"."CategoriaDespesa" ADD VALUE 'ARLA32';

-- AlterTable
ALTER TABLE "public"."Despesa" ADD COLUMN     "odometroKm" INTEGER,
ADD COLUMN     "posto" TEXT,
ADD COLUMN     "precoLitro" DOUBLE PRECISION,
ADD COLUMN     "tanqueCheio" BOOLEAN NOT NULL DEFAULT false;
