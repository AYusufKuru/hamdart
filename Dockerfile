# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Europe/Istanbul

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
# postinstall prisma generate şema ister; generate builder aşamasında
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# generate gerçek DB'ye bağlanmaz; prisma.config env() için yer tutucu
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npx prisma generate
RUN npm run build

# migrate deploy + seed için CLI — runner'da root npm install yok
FROM base AS tools
WORKDIR /tools
COPY package.json ./
RUN node -e "\
const fs=require('fs');\
const p=JSON.parse(fs.readFileSync('package.json','utf8'));\
const deps={\
  prisma: p.devDependencies.prisma,\
  '@prisma/client': p.dependencies['@prisma/client'],\
  tsx: p.devDependencies.tsx,\
  bcryptjs: p.dependencies.bcryptjs,\
  xlsx: p.dependencies.xlsx,\
};\
fs.writeFileSync('package.json', JSON.stringify({name:'hamdart-tools',private:true,dependencies:deps},null,2));\
" \
  && npm install --omit=dev \
  && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production
ENV TZ=Europe/Istanbul

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates \
       openssl \
       tzdata \
       postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# standalone'dan sonra: Excel seed ve migration dosyaları ezilmesin
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib/auth/password-rules.ts ./src/lib/auth/password-rules.ts
COPY --from=builder /app/src/data/departments.ts ./src/data/departments.ts

COPY --from=tools /tools/node_modules /opt/hamdart-tools/node_modules
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/backups \
  && chown -R nextjs:nodejs /app /opt/hamdart-tools \
  && chmod 755 /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PATH="/opt/hamdart-tools/node_modules/.bin:${PATH}"
ENV NODE_PATH=/opt/hamdart-tools/node_modules

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
