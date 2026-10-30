# Node 24 LTS, not 26: telegraf 4.16.3 (latest) multipart uploads hang on Node 26, so sendPhoto never completes.
FROM node:24-bookworm-slim
ENV NODE_ENV=production TZ=Europe/Lisbon DATA_DIR=/data
# fonts: the slim image has none, so chart text (Cyrillic titles/labels) would render as boxes.
# tzdata: keeps TZ=Europe/Lisbon working for `date` and anything outside Node's ICU.
# libexpat1: the linux-arm64 canvas prebuild links it dynamically (x64 does not); the Coolify VPS is arm64.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig-config fonts-dejavu-core tzdata libexpat1 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# drop the npm download cache and canvas prebuild tarballs (~27MB, unused at runtime)
RUN npm ci --omit=dev && rm -rf /root/.npm
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
CMD ["node", "src/jisao-bot.js"]
