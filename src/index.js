// Cloudflare Approov Worker
//
// This worker acts as a reverse proxy in front of an API service. The proxy validates
// an Approov token. If the token is valid, then the API call is authorized, and the worker
// rewrites the API call, submits it to the API service, and returns the response.

import jwt from '@tsndr/cloudflare-worker-jwt'

// Establish context from environmental settings.

const establishContext = (env) => {
  const approovSecretBase64 = env.APPROOV_SECRET_BASE64
  const approovSecret = approovSecretBase64 ? atob(approovSecretBase64) : null
  const approovTokenHeaderName =
    env.APPROOV_TOKEN_HEADER_NAME || 'Approov-Token'
  const approovBindingHeaderName =
    env.APPROOV_BINDING_HEADER_NAME || 'Authorization'
  const approovBindingClaimName = env.APPROOV_BINDING_CLAIM_NAME || 'pay'
  const approovBindingVerification =
    env.APPROOV_VERIFICATION_STRATEGY === 'token-binding' || false

  const apiHost = env.API_DOMAIN

  const ctx = {
    approovSecret,
    approovTokenHeaderName,
    approovBindingHeaderName,
    approovBindingClaimName,
    approovBindingVerification,
    apiHost,
    isValid: !!(approovSecret && apiHost),
  }

  return ctx
}

// Extract Approov token string from request headers.

const extractToken = (ctx, request) => {
  const token = request.headers.get(ctx.approovTokenHeaderName)

  return token
}

// Validate Approov token is properly signed and not expired.

const validateToken = async (ctx, token) => {
  if (!ctx || !token) return false

  const options = { algorithm: 'HS256', throwError: false }

  const isValid = await jwt.verify(token, ctx.approovSecret, options)

  return isValid
}

// Extract Approov binding string from request headers.

const extractBinding = (ctx, request) => {
  const binding = request.headers.get(ctx.approovBindingHeaderName)

  return binding
}

// Validate token payload has expected binding hash.

const validateBinding = async (ctx, token, binding) => {
  if (!ctx || !token || !binding) return false

  // hash binding string to array buffer

  const encoder = new TextEncoder()
  const data = encoder.encode(binding)
  const buffer = await crypto.subtle.digest('SHA-256', data)

  // convert array buffer to base64 string

  var binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const hash = btoa(binary)

  // assume token already validated

  // extract pay claim

  const { payload } = jwt.decode(token)
  const claim = payload ? payload[ctx.approovBindingClaimName] : null
  if (!claim) return false

  // compare claim to hash

  return claim === hash
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

const jsonErrorResponse = (message, status) => {
  return new Response(
    JSON.stringify({ error: message}),
    { headers: { 'content-type': 'application/json' }, status: status }
  )
}

const handleRequest = async (request, env) => {
  // establish context

  const ctx = establishContext(env)
  if (!ctx.isValid) {
    console.error(
      `CONTEXT ERROR: unable to establish context; check environmental values and secrets`
    )
    return jsonErrorResponse('internal server error', 500)


  }

  // validate approov token

  const approovToken = extractToken(ctx, request)
  if (!approovToken) {
    console.error(`AUTH FAILURE: approov token not found`)
    return jsonErrorResponse('unauthorized', 401)
  }

  let isAuthorized = await validateToken(ctx, approovToken)
  if (!isAuthorized) {
    console.error(`AUTH FAILURE: approov token expired or not properly signed`)
    return jsonErrorResponse('unauthorized', 401)
  }

  // if binding strategy, validate approov binding

  if (ctx.approovBindingVerification) {
    const approovBinding = extractBinding(ctx, request)

    isAuthorized = await validateBinding(ctx, approovToken, approovBinding)
    if (!isAuthorized) {
      console.error(`AUTH FAILURE: approov token binding missing or invalid`)
      return jsonErrorResponse('unauthorized', 401)
    }
  }

  // rewrite and submit authorized request

  const apiRequest = rewriteApiRequest(ctx, request)
  const response = await fetch(apiRequest)

  return response
}

// Export the fetch handler to be used by the cloudflare worker.

export default {
  async fetch(request, env) {
    return await handleRequest(request, env)
  },
}
