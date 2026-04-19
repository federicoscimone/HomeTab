#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
OUT_DIR="${2:-./backups}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "File env non trovato: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$OUT_DIR/mongo-${MONGO_DATABASE}-${TS}.gz"

docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T mongodb \
  mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_DATABASE" \
  --archive --gzip > "$ARCHIVE"

echo "Backup creato: $ARCHIVE"