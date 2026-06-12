FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages
RUN pnpm install --no-frozen-lockfile
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S matrixbuilder && adduser -S matrixbuilder -G matrixbuilder && corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages
USER matrixbuilder
EXPOSE 3000
CMD ["pnpm", "--filter", "@ruslanmv/matrix-builder-web", "dev", "--", "--hostname", "0.0.0.0"]
