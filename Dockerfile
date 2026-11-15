FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
ENV NODE_ENV=production
# Segnala al codice applicativo che questa build produce un'immagine container:
# abilita output standalone e fa saltare le connessioni al database in fase di
# build. Non esiste a runtime né su Vercel, che resta inalterata.
ENV BUILD_TARGET=container
# Valori fittizi solo per superare i controlli eager all'import dei moduli
# (next build analizza le route importandole, senza connettersi davvero).
ENV MONGODB_URI="mongodb://build:build@localhost:27017/build"
ENV NEXTAUTH_SECRET="build-time-placeholder-secret"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Per il bot Telegram (servizio "telegram" del compose): gira con node fuori da Next, quindi
# servono i sorgenti che importa e i testi. I pacchetti (mongoose) sono già nello standalone.
COPY --from=builder --chown=nextjs:nodejs /app/workers ./workers
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

# Versione della build (lib/buildInfo.js), passata dalla CI: commit e data. Qui in fondo, così
# un valore nuovo a ogni build non invalida la cache degli stage precedenti. Senza build arg
# (build locale) restano vuote e l'app si presenta come "-dev".
ARG BUILD_SHA=""
ARG BUILD_DATE=""
ENV BUILD_SHA=$BUILD_SHA \
    BUILD_DATE=$BUILD_DATE

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
