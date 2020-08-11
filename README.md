# Approov Quickstart - Cloudflare Worker

[Approov](https://approov.io) is an API security solution used to verify that requests received by your backend services originate from trusted versions of your mobile apps.

This repo implements the Approov server-side request verification code in a Cloudflare worker which performs the verification check before forwarding valid traffic through to the target API.


## Why?

You can learn more about Approov, the motives for adopting it, and more detail on how it works by following this [link](https://approov.io/approov-in-detail.html). In brief, Approov:

* Ensures accesses to your API come from official versions of your apps; it blocks accesses from republished, modified, or tampered versions
* Protects the sensitive data behind your API; it prevents direct API abuse from bots or scripts scraping data, or other malicious activity
* Secures the communication channel between your app and your API with [Approov Dynamic Certificate Pinning](https://approov.io/docs/latest/approov-usage-documentation/#approov-dynamic-pinning). This has all the benefits of traditional pinning but without the drawbacks
* No need for an API key in the mobile app
* DDoS prevention at application level with Approov and at network level via Clouflare.


## How it works?

A brief overview on how the Approov cloud service and the Approov Cloudflare worker fit together from a backend perspective.

Please read the [Approov in Detail](https://approov.io/approov-in-detail.html) page for a detailed overview of how the mobile app and backend fit together with the Approov cloud service and the Approov SDK.

### Approov Cloud Service

The Approov cloud service attests that a device is running a legitimate version of your mobile app and hasn't been tampered with:

* If the mobile app passes the integrity check by the Approov cloud service, then a valid token is returned to the mobile app, which then is sent over with every request the mobile app does to the backend
* If the mobile app fails the integrity check by the Approov cloud service, then a legitimate looking token will be returned, which is also sent with every request the mobile app does to the backend

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

A ready to use Postman collection can be found [here](https://raw.githubusercontent.com/approov/postman-collections/master/shapes-api/shapes-api-gateway-proxy.postman_collection.json). It contains a comprehensive set of example requests to send to the Cloudflare worker for testing. The collection contains requests with valid and invalid Approov Tokens, and with and without token binding.

> **NOTE:** The Postman collection contains Approov tokens signed with a dummy secret that was generated with `openssl rand -base64 64 | tr -d '\n'; echo`, therefore not a production secret retrieved with `approov secret -get base64`, thus in order to use it you need to set the `APPROOV_BASE64_SECRET` in Cloudflare, as explained in the quickstarts, to the following value: `h+CX0tOzdAAR9l15bWAqvq7w9olk66daIH+Xk+IAHhVVHszjDzeGobzNnqyRze3lw/WVyWrc2gZfh3XXfBOmww==`.

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
* [Cloudflare Logs for Enterprise Customers](https://www.cloudflare.com/products/cloudflare-logs/)
* [Log to ElasticSearch](https://blog.cloudflare.com/logs-from-the-edge/)
* [Log to Sentry](https://blog.cloudflare.com/dogfooding-edge-workers/)
* [Log to LogDNA](https://community.cloudflare.com/t/simple-log-collector-worker/40954)
