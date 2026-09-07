#!/bin/sh
# DOMAIN + gerçek Let's Encrypt dosyası varsa HTTPS, yoksa HTTP+ACME.
set -eu

DOMAIN="${DOMAIN:-_}"
export DOMAIN

if [ "$DOMAIN" != "_" ] && [ -n "$DOMAIN" ] \
  && [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "==> nginx: HTTPS (${DOMAIN})"
  envsubst '${DOMAIN}' < /etc/nginx/https.conf.template > /etc/nginx/conf.d/default.conf
else
  echo "==> nginx: HTTP (sertifika yok veya DOMAIN boş)"
  envsubst '${DOMAIN}' < /etc/nginx/http.conf.template > /etc/nginx/conf.d/default.conf
fi

nginx -t
exec nginx -g "daemon off;"
