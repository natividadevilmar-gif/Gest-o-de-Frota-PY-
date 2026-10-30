-- Unidade que é a base de abastecimento (surtidor), não um caminhão.
ALTER TABLE "Caminhao" ADD COLUMN "baseCombustivel" BOOLEAN NOT NULL DEFAULT false;

-- Os surtidores já importados do Wialon passam a ser base.
UPDATE "Caminhao" SET "baseCombustivel" = true WHERE "placa" ILIKE '%surtidor%';

-- E os alertas abertos deles se fecham.
UPDATE "Ocorrencia"
SET "status" = 'resolvida', "resolvidaEm" = now(), "observacao" = 'Base de abastecimento: não gera alertas.'
WHERE "status" <> 'resolvida' AND "caminhaoId" IN (SELECT "id" FROM "Caminhao" WHERE "baseCombustivel");
