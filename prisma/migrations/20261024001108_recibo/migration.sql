-- AlterTable
ALTER TABLE "public"."Despesa" ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "recibo" BYTEA,
ADD COLUMN     "reciboTipo" TEXT;
