#!/bin/sh

set -eu

Show_Help() {
  printf "
WRANGLER FROM DOCKER


SIGNATURE:

./bin/wrangler.sh [options] <command>


OPTIONS:

-h | --help         Shows only the help for Wrangler CLI.
                    $ ./bin/wrangler.sh --help

--help-me           Shows only the help for bash script wrapper.
                    $ ./bin/wrangler.sh --help-me


COMMANDS:

build-docker        Build the docker image for the Wrangler CLI tool.
                    $ ./bin/wrangler.sh build-docker

test-valid-token    Test to send a request with a valid Approov token.
                    $ ./bin/wrangler.sh test-valid-token

test-invalid-token  Test to send a request with an invalid Approov token.
                    $ ./bin/wrangler.sh test-valid-token

shell               Starts a docker container with a bash shell to use the Wrangler CLI tool.
                    $ ./bin/wrangler.sh shell

*                   Use any command supported by the Wrangler cli
                    $ ./bin/wrangler.sh help

"
}

Docker_Build() {
  sudo docker build --tag "${DOCKER_IMAGE}" .
}

Docker_Shell() {
  sudo docker run \
    --rm \
    -it \
    --publish 127.0.0.1:8976:8976 \
    --publish 127.0.0.1:8787:8787 \
    --env-file ./.env \
    --volume "${PWD}":/home/node/workspace \
    --volume "${LOCAL_WRANGLER_DIR}":/home/node/.wrangler \
    "${DOCKER_IMAGE}" ${@}
}

Run_Wrangler() {
  sudo docker run \
    --rm \
    -it \
    --env-file ./.env \
    ${PUBLISH_PORTS_MAP} \
    --volume "${PWD}":/home/node/workspace \
    --volume "${LOCAL_WRANGLER_DIR}":/home/node/.wrangler \
    "${DOCKER_IMAGE}" wrangler ${@}
}

Test_Valid_Token() {
  local api_domain=${1? Set the env var API_DOMAIN or provide the value, e.g test-valid-token example.com}
  local token=$(approov token -genExample ${api_domain} -type valid)
  curl -I localhost:8787 --header "Approov-Token: ${token}"
}

Test_Invalid_Token() {
  local api_domain=${1? Set the env var API_DOMAIN or provide the value, e.g test-invalid-token example.com}
  local token=$(approov token -genExample ${api_domain} -type invalid)
  curl -I localhost:8787 --header "Approov-Token: ${token}"
}

Main() {

  local DOCKER_IMAGE="approov/cloudflare-cli"
  local WRANGLER_VERSION=
  local LOCAL_WRANGLER_DIR="${PWD}"/.local/.wrangler
  local PUBLISH_PORTS_MAP=

  mkdir -p "${LOCAL_WRANGLER_DIR}"

  if [ -f ./.env ]; then
    . ./.env
  fi

  for input in "${@}"; do
    case "${input}" in
      --help-me )
        Show_Help
        exit $?
      ;;

      build-docker )
        Docker_Build
        exit $?
      ;;

      test-valid-token )
        Test_Valid_Token ${2:-${API_DOMAIN}}
        exit $?
      ;;

      test-invalid-token )
        Test_Invalid_Token ${2:-${API_DOMAIN}}
        exit $?
      ;;

      shell )
        shift 1
        Docker_Shell "bash"
        exit $?
      ;;

      dev | login )
        PUBLISH_PORTS_MAP="--publish 127.0.0.1:8976:8976 --publish 127.0.0.1:8787:8787"
      ;;
    esac
  done

  Run_Wrangler "${@}"

  if [ -z ${@} ]; then
    printf "\n\n-------------------> Bash Script Wrapper Help <-------------------\n"
    Show_Help
  fi

  exit $?

}

Main ${@}
