-- Países por onde a rota salva passa, para a média do diesel no simulador.
ALTER TABLE "RotaFrete" ADD COLUMN "paises" TEXT[] DEFAULT ARRAY[]::TEXT[];
