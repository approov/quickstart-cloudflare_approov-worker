ARG NODE_VERSION=12.18.2-buster-slim

FROM node:${NODE_VERSION}

ARG WRANGLER_VERSION=1.10.3

RUN \
  apt update && \
  apt -y upgrade && \
  apt -y install \
    curl

RUN \
  curl \
    -SL \
    -o wrangler.tar.gz \
    https://github.com/cloudflare/wrangler/releases/download/v"${WRANGLER_VERSION}"/wrangler-v"${WRANGLER_VERSION}"-x86_64-unknown-linux-musl.tar.gz && \

  tar -zxvf wrangler.tar.gz && \
  mv dist/wrangler /usr/local/bin && \
  rm -rf dist wrangler.tar.gz

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
