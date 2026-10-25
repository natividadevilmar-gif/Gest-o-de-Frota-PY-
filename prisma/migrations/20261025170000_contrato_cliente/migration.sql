-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "caminhoesContratados" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "contratoInicio" TIMESTAMP(3),
ADD COLUMN     "diaVencimento" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "planoContratado" "Plano" NOT NULL DEFAULT 'GESTAO',
ADD COLUMN     "prazoMeses" INTEGER NOT NULL DEFAULT 12;


-- Clientes já cadastrados: o plano mais usado na frota, a quantidade atual e o início no cadastro.
UPDATE "Cliente" c SET
  "caminhoesContratados" = GREATEST(1, (SELECT COUNT(*) FROM "Caminhao" k WHERE k."clienteId" = c.id)),
  "planoContratado" = COALESCE((SELECT k.plano FROM "Caminhao" k WHERE k."clienteId" = c.id GROUP BY k.plano ORDER BY COUNT(*) DESC, k.plano DESC LIMIT 1), 'GESTAO'),
  "contratoInicio" = c."criadoEm";
