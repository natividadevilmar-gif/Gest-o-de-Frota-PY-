-- AlterEnum
ALTER TYPE "Papel" ADD VALUE 'MOTORISTA';

-- AlterTable
ALTER TABLE "Despesa" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "motoristaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_motoristaId_key" ON "Usuario"("motoristaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

