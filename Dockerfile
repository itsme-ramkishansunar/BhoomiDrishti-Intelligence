FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    SERVE_FRONTEND=true \
    BACKEND_PORT=8787 \
    FRONTEND_ORIGIN=http://localhost:8787 \
    BHOOMI_PERSISTENT_ROOT=/var/lib/bhoomidrishti/data
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN python3 -m pip install --break-system-packages -r requirements-intake.txt && npm run build
RUN mkdir -p /var/lib/bhoomidrishti/data && chown -R node:node /app /var/lib/bhoomidrishti
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","backend/server.js"]
