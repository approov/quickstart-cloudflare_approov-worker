const jwt = require("jsonwebtoken");

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
  const token = event.request.headers.get('Approov-Token');

  try {
    jwt.verify(token, Buffer.from(APPROOV_BASE64_SECRET, 'base64'), {algorithms: ['HS256'], ignoreExpiration: false});

    // Token is good!
    return await fetch(event.request)

  } catch(error) {

    // Delays while logging to your target will not affect the original request.
    event.waitUntil(log(error, event.request, token))

    // Token failed validation or is missing in the request
    return new Response(jsonErrorResponse(error, event.request), { headers: { 'content-type': 'application/json' }, status: 401 })
  }
}

function log(error, request, token) {
  if (typeof APPROOV_LOGGING_ENABLED !== 'undefined' && APPROOV_LOGGING_ENABLED === 'true') {
    const ip = request.headers.get('cf-connecting-ip') || 'Unknown';
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const requestMethod = request.method || 'Unknown';
    const requestUrl = request.url || 'Unknown';
    const safeToken = token || 'Unknown';
    const error_message = error.message || 'Unknown'
    const message = "[" + ip + "] " + requestMethod + " " + requestUrl + " [UA: " + userAgent + "] [JWT: " + safeToken + "] [ERRROR: " + error_message + "]"

    // If you want access to the logs you need to use the command `wrangler tail`
    // to see them in real-time from your computer or send you need to add code in
    // here to send the log message to your preferred cloud based logging
    // framework.
    //
    // Check the `Useful Links` section in the README for more info on the logging
    // approaches.
    console.log(message)
  }
}

function jsonErrorResponse(error, request) {
  let ALLOWED_IPS = []

  if (typeof IP_DEBUG_WHITELIST !== 'undefined') {
    ALLOWED_IPS = IP_DEBUG_WHITELIST.split(',')
  }

  if (ALLOWED_IPS.indexOf(request.headers.get('cf-connecting-ip')) >= 0) {
    const debug = {
      allowed_ips: ALLOWED_IPS,
      headers: [...request.headers]
    }

    return JSON.stringify({ error: error, debug: debug })
  }

  return JSON.stringify({ error: "Unauthorized request."})
}
