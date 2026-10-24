#!/bin/sh
# Usado no deploy da Vercel: aplica as migrações e cria os dados de exemplo
# se o banco estiver vazio. As migrações precisam de conexão direta; a Neon
# entrega DATABASE_URL pelo pooler (host com "-pooler"), então usamos a URL
# direta quando existe ou tiramos o "-pooler" do host.
set -e
URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -z "$URL" ]; then
  echo "ERRO: DATABASE_URL não definido. Conecte o banco Neon ao projeto em Storage." >&2
  exit 1
fi
URL=$(printf '%s' "$URL" | sed 's/-pooler\././')
# O pooler não mantém o lock de migração; com um único deploy por vez ele não é necessário.
export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1
DATABASE_URL="$URL" npx prisma migrate deploy
DATABASE_URL="$URL" SEED_SE_VAZIO=1 npx tsx prisma/seed.ts
