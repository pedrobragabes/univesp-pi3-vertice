FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3002 \
    DATABASE_PATH=/app/data/vertice.db \
    SEED_DATABASE=false

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3002
CMD ["npm", "start"]
