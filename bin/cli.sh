#!/bin/sh

set -eu

Show_Help() {
  printf "
WRANGLER FROM DOCKER

SIGNATURE:

./wrangler <command>


COMMANDS:

build-docker  Build the docker image for the Wrangler CLI tool.
              $ ./wrangler build-docker

shell         Starts a docker container with a bash shell to use the Wrangler CLI tool.
              $ ./wrangler shell

"
}

Docker_Build() {

  sudo docker build --tag "${DOCKER_IMAGE}" docker/build
}

Docker_Shell() {

  sudo docker run \
    --rm \
    -it \
    --publish 127.0.0.1:8787:8787 \
    --env-file ./.env \
    --volume "${PWD}":/home/node/workspace \
    --volume "${LOCAL_WRANGLER_DIR}":/home/node/.wrangler \
    "${DOCKER_IMAGE}" ${@}
}

Main() {

  local DOCKER_IMAGE="approov/cloudflare-cli"
  local WRANGLER_VERSION=
  local LOCAL_WRANGLER_DIR="${PWD}"/.local/.wrangler

  mkdir -p "${LOCAL_WRANGLER_DIR}"

  for input in "${@}"; do
    case "${input}" in
      build-docker )
        Docker_Build
        exit $?
        ;;

      shell )
        shift 1
        Docker_Shell "bash"
        exit $?
        ;;

      * )
        Show_Help
        exit 0
        ;;

    esac
  done

  Show_Help
  exit $?

}

Main ${@}
