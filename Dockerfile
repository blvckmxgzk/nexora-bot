FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

STOPSIGNAL SIGTERM

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=30s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||'3000')+'/api/v1/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
