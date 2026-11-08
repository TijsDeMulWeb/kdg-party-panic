#!/usr/bin/env bash
#
# Deploys Party Panic to shared hosting over SSH (Combell).
# Builds everything locally (the host has no Node), uploads with rsync,
# then migrates and caches on the server.
#
# Usage:
#   COMBELL_SSH=user@ssh.host COMBELL_PATH=/path/to/partypanic scripts/deploy-combell.sh
#
# The server keeps its own backend/.env; it is never uploaded or overwritten.

set -euo pipefail

: "${COMBELL_SSH:?Set COMBELL_SSH, e.g. jouwgebruiker@ssh.jouwdomein.be}"
: "${COMBELL_PATH:?Set COMBELL_PATH, the folder that holds the Laravel app on the server}"
PHP_BIN="${COMBELL_PHP:-php}"

root="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Building the game (client → backend/public/app)…"
(cd "$root/client" && npm ci && npm run build)

echo "→ Installing production PHP dependencies…"
(cd "$root/backend" && composer install --no-dev --optimize-autoloader --no-interaction)

echo "→ Uploading to $COMBELL_SSH:$COMBELL_PATH …"
rsync -az --delete \
    --exclude '.env' \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'storage/logs/*' \
    --exclude 'storage/framework/sessions/*' \
    --exclude 'storage/framework/cache/*' \
    --exclude 'storage/framework/views/*' \
    --exclude 'database/database.sqlite' \
    --exclude 'tests' \
    --exclude '.claude' \
    "$root/backend/" "$COMBELL_SSH:$COMBELL_PATH/"

echo "→ Migrating and caching on the server…"
ssh "$COMBELL_SSH" "cd '$COMBELL_PATH' && $PHP_BIN artisan migrate --force --seed && $PHP_BIN artisan optimize"

echo "→ Restoring local dev dependencies…"
(cd "$root/backend" && composer install --no-interaction --quiet)

echo "✓ Deployed."
