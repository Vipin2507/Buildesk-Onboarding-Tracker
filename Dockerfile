# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/.output ./.output

USER app
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
