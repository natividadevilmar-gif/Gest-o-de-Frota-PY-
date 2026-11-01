-- Link público de rastreio do frete para o destinatário da carga.
ALTER TABLE "Viagem" ADD COLUMN "linkToken" TEXT;
ALTER TABLE "Viagem" ADD COLUMN "linkExpiraEm" TIMESTAMP(3);
CREATE UNIQUE INDEX "Viagem_linkToken_key" ON "Viagem"("linkToken");
