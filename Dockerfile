FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js db.js ./
COPY public ./public
COPY seed ./seed
# Progress database and lecture videos live in volumes, not in the image.
RUN mkdir -p /data /media && chown -R node:node /data /media /app
ENV DATA_DIR=/data MEDIA_DIR=/media PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
