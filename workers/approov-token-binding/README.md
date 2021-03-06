# Approov Token Binding Quickstart

This quickstart is for developers familiar with Cloudflare who are looking for a quick intro into how they can add [Approov](https://approov.io) into an existing project. Therefore this will guide you through the necessary steps for adding Approov to an existing site being routed through Cloudflare.

The code in this quickstart assumes that the initial deployment will be to a staging environment. After you have finished your testing you just need to replace all occurrences of `staging` with `production` to switch to a production deployment of the Approov Cloudflare worker.


## Why?

To lock down your API server to your mobile app. Please read the brief summary in the [README](/README.md#why) at the root of this repo or visit our [website](https://approov.io/approov-in-detail.html) for more details.


## How it works?

For more background, see the overview in the [README](/README.md#how-it-works) at the root of this repo.

The main functionality for the Approov token check is in [jwt-verifier.js](/workers/approov-token/jwt-verifier.js). Take a look at the `handleRequest` function to see the simple code for the Approov token check, followed by a look at the `handleApproovTokenBindingCheck` to see how the Approov token binding checks works.


## Requirements

In order to complete this quickstart you will need both the Approov and Cloudflare CLI tools.

### Cloudflare CLI Tool

If you haven't yet installed Cloudflare's CLI tools, please read their _wrangler_ [installation instructions](https://developers.cloudflare.com/workers/tooling/wrangler/install/).

### Approov CLI Tool

If you haven't yet installed the Approov CLI, please read our [installation instructions](https://approov.io/docs/latest/approov-installation/#approov-tool) to install the [Approov CLI Tool](https://approov.io/docs/latest/approov-cli-tool-reference/).


## Approov Setup

In order to use Approov with Cloudflare we need a small amount of configuration. First, Approov needs to know the API domain that will be protected. Second, Cloudflare needs the Approov Base64 encoded secret that will be used to verify the tokens generated by the Approov cloud service.

### Configure API Domain

Approov needs to know the domain name of the API for which it will issue tokens.

Add it with:

```text
approov api -add your.api.domain.com
```

Adding the API domain also configures the [dynamic certificate pinning](https://approov.io/docs/latest/approov-usage-documentation/#approov-dynamic-pinning) setup, out of the box.

> **NOTE:** By default the pin is extracted from the public key of the leaf certificate served by the domain, as visible to the box issuing the Approov CLI command and the Approov servers. More complicated configurations are supported, but for the default setup to work correctly, all Cloudflare geographic zones must use the same certificate.


## Approov Cloudflare Worker

### Wrangler Configuration

A wrangler configuration example can be found at [workers/approov-token/wrangler.example.toml](/workers/approov-token/wrangler.example.toml).

Copy it to `wrangler.toml` and edit the file in order to replace all occurrences of `REPLACE_WITH_YOUR_API_DOMAIN` with the same domain you added with `approov api -add your.api.domain.com`.

You can read more about Cloudflare routes configuration [here](https://developers.cloudflare.com/workers/about/routes/).

Bear in mind that the `wrangler.example.toml` file assumes that the Cloudflare env vars `CF_ACCOUNT_ID`, `CF_ZONE_ID` and `CF_API_TOKEN` are set in the host environment.


### Deploy the Approov Worker

To deploy the Approov Cloudflare worker we will use the Cloudflare wrangler cli tool.

From the `workers/approov-token/` folder run:

```text
wrangler publish --env staging
```

### Approov Secret for the Approov Worker

Approov tokens are signed with a symmetric secret. To verify tokens, we need to grab the secret using the [Approov secret command](https://approov.io/docs/latest/approov-cli-tool-reference/#secret-command) and plug it into the Cloudflare worker to check the signatures of the [Approov Tokens](https://www.approov.io/docs/latest/approov-usage-documentation/#approov-tokens) that it processes.

#### Retrieve the Approov Secret

```text
approov secret -get base64
```

> **NOTE:** The `approov secret` command requires an [administration role](https://approov.io/docs/latest/approov-usage-documentation/#account-access-roles) to execute successfully.

#### Set the Approov Base64 Secret in Cloudflare

From the root of `workers/approov-token-binding/` folder run:

```text
wrangler secret put --env staging APPROOV_BASE64_SECRET
```

> **NOTE:**: You will need to run this command the first time you deploy the Approov token binding worker in each environment.

#### Set the Approov Token Binding Header Name in Cloudflare

The default value for `TOKEN_BINDING_HEADER_NAME` in the code is `Authorization`, therefore you just need to set it in Cloudflare as an environment variable if you plan to use a different header name.

To use a different header name run from the root of `workers/approov-token-binding/` folder:

```text
wrangler secret put --env staging TOKEN_BINDING_HEADER_NAME
```

> **NOTE:**: You will need to run this command the first time you deploy the Approov token binding worker in each environment.

### Logging

Logging is not enabled by default. To enable it, you need to set the environment variable `APPROOV_LOGGING_ENABLED` to `true`.

From the `workers/approov-token/` folder run:

```text
wrangler secret put --env staging APPROOV_LOGGING_ENABLED
```

> **NOTE:**: To enable logging, you will need to run this command the first time you deploy the Approov token worker in each environment.

### View the Secrets in the Cloudfare Dashboard

Now you can visit the Cloudflare Dashboard, select the tab **Workers**, click in the worker name, and then select the tab **Settings** to see the `APPROOV_BASE64_SECRET` and `TOKEN_BINDING_HEADER_NAME` listed as environment variables.


### Test it Works

The following examples below use cURL, but you can also use the [Postman Collection](/README.md#api-requests-with-postman) to make the API requests. Just remember that you need to adjust the urls and tokens defined in the collection to match your deployment. Alternatively, the above README also contains instructions for using the preset _dummy_ secret to test your worker.

#### With Valid Approov Tokens

Generate a valid token example from the Approov Cloud service:

```
approov token -setDataHashInToken 'Bearer theuthorizationtokenhere' -genExample your.api.domain.com
```

Then make the request with the generated token:

```
curl -i --request GET 'https://your.api.domain.com/v1/shapes' \
  --header 'Authorization: Bearer theuthorizationtokenhere' \
  --header 'Approov-Token: APPROOV_TOKEN_EXAMPLE_HERE'
```

The request should pass through the worker and respond with the result from the target API. For example:

```text
HTTP/2 200

...

{
  "form": "Sphere"
}
```

#### With Invalid Approov Tokens

##### No Authorization Token

Let's just remove the Authorization header from the request:

```
curl -i --request GET 'https://your.api.domain.com/v1/shapes' \
  --header 'Approov-Token: APPROOV_TOKEN_EXAMPLE_HERE'
```

The above request should fail with an Unauthorized error generated by the deployed worker:

```text
HTTP/2 401

...

{"error":"Unauthorized request."}
```

##### Same Approov Token with a Different Authorization Token

Make the request with the same generated token, but with another random authorization token:

```
curl -i --request GET 'https://your.api.domain.com/v1/shapes' \
  --header 'Authorization: Bearer differentrandomauthorizationtoken' \
  --header 'Approov-Token: APPROOV_TOKEN_EXAMPLE_HERE'
```

The above request should also fail with an Unauthorized error generated by the deployed worker:

```text
HTTP/2 401

...

{"error":"Unauthorized request."}
```
