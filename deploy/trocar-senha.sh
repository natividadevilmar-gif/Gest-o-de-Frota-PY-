#!/usr/bin/env bash
# Troca a senha do banco no receptor dos rastreadores (depois de girar a senha do Neon na Vercel).
# Uso (como root):  bash <(curl -fsSL https://raw.githubusercontent.com/natividadevilmar-gif/Gest-o-de-Frota-PY-/main/deploy/trocar-senha.sh)
set -euo pipefail
ARQ=/etc/kmcero-rastreador.env

echo "Cole a nova DATABASE_URL do Neon (começa com postgresql://) e aperte Enter:"
read -r BRUTA </dev/tty
# Pega só a URL: o console às vezes junta caracteres de controle na colagem.
URL=$(printf '%s' "$BRUTA" | grep -o "postgres[a-z]*://[^[:space:][:cntrl:]'\"]*" | head -1 || true)
if [ -z "$URL" ]; then
  echo "Não encontrei uma URL começando com postgresql://. Nada foi alterado."
  exit 1
fi
URL=${URL//&channel_binding=require/}
URL=${URL//channel_binding=require&/}

{ printf 'DATABASE_URL=%s\n' "$URL"; grep -v '^DATABASE_URL=' "$ARQ" || true; } > "$ARQ.novo"
chmod 600 "$ARQ.novo"
mv "$ARQ.novo" "$ARQ"
systemctl restart kmcero-rastreador

echo "Senha atualizada. Conferindo em 10 segundos..."
sleep 10
curl -fsS localhost:8080/saude && echo
