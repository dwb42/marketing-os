#!/usr/bin/env bash
set -euo pipefail

# Entwicklungs-Bootstrap für das Marketing OS.
# Idempotent — kann mehrfach ausgeführt werden.

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "→ creating .env from .env.example"
  cp .env.example .env
  KEY="$(openssl rand -base64 32)"
  # portable in-place edit for macOS + Linux
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^MOS_CREDENTIAL_KEY=.*|MOS_CREDENTIAL_KEY=${KEY}|" .env
  else
    sed -i "s|^MOS_CREDENTIAL_KEY=.*|MOS_CREDENTIAL_KEY=${KEY}|" .env
  fi
fi

echo "→ starting postgres via docker compose"
docker compose up -d postgres

echo "→ waiting for postgres"
for _ in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres -d marketing_os >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "→ npm install"
npm install

echo "→ prisma generate"
npx prisma generate

echo "→ prisma migrate (dev, name=init)"
npx prisma migrate dev --name init

echo "→ seeding pflegemax"
npm run seed:pflegemax

echo "✓ dev environment ready. Start with: npm run dev"
