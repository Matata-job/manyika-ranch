#!/usr/bin/env bash
# Create the public animal-photos bucket on Supabase (run once after creating a project).
# Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
BUCKET="${SUPABASE_STORAGE_BUCKET:-animal-photos}"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env"
  exit 1
fi

echo "Creating bucket: $BUCKET ..."
HTTP=$(curl -s -o /tmp/supabase-bucket.json -w "%{http_code}" \
  -X POST "${URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${KEY}" \
  -H "apikey: ${KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${BUCKET}\",\"name\":\"${BUCKET}\",\"public\":true,\"file_size_limit\":5242880,\"allowed_mime_types\":[\"image/jpeg\",\"image/png\",\"image/webp\"]}")

if [[ "$HTTP" == "200" || "$HTTP" == "201" ]]; then
  echo "Bucket ready (HTTP $HTTP)."
elif grep -qi "already exists\|duplicate\|409" /tmp/supabase-bucket.json 2>/dev/null; then
  echo "Bucket already exists — OK."
else
  echo "Response HTTP $HTTP:"
  cat /tmp/supabase-bucket.json
  echo ""
  echo "If the bucket already exists in the Supabase dashboard, you can ignore this."
fi
