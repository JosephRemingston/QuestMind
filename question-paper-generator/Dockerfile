# Build from repository root: docker build -f question-paper-generator/Dockerfile .
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY question-paper-generator/package.json ./question-paper-generator/package.json
RUN npm ci --omit=dev --no-fund --no-audit
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --chown=node:node question-paper-generator ./question-paper-generator
WORKDIR /app/question-paper-generator
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
