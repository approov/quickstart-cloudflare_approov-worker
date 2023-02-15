ARG NODE_VERSION=18.12.0-slim

FROM node:${NODE_VERSION}

ARG WRANGLER_VERSION=2.9.1

RUN npm install -g wrangler@"${WRANGLER_VERSION}"

USER node

ENV USER=node
ENV HOME=/home/"${USER}"

RUN \
  mkdir -p \
    "${HOME}"/bin \
    "${HOME}"/workspace \
    "${HOME}"/.wrangler \
    "${HOME}"/.config \
    "${HOME}"/.local \
    "${HOME}"/.cache

WORKDIR "${HOME}"/workspace

