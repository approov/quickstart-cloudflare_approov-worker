// Cloudflare Approov Worker
//
// This worker acts as a reverse proxy in front of an API service. The proxy validates
// an Approov token. If the token is valid, then the API call is authorized, and the worker
// rewrites the API call, submits it to the API service, and returns the response.

import jwt from '@tsndr/cloudflare-worker-jwt'

// Establish context from environmental settings.

const establishContext = (env) => {
  // console.log(`env: ${JSON.stringify(env)}`)

  const approovSecretBase64 = env.APPROOV_SECRET_BASE64
  const approovSecret = approovSecretBase64 ? atob(approovSecretBase64) : null

  const apiHost = env.API_DOMAIN

  const ctx = {
    approovSecret: approovSecret,
    approovHeaderName: 'Approov-Token',
    apiHost: apiHost,
    isValid: approovSecret && apiHost,
  }

  return ctx
}

// Extract Approov token string from request headers.

const extractToken = (ctx, request) => {
  const token = request.headers.get(ctx.approovHeaderName)

  return token
}

// Validate Approov token is properly signed and not expired.

const validateToken = async (ctx, token) => {
  const options = { algorithm: 'HS256', throwError: false }

  const isValid = await jwt.verify(token, ctx.approovSecret, options)

  return isValid
}

// Rewrite unprotected API request.

const rewriteApiRequest = (ctx, request) => {
  const url = new URL(request.url)
  url.host = ctx.apiHost

  // substitute api host url and delete approov token
  const apiRequest = new Request(url.toString(), request)
  apiRequest.headers.delete(ctx.approovHeaderName)

  return apiRequest
}

// Handle request.

const handleRequest = async (request, env) => {
  // establish context

  const ctx = establishContext(env)
  if (!ctx.isValid) {
    console.error(
      `CONTEXT ERROR: unable to establish context; check environmental values and secrets`
    )
    return new Response('internal server error', { status: 500 })
  }

  // validate approov token

  const approovToken = extractToken(ctx, request)
  if (!approovToken) {
    console.error(`AUTH FAILURE: approov token not found`)
    return new Response('unauthorized', { status: 401 })
  }

  const isAuthorized = await validateToken(ctx, approovToken)
  if (!isAuthorized) {
    console.error(`AUTH FAILURE: approov token expired or not properly signed`)
    return new Response('unauthorized', { status: 401 })
  }

  // rewrite and submit authorized request

  const apiRequest = rewriteApiRequest(ctx, request)
  const response = await fetch(apiRequest)

  // return response

  return response
}

// Export the fetch handler to be used by the cloudflare worker.

export default {
  async fetch(request, env) {
    return await handleRequest(request, env)
  },
}
