ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.26-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

ARG VITE_DATA_MODE=live
ARG VITE_API_BASE_URL=/rpc
ARG VITE_POLL_INTERVAL_MS=15000
ARG VITE_RPC_TIMEOUT_MS=5000
ARG VITE_RPC_MAX_RETRIES=1
ARG VITE_RPC_RETRY_BASE_MS=300
ARG VITE_EXPECTED_RELEASE_MAJOR=
ARG VITE_EXPECTED_NETWORK_PROFILE=
ARG VITE_EXPECTED_CHAIN_ID=
ARG VITE_REQUIRE_CONTRACTS_DISABLED=true

ENV VITE_DATA_MODE=${VITE_DATA_MODE} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_POLL_INTERVAL_MS=${VITE_POLL_INTERVAL_MS} \
    VITE_RPC_TIMEOUT_MS=${VITE_RPC_TIMEOUT_MS} \
    VITE_RPC_MAX_RETRIES=${VITE_RPC_MAX_RETRIES} \
    VITE_RPC_RETRY_BASE_MS=${VITE_RPC_RETRY_BASE_MS} \
    VITE_EXPECTED_RELEASE_MAJOR=${VITE_EXPECTED_RELEASE_MAJOR} \
    VITE_EXPECTED_NETWORK_PROFILE=${VITE_EXPECTED_NETWORK_PROFILE} \
    VITE_EXPECTED_CHAIN_ID=${VITE_EXPECTED_CHAIN_ID} \
    VITE_REQUIRE_CONTRACTS_DISABLED=${VITE_REQUIRE_CONTRACTS_DISABLED}

RUN npm run build

FROM ${NGINX_IMAGE} AS runtime

RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
  && touch /var/run/nginx.pid \
  && chown -R nginx:nginx /var/cache/nginx /var/run/nginx.pid

COPY --chown=nginx:nginx deploy/nginx/pulsedag-explorer.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz >/dev/null || exit 1

STOPSIGNAL SIGQUIT
