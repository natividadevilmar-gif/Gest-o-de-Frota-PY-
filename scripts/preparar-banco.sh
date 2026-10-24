#!/bin/sh
# Usado no deploy da Vercel: aplica as migrações e cria os dados de exemplo
# se o banco estiver vazio. A Neon fornece DATABASE_URL (com pooler) e
# DATABASE_URL_UNPOOLED (direta); as migrações precisam da conexão direta.
set -e
URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -z "$URL" ]; then
  echo "ERRO: DATABASE_URL não definido. Conecte o banco Neon ao projeto em Storage." >&2
  exit 1
fi
DATABASE_URL="$URL" npx prisma migrate deploy
DATABASE_URL="$URL" SEED_SE_VAZIO=1 npx tsx prisma/seed.ts
