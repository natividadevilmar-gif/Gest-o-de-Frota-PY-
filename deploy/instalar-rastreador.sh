#!/usr/bin/env bash
# Instala o receptor dos rastreadores do KM Cero num servidor Ubuntu 22.04/24.04 novo.
# Uso (como root):  curl -fsSL <este arquivo> | bash -s -- "postgresql://...DATABASE_URL..."
# Ou: bash instalar-rastreador.sh "postgresql://..."
set -euo pipefail

DATABASE_URL="${1:-}"
if [ -z "$DATABASE_URL" ]; then
  echo "Informe a DATABASE_URL do banco (a mesma da Vercel):"
  echo "  bash instalar-rastreador.sh \"postgresql://usuario:senha@servidor/banco?sslmode=require\""
  exit 1
fi
REPO="${REPO:-https://github.com/natividadevilmar-gif/Gest-o-de-Frota-PY-.git}"
PASTA=/opt/kmcero

echo "1/5 Instalando Node.js 22 e git"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

echo "2/5 Baixando o código"
if [ -d "$PASTA/.git" ]; then git -C "$PASTA" pull -q; else git clone -q "$REPO" "$PASTA"; fi
cd "$PASTA"

echo "3/5 Instalando dependências"
npm ci --ignore-scripts --no-audit --no-fund --silent
npx prisma generate >/dev/null

echo "4/5 Configurando o serviço (liga sozinho quando o servidor reinicia)"
id kmcero >/dev/null 2>&1 || useradd --system --home "$PASTA" kmcero
chown -R kmcero "$PASTA"
umask 077
printf 'DATABASE_URL=%s\nPORTA_RASTREADOR=5027\nPORTA_SAUDE=8080\n' "$DATABASE_URL" > /etc/kmcero-rastreador.env
cp deploy/kmcero-rastreador.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kmcero-rastreador

echo "5/5 Liberando a porta 5027 no firewall"
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 5027/tcp >/dev/null; ufw allow 8080/tcp >/dev/null; fi

sleep 3
curl -fsS localhost:8080/saude && echo
IP=$(curl -fsS https://api.ipify.org || hostname -I | cut -d' ' -f1)
echo
echo "Pronto. Configure os aparelhos Teltonika com servidor $IP e porta 5027 (TCP)."
echo "Ver o que está chegando:  journalctl -u kmcero-rastreador -f"
