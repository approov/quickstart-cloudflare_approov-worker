# Approov Token Quickstart

This quickstart is for developers familiar with Cloudflare who are looking for a quick intro into how they can add [Approov](https://approov.io) into an existing project. Therefore this will guide you through the necessary steps for adding Approov to an existing site being routed through Cloudflare.

We strongly advise you to try first this quickstart in a staging environment, and just follow it in a production environment when you understand how Approov works within your Cloudflare deployment. So after you finish testing the Approov integration in your staging environment, just replace all occurrences of `staging` with `production` to deploy the Approov Cloudflare worker into your Cloudflare production infrastructure in order to protect your API with Approov.


## Why?

To lock down your API server to you mobile app, and you can read more about in the [README](/README.md#why) at the root of this repo.


## How it works?

See the overview in the [README](/README.md#how-it-works) at the root of this repo, or just dive into the [jwt-verifier.js](/workers/approov-token/jwt-verifier.js) file, and take a look into the function `handleRequest` to see how simple and easy the Approov token check is done.


## Requirements

In order to to complete this quickstart we will require the Approov and Cloudflare CLI tools to be installed in your system.

### Cloudflare CLI Tool

If not already installed in your system then you can follow the official docs [install instructions](https://developers.cloudflare.com/workers/tooling/wrangler/install/) for wrangler.

### Approov CLI Tool

If you haven't done it already, please follow [these instructions](https://approov.io/docs/latest/approov-installation/#approov-tool) from the Approov docs to download and install the [Approov CLI Tool](https://approov.io/docs/latest/approov-cli-tool-reference/).

Don't forget to export your Approov developer management token:

```text
export APPROOV_MANAGEMENT_TOKEN=$(cat /path/to/development.token)
```

> **NOTE:**
>
> The above export is only valid for the current shell session.
> If you open another shell you need to repeat it.
> Add it to your `.bashrc` file in order to persist it across shell sessions.


## Approov Setup

In order to use Approov with Cloudflare we need to tell Approov what is the API domain being protected. We also need to set in Cloudflare the Approov Base64 encoded secret that will be used to verify the Approov tokens.

### API Domain

Approov needs to know the domain name for the API its authorized to issue valid tokens.

Add it with:

```text
approov api -add your.api.domain.com
```

Now that Approov knows the domain for your API you get [dynamic certificate pinning](https://approov.io/docs/latest/approov-usage-documentation/#approov-dynamic-pinning) out of the box for free.

## Approov Cloudflare Worker

### Wrangler Configuration

A wrangler configuration example can be found at [workers/approov-token/wrangler.example.toml](/workers/approov-token/wrangler.example.toml).

Copy it to `wrangler.toml` and edit the file in order to replace all occurrences of `REPLACE_WITH_YOUR_API_DOMAIN` with the same exact domain you added with `approov api -add your.api.domain.com`.

You can read more about Cloudflare routes configuration [here](https://developers.cloudflare.com/workers/about/routes/).

To bear in mind that the `wrangler.example.toml` file assumes that the Cloudflare env vars `CF_ACCOUNT_ID`, `CF_ZONE_ID` and `CF_API_TOKEN` are set in the host environment.


### Deploy the Approov Worker

To deploy the Approov Cloudflare we will use the Cloudflare official wrangler cli tool.

From the root of `workers/approov-token/` folder run:

```text
wrangler publish --env staging
```

### Approov Secret for the Approov Worker

We need an [Approov secret](https://approov.io/docs/latest/approov-cli-tool-reference/#secret-command) to check the signature in the JWT tokens and we need to use the same one used by the [Approov Cloud service](https://www.approov.io/approov-in-detail.html) to sign the [Approov Tokens](https://www.approov.io/docs/latest/approov-usage-documentation/#approov-tokens) issued to our mobile app.

#### Retrieve the Approov Secret

```text
approov secret /path/to/approov/administration.token -get base64
```

> **NOTE:** The Approov secret requires a management admin token, because the developer management token doesn't have permissions to get the secret.

#### Set the Approov Base64 Secret in Cloudflare

From the root of `workers/approov-token/` folder run:

```text
wrangler secret put --env staging APPROOV_BASE64_SECRET
```

> **NOTE:**: Please bear in mind that you need to create the environment variable `APPROOV_BASE64_SECRET` for each environment you want to run the Approov token worker.


#### View the Secrets in the Cloudfare Dashboard

Now you can visit the Cloudflare Dashboard, select the tab **Workers**, click in the worker name, and then select the tab **Settings** to see the `APPROOV_BASE64_SECRET` listed as an environment variable.


### Test it Works

The following examples use cURL, but you can use instead the [Postman Collection](/README.md#api-requests-with-postman) to make the API requests, just remember that you need to adjust the urls and replace the tokens in the collection or instead you can use the dummy secret used to sign them, just follow the instructions.


#### With Valid Approov Tokens

Generate a valid token example from the Approov Cloud service:

```
approov token -genExample your.api.domain.com
```

Then make the request with the generated token:

```
curl -i --request GET 'https://your.api.domain.com' \
  --header 'Approov-Token: APPROOV_TOKEN_EXAMPLE_HERE'
```

The request must be ok:

```text
HTTP/2 200

...

{
  "shape": "Circle"
}
```

#### With Invalid Approov Tokens

Generate an invalid token example from the Approov Cloud service:

```
approov token -type invalid -genExample your.api.domain.com
```

Then make the request with the generated token:

```
curl -i --request GET 'https://your.api.domain.com' \
  --header 'Approov-Token: APPROOV_INVALID_TOKEN_EXAMPLE_HERE'
```

The response should fail:

```text
HTTP/2 401

...

{"error":"Unauthorized request."}
```
