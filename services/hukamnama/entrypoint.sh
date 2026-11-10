#!/bin/sh
# Start the Hukamnama service, under Litestream when R2 credentials are configured.
set -eu

if [ -n "${LITESTREAM_ACCESS_KEY_ID:-}" ] && [ -n "${LITESTREAM_SECRET_ACCESS_KEY:-}" ]; then
  for v in HUKAMNAMA_R2_ENDPOINT HUKAMNAMA_R2_BUCKET; do
    eval "val=\${$v:-}"
    if [ -z "$val" ]; then
      echo "entrypoint: $v is not set; refusing to start half-configured backups" >&2
      exit 1
    fi
  done
  # Litestream restores a missing state DB, replicates while the service runs, and stops when
  # the service exits.
  exec litestream replicate -config /etc/litestream.yml
fi

echo "entrypoint: R2 credentials not set; running without Litestream backup" >&2
exec python -m hukamnama serve
