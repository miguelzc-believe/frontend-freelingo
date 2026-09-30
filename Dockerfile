FROM node:25-bookworm-slim AS builder
WORKDIR /app
# Bootstrap the pinned manager; all project dependencies are installed with pnpm.
RUN npm install --global pnpm@12.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/copy-vad-models.ts ./scripts/copy-vad-models.ts
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck && pnpm build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=builder --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
