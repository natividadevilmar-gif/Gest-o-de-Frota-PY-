-- Praças de pedágio achadas no caminho da rota salva do simulador.
ALTER TABLE "RotaFrete" ADD COLUMN "pracas" TEXT[] DEFAULT ARRAY[]::TEXT[];
