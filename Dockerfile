# Pinned by digest so the toolchain can't change under us.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
# Pre-create node_modules owned by the unprivileged user so the named volume inherits it.
RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR /app
USER node
