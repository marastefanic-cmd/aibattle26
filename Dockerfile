FROM node:22-alpine

WORKDIR /app

# Zero-dependency app: no package install step needed, but keep this in case
# dependencies get added later (npm ci is a no-op without a lockfile install).
COPY package.json ./
COPY . .

ENV PORT=3000
EXPOSE 3000

# Orders are persisted to data/orders.json; mount a volume so they survive
# container restarts/rebuilds.
VOLUME ["/app/data"]

CMD ["node", "server.js"]
