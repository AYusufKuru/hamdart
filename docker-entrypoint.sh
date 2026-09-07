#!/bin/sh
# Üretim: her açılışta bekleyen migration'ları uygular, sonra CMD çalışır.
# Atlama: SKIP_MIGRATE=1
set -eu

if [ "${SKIP_MIGRATE:-}" != "1" ]; then
  echo "==> prisma migrate deploy"
  prisma migrate deploy --schema=prisma/schema.prisma
fi

exec "$@"
