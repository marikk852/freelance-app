# syntax=docker/dockerfile:1
# SafeDeal — API + Mini App + TON escrow.boc (multi-stage)

FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY contracts/package.json contracts/
COPY miniapp/package.json miniapp/

RUN npm ci

COPY . .

ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build -w safedeal-contracts \
  && npm run build -w safedeal-miniapp

FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/bot ./bot
COPY --from=builder /app/database ./database
COPY --from=builder /app/contracts/build ./contracts/build
COPY --from=builder /app/miniapp/dist ./miniapp/dist

RUN mkdir -p storage/encrypted storage/previews storage/released

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "node database/migrate.js && node backend/server.js"]
