FROM node:24-bookworm-slim AS build
WORKDIR /build
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/api ./packages/api
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --filter server... \
    && pnpm --filter @wappy/api build \
    && pnpm --filter server build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH=/data/wappy.sqlite
WORKDIR /app
COPY --from=build /build/apps/server/package.json ./package.json
COPY --from=build /build/apps/server/dist ./dist
COPY --from=build /build/packages/api/package.json ./node_modules/@wappy/api/package.json
COPY --from=build /build/packages/api/dist ./node_modules/@wappy/api/dist
RUN mkdir /data && chown node:node /data && chmod 700 /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok||(await r.json()).ok!==true)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
