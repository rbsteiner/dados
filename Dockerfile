# Pinned by digest so the toolchain can't change under us.
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
# Pre-create node_modules owned by the unprivileged user so the named volume inherits it.
RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR /app
USER node
