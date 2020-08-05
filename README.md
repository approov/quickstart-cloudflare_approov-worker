# Approov Quickstart - Cloudflare Worker

Approov Cloudflare worker that verifies incoming requests have a valid [Approov](https://approov.io) JSON Web Token (JWT) before the request is forwarded on to your infrastructure or to a third party service.

Approov is meant to be used when you want to ensure that only your mobile app can talk to your mobile API, and you can learn in more detail how this is done [here](https://approov.io/approov-in-detail.html).


## Why?

There are a lot of [reasons](https://approov.io/approov-in-detail.html) for wanting to do this, and some of them are:

* Allow the API to validate the request is from a genuine and untampered version of your mobile app
* Prevent abuse of your APIs (scraping, malicious activity, etc)
* No need for an API key in the app
* [Approov Dynamic Certificate Pinning](https://approov.io/docs/latest/approov-usage-documentation/#approov-dynamic-pinning) with all the benefits from traditional implementations, but without their drawbacks
* DDoS prevention


## How it works?

A brief overview on how the Approov cloud service and the Approov Cloudflare worker fit together from a backend perspective.

### Approov Cloud Service

The Approov cloud service attests that a device is running a legitimate version of your mobile application and hasn't been tampered with:

1. If the application looks ok, the Approov cloud service returns a token to your mobile application which is then sent over with any request, and if is validated by the Approov Cloudflare worker the request is processed
2. If the application doesn't look ok, the Approov cloud service returns a legitimate looking token that will fail the Approov Cloudflare worker validation, and the request won't be processed


### Approov Cloudflare Worker

The Approov Cloudflare worker ensures the JWT supplied in the `Approov-Token` header is present and valid. The validation is done by using a shared secret only known by the Approov cloud service and the Approov Cloudflare worker.

The request is handled as such:

* If the Approov Token is valid, it's passed on using whatever Cloudflare rules you have.
* If the Approov Token is invalid, a HTTP 401 Unauthorized is returned.

You can choose to log JWT verification failures, but that typically has to go to another provider or you can use the Cloudflare `wrangler tail` command to see the logs from your computer, but that requires a subscription of another Cloudflare service.


## Approov Token Quickstart

Please follow this [guide](/workers/approov-token/README.md) for a quickstart on integrating Approov in your current Cloudflare infrastructure.


## Approov Token Binding Quickstart

The [Approov Token Binding](https://approov.io/docs/latest/approov-usage-documentation/#token-binding) is an advanced feature of Approov that lets you to bind another header in the request with the Approov Token itself. For example the Authorization header.

Please follow this [guide](/workers/approov-token-binding/README.md) for a quickstart on integrating Approov in your current Cloudflare infrastructure with token binding support.


## API Requests with Postman

A ready to use Postman collection can be found [here](https://raw.githubusercontent.com/approov/postman-collections/master/shapes-api/shapes-api-gateway-proxy.postman_collection.json), that contains a very comprehensive set of example requests for valid and invalid Approov Tokens, with and without token binding.

> **NOTE:** The Postman collection contains Approov tokens signed with a dummy secret that was generated with `openssl rand -base64 64 | tr -d '\n'; echo`, therefore not a production secret retrieved with `approov secret -get base64`, thus in order to use it you need to set the `APPROOV_BASE64_SECRET` in Cloudflare, as explained in the quickstarts, with the value of `h+CX0tOzdAAR9l15bWAqvq7w9olk66daIH+Xk+IAHhVVHszjDzeGobzNnqyRze3lw/WVyWrc2gZfh3XXfBOmww==`.


## Troubleshooting

* The first thing to do is to switch Cloudflare to development mode in order to bypass cache and always hit the origin server.
* Check the wildcards `*` in your route pattern, and ensure they go by the rules defined [here](https://developers.cloudflare.com/workers/about/routes/).
* Run the `wrangler dev` command to have your code running at http://localhost:8787, and be able to see the errors in the console.


## Useful Links

### Cloudflare

#### Development

* [Debugging Tips](https://developers.cloudflare.com/workers/about/tips/debugging/)
* [Debugging Workers](https://dev.to/cloudflareworkers/announcing-new-tools-to-debug-your-cloudflare-workers-applications-4hn9)
* [How to log headers](https://developers.cloudflare.com/workers/about/tips/headers/)

#### Logs

* [Tail logs with the wrangler cli](https://developers.cloudflare.com/workers/tooling/wrangler/commands/#tail)
* [Cloudflare Logs for Entrepise Customers](https://www.cloudflare.com/products/cloudflare-logs/)
* [Log to ElasticSearch](https://blog.cloudflare.com/logs-from-the-edge/)
* [Log to Sentry](https://blog.cloudflare.com/dogfooding-edge-workers/)
* [Log to LogDNA](https://community.cloudflare.com/t/simple-log-collector-worker/40954)
