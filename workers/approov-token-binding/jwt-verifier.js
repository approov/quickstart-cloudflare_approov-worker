const jwt = require("jsonwebtoken");
const crypto = require('crypto')

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
  let token_payload
  const token = event.request.headers.get('Approov-Token');

  try {
    token_payload = jwt.verify(token, Buffer.from(APPROOV_BASE64_SECRET, 'base64'), {algorithms: ['HS256'], ignoreExpiration: false});

    const result = handleApproovTokenBindingCheck(event.request, token_payload)

    event.waitUntil(log(result, event.request, token))

    // Token is good!
    return await fetch(event.request)

  } catch(error) {

    // Delays while logging to your target will not affect the original request.
    event.waitUntil(log(error, event.request, token))

    // Token failed validation or is missing in the request
    return new Response(jsonErrorResponse(error, event.request, token_payload), { headers: { 'content-type': 'application/json' }, status: 401 })
  }
}

function ApproovTokenBindingException(message) {
   this.message = message;
   this.name = 'ApproovTokenBindingException';
}

function ApproovTokenBindingResult(message) {
   this.message = message;
   this.name = 'ApproovTokenBindingResult';
}

function handleApproovTokenBindingCheck(request, token_payload) {

  let token_binding_header
  const token_binding = token_payload.pay

  if (token_binding === undefined) {
    return new ApproovTokenBindingResult("Approov token payload is missing the key 'pay'.")
  }

  if (isEmptyString(token_binding)) {
    return new ApproovTokenBindingResult("Approov token payload key 'pay' is empty.")
  }

  // We default to the Authorization token, but feel free to use another header
  // and bind it to the Approov token in the mobile app.
  if (typeof TOKEN_BINDING_HEADER_NAME === 'undefined') {
    token_binding_header = request.headers.get('Authorization')
  } else {
    token_binding_header = request.headers.get(TOKEN_BINDING_HEADER_NAME)
  }

  if (isEmptyString(token_binding_header)) {
    throw new ApproovTokenBindingException("Missing or empty header to perform the verification for the Approov token binding.")
  }

  // We need to hash and base64 encode the token binding header, because that's how it was included in the Approov
  // token on the mobile app.
  const token_binding_header_encoded = crypto.createHash('sha256').update(token_binding_header, 'utf-8').digest('base64')

  if (token_binding !== token_binding_header_encoded) {
    throw new ApproovTokenBindingException("Approov token binding not matching.")
  }

  return "Aprroov token binding matches."
}

function log(result, request, token) {
  const ip = request.headers.get('cf-connecting-ip') || 'Unknown';
  const userAgent = request.headers.get('User-Agent') || 'Unknown';
  const requestMethod = request.method || 'Unknown';
  const requestUrl = request.url || 'Unknown';
  const safeToken = token || 'Unknown';
  const result_message = result.message || 'Unknown'
  const message = "[" + ip + "] " + requestMethod + " " + requestUrl + " [UA: " + userAgent + "] [JWT: " + safeToken + "] [RESULT: " + result_message + "]"

  // If you want access to the logs you need to use the command `wrangler tail`
  // to see them in real-time from your computer or send you need to add code in
  // here to send the log message to your preferred cloud based logging
  // framework.
  //
  // Check the `Useful Links` section in the README for more info on the logging
  // approaches.
  console.log(message)
}

function jsonErrorResponse(error, request, token_payload) {
  let ALLOWED_IPS = []

  if (typeof IP_DEBUG_WHITELIST !== 'undefined') {
    ALLOWED_IPS = IP_DEBUG_WHITELIST.split(',')
  }

  if (ALLOWED_IPS.indexOf(request.headers.get('cf-connecting-ip')) >= 0) {
    const debug = {
      allowed_ips: ALLOWED_IPS,
      token_payload: token_payload,
      headers: [...request.headers]
    }

    return JSON.stringify({ error: error, debug: debug })
  }

  return JSON.stringify({ error: "Unauthorized request."})
}

function isEmpty(value) {
  return  (value === undefined) || (value === null) || (value === '')
}

function isString(value) {
  return (typeof(value) === 'string')
}

function isEmptyString(value) {
  return (isEmpty(value) === true) || (isString(value) === false) ||  (value.trim() === '')
}
