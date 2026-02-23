FROM node:20-slim AS base
RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

# Create non-root user
RUN groupadd -r tekir && \
    useradd -r -g tekir -u 1000 -s /sbin/nologin tekir && \
    chown -R tekir:tekir /app

# Switch to non-root user
USER tekir

EXPOSE 3000

CMD [ "sh", "-c", "npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}" ]
