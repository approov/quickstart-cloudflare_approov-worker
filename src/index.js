import jwt from '@tsndr/cloudflare-worker-jwt'

// Establish context from environmental settings.
const establishContext = (env) => {
  const approovSecretRaw = env.APPROOV_SECRET_BASE64.trim(); // Trim any whitespace
  let approovSecret;

  if (approovSecretRaw.includes('PUBLIC KEY')) {
    // Treat as PEM public key and strip header/footer
    approovSecret = approovSecretRaw
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\n/g, '') // Remove newlines
      .trim();
  } else {
    // Treat as Base64-encoded HMAC secret key
    approovSecret = atob(approovSecretRaw);
  }

  const ctx = {
    approovSecret,
    approovTokenHeaderName: env.APPROOV_TOKEN_HEADER_NAME || 'Approov-Token',
    approovBindingHeaderName: env.APPROOV_BINDING_HEADER_NAME || 'Authorization',
    approovBindingClaimName: 'pay',
    approovBindingVerification: env.APPROOV_VERIFICATION_STRATEGY === 'token-binding' || false,
    apiHost: env.API_DOMAIN,
    isValid: !!(approovSecret && env.API_DOMAIN),
  };

  return ctx;
};

// Extract Approov token string from request headers.
const extractToken = (ctx, request) => {
  return request.headers.get(ctx.approovTokenHeaderName);
};

// Validate Approov token is properly signed and not expired.
const validateToken = async (ctx, token) => {
  if (!ctx || !token) return false;

  // Decode token to get header
  const { header } = jwt.decode(token);
  if (!header || !header.alg) return false;

  // Supported algorithms
  const allowedAlgorithms = ['ES256', 'ES384', 'ES512', 'HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'];
  const algorithm = header.alg;

  if (!allowedAlgorithms.includes(algorithm)) {
    console.error(`AUTH FAILURE: Unsupported JWT algorithm: ${algorithm}`);
    return false;
  }

  const options = { algorithm, throwError: false };

  return await jwt.verify(token, ctx.approovSecret, options);
};

// Extract Approov binding string from request headers.
const extractBinding = (ctx, request) => {
  return request.headers.get(ctx.approovBindingHeaderName);
};

// Validate token payload has expected binding hash.
const validateBinding = async (ctx, token, binding) => {
  if (!ctx || !token || !binding) return false;

  // Hash binding string to array buffer
  const encoder = new TextEncoder();
  const data = encoder.encode(binding);
  const buffer = await crypto.subtle.digest('SHA-256', data);

  // Convert array buffer to base64 string
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const hash = btoa(binary);

  // Extract claim from token payload
  const { payload } = jwt.decode(token);
  const claim = payload ? payload[ctx.approovBindingClaimName] : null;
  if (!claim) return false;

  return claim === hash;
};

// Handle request.
const handleRequest = async (request, env) => {
  // Establish context
  const ctx = establishContext(env);
  if (!ctx.isValid) {
    console.error(`CONTEXT ERROR: Unable to establish context; check environmental values and secrets`);
    return new Response('internal server error', { status: 500 });
  }

  // Validate Approov token
  const approovToken = extractToken(ctx, request);
  if (!approovToken) {
    console.error(`AUTH FAILURE: Approov token not found`);
    return new Response('unauthorized', { status: 401 });
  }

  let isAuthorized = await validateToken(ctx, approovToken);
  if (!isAuthorized) {
    console.error(`AUTH FAILURE: Approov token expired or not properly signed`);
    return new Response('unauthorized', { status: 401 });
  }

  // If binding strategy, validate Approov binding
  if (ctx.approovBindingVerification) {
    const approovBinding = extractBinding(ctx, request);
    isAuthorized = await validateBinding(ctx, approovToken, approovBinding);
    if (!isAuthorized) {
      console.error(`AUTH FAILURE: Approov token binding missing or invalid`);
      return new Response('unauthorized', { status: 401 });
    }
  }

  // Forward request to API (without modifying headers)
  return fetch(request);
};

// Export the fetch handler to be used by the Cloudflare worker.
export default {
  async fetch(request, env) {
    return await handleRequest(request, env);
  },
};
