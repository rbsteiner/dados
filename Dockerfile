# Pinned by digest so the toolchain can't change under us.
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4
# Pre-create node_modules owned by the unprivileged user so the named volume inherits it.
RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR /app
USER node
