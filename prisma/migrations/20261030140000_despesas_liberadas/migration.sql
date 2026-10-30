-- Lançar despesa liberado para o cliente inteiro, mesmo fora do plano Gestão.
ALTER TABLE "Cliente" ADD COLUMN "despesasLiberadas" BOOLEAN NOT NULL DEFAULT false;

-- A SVM Trucks pediu: os motoristas dela lançam despesas.
UPDATE "Cliente" SET "despesasLiberadas" = true WHERE "nome" ILIKE '%svm%';
