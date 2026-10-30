-- Lançar despesa passou a valer em todos os planos: a liberação por cliente não é mais usada.
ALTER TABLE "Cliente" DROP COLUMN "despesasLiberadas";
