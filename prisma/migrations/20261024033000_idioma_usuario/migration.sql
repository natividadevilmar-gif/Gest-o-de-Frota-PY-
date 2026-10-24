-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "idioma" "Idioma";


-- Motorista de demonstração usa o app em espanhol.
UPDATE "Usuario" SET "idioma" = 'es' WHERE "email" = '0981123456';
