-- Rota prevista de cada frete, para o alerta de desvio de rota.
ALTER TABLE "Viagem" ADD COLUMN "rota" JSONB;
ALTER TABLE "Viagem" ADD COLUMN "rotaKm" DOUBLE PRECISION;
ALTER TABLE "Viagem" ADD COLUMN "rotaErro" TEXT;
