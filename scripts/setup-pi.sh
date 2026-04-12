#!/usr/bin/env bash
# =============================================================================
# setup-pi.sh — Configura il Raspberry Pi per il deploy di HomeTab
#
# Eseguire come utente con sudo sul Raspberry Pi:
#   bash setup-pi.sh
#
# Cosa fa:
#   1. Installa Docker + Docker Compose plugin
#   2. Crea l'utente 'hometab' e lo aggiunge al gruppo docker
#   3. Crea la struttura di directory per l'app e i backup
#   4. Scarica il docker-compose.yml da GitHub
#   5. Guida all'installazione del self-hosted runner GitHub Actions
# =============================================================================

set -euo pipefail

GITHUB_REPO="federicoscimone/hometab"   # <-- cambia se il repo ha nome diverso
APP_USER="hometab"
APP_DIR="/home/${APP_USER}/hometab"
BACKUP_DIR="/home/${APP_USER}/backups"

echo "========================================"
echo "  HomeTab — Setup Raspberry Pi"
echo "========================================"

# ── 1. Installa Docker ────────────────────────────────────────────────────────
echo ""
echo "[1/5] Installazione Docker..."

if command -v docker &>/dev/null; then
  echo "  Docker già installato: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  echo "  Docker installato."
fi

# ── 2. Crea utente hometab ────────────────────────────────────────────────────
echo ""
echo "[2/5] Configurazione utente '${APP_USER}'..."

if id "${APP_USER}" &>/dev/null; then
  echo "  Utente '${APP_USER}' già esistente."
else
  useradd -m -s /bin/bash "${APP_USER}"
  echo "  Utente '${APP_USER}' creato."
fi

# Aggiunge hometab al gruppo docker (per eseguire docker senza sudo)
usermod -aG docker "${APP_USER}"
echo "  Utente '${APP_USER}' aggiunto al gruppo 'docker'."

# ── 3. Struttura directory ────────────────────────────────────────────────────
echo ""
echo "[3/5] Creazione directory..."

mkdir -p "${APP_DIR}"
mkdir -p "${BACKUP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "/home/${APP_USER}"
echo "  Directory create:"
echo "    ${APP_DIR}      ← app + docker-compose"
echo "    ${BACKUP_DIR}   ← backup MongoDB"

# ── 4. Scarica docker-compose.yml ─────────────────────────────────────────────
echo ""
echo "[4/5] Download docker-compose.yml da GitHub..."

COMPOSE_URL="https://raw.githubusercontent.com/${GITHUB_REPO}/main/docker-compose.yml"
curl -fsSL "${COMPOSE_URL}" -o "${APP_DIR}/docker-compose.yml"
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/docker-compose.yml"
echo "  docker-compose.yml scaricato in ${APP_DIR}/"

# ── 5. Istruzioni runner GitHub Actions ───────────────────────────────────────
echo ""
echo "[5/5] Installazione self-hosted runner GitHub Actions"
echo ""
echo "  Vai su: https://github.com/${GITHUB_REPO}/settings/actions/runners/new"
echo "  Scegli: Linux / ARM64"
echo "  Segui le istruzioni per scaricare e configurare il runner."
echo ""
echo "  Comandi tipici (come utente '${APP_USER}'):"
echo "    su - ${APP_USER}"
echo "    mkdir actions-runner && cd actions-runner"
echo "    curl -o actions-runner-linux-arm64-<VERSION>.tar.gz -L <URL_RUNNER>"
echo "    tar xzf actions-runner-linux-arm64-<VERSION>.tar.gz"
echo "    ./config.sh --url https://github.com/${GITHUB_REPO} --token <TOKEN>"
echo "    sudo ./svc.sh install ${APP_USER}"
echo "    sudo ./svc.sh start"
echo ""
echo "  Il runner girerà come servizio systemd e si avvierà automaticamente al reboot."

# ── Promemoria .env.production ────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  IMPORTANTE: crea il file .env.production"
echo "  Posizione: ${APP_DIR}/.env.production"
echo ""
echo "  Contenuto minimo:"
echo "    AUTH_SECRET=<stringa casuale — genera con: openssl rand -hex 32>"
echo "    NEXT_PUBLIC_APP_URL=http://192.168.1.200:3000"
echo "    SMTP_HOST=..."
echo "    SMTP_PORT=587"
echo "    SMTP_SECURE=false"
echo "    SMTP_USER=..."
echo "    SMTP_PASS=..."
echo "    SMTP_FROM=HomeTab <...>"
echo "========================================"
echo ""
echo "Setup completato. Riavvia il Pi o esegui 'newgrp docker' per attivare il gruppo docker."
