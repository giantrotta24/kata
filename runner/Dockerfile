FROM node:24-alpine

WORKDIR /opt/runner
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY run.mjs vitest.config.mjs setup-dom.mjs tsconfig.json ./
RUN mkdir -p work/src work/tests out

ENTRYPOINT ["node", "/opt/runner/run.mjs"]
