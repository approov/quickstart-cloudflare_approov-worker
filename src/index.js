import jwt from '@tsndr/cloudflare-worker-jwt'
import { verifyDigestHeader, parseRequestSignature, verifyParsedSignature } from '@misskey-dev/node-http-message-signatures';


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
    approovBindingVerification: env.APPROOV_BINDING_VERIFICATION || false,
    httpMessageSign: env.HTTP_MESSAGE_SIGN || false,  
    isValid: !!(approovSecret),
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

// verifyHTTPSig verifies the signature of an HTTP message using the public key provided.
//
// request: the Cloudflare Worker Request object
// publicKey: the public key to use for verification (the message signing secret from the Approov account for account
//     message signing or the public key from the Approov token for device message signing)
// return: an object with the following properties:
//     valid: a boolean indicating whether the signature is valid or not
//     status: a string with the status of the verification
const verifyHTTPSig = async (request, publicKey, requestBody) => {
  console.log('>>> Check HTTP message signature <<<');

  // Convert the EC256 public key from base64 encoded ASN.1 DER to PEM format
  const publicKeyBinary = atob(publicKey); // Decode base64 to binary string
  const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyBinary.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
  console.log(`Public Key PEM: ${publicKeyPEM}`);

  // Check the digest header if it exists
  const contentDigest = request.headers.get('content-digest') || request.headers.get('digest');
  if (contentDigest) {
    console.log(`Content Digest Header: ${contentDigest}`);
    const digestVerified = await verifyDigestHeader(
      { headers: Object.fromEntries(request.headers) }, // Convert headers to a plain object
      requestBody,
      true,
      (...args) => console.log(args.map(arg => JSON.stringify(arg)).join(' '))
    );
    if (!digestVerified) {
      return { valid: false, status: 'invalid digest header' };
    }
  }

  // Check the signature
  let parsedSignature = null;
  try {
    parsedSignature = parseRequestSignature({ headers: Object.fromEntries(request.headers) });
    console.log(`Parsed Signature: ${JSON.stringify(parsedSignature, null, 2)}`);
  } catch (error) {
    console.error(`Malformed message signature: ${error}`);
    console.error(`Request Headers: ${JSON.stringify(Object.fromEntries(request.headers), null, 2)}`);
    return { valid: false, status: 'malformed message signature' };
  }

  // Verify the signature
  try {
    const signatureVerified = await verifyParsedSignature(parsedSignature, publicKeyPEM, (...args) => console.log(args));
    if (!signatureVerified) {
      console.error(`Request Headers: ${JSON.stringify(Object.fromEntries(request.headers), null, 2)}`);
      return { valid: false, status: 'invalid message signature' };
    }
  } catch (error) {
    console.error(`Message signature error: ${error}`);
    console.error(`Request Headers: ${JSON.stringify(Object.fromEntries(request.headers), null, 2)}`);
    return { valid: false, status: 'message signature error' };
  }

  return { valid: true, status: 'valid HTTP message signature' };
};

// Handle request.
const handleRequest = async (request, env) => {
  // Read the request body once in handleRequest
  const requestBody = await request.text();
  // We must reject empty request bodies
  if (!requestBody) {
    console.error('AUTH FAILURE: Request body is empty');
    return new Response('unauthorized', { status: 401 });
}
  // Establish context
  const ctx = establishContext(env);
  if (!ctx.isValid) {
    console.error(`CONTEXT ERROR: Unable to establish context; check environmental values and secrets`);
    return new Response('internal server error', { status: 500 });
  }
  // Log request details
  console.log(`Request Method: ${request.method}, URL: ${request.url}`);
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

  // If token binding is mandatory, validate Approov binding
  if (ctx.approovBindingVerification) {
    const approovBinding = extractBinding(ctx, request);
    isAuthorized = await validateBinding(ctx, approovToken, approovBinding);
    if (!isAuthorized) {
      console.error(`AUTH FAILURE: Approov token binding missing or invalid`);
      return new Response('unauthorized', { status: 401 });
    }
  }

  // If HTTP message signing is enabled, validate the signature
  if (ctx.httpMessageSign) {
    const signature = request.headers.get('sig');
    if (!signature) {
      console.error(`AUTH FAILURE: Signature header missing`);
      return new Response('unauthorized', { status: 401 });
    }
    // Check whether the Approov token contains an installation public key (ipk) claim. If it does, we use this to verify
    // the HTTP signature. If it does not, for this example we reject the request. TODO: Implement account message signature
    // since this can be used instead of the per device signature (ipk) claim.

    // We have validated the token already so we need to decode it to get the payload
    const { payload } = jwt.decode(approovToken);
    if (!payload || !payload.ipk) {
      console.error(`AUTH FAILURE: Missing ipk claim in Approov token`);
      return new Response('unauthorized', { status: 401 });
    }
    const ipk = payload.ipk;
    // Verify the signature using the public key
    const httpSigResult = await verifyHTTPSig(request, ipk, requestBody);
    if (!httpSigResult.valid) {
      console.error(`AUTH FAILURE: ${httpSigResult.status}`);
      return new Response('unauthorized', { status: 401 });
    }
  }
  // Log success
  console.log(`AUTH SUCCESS: Approov token verified successfully`);
  if (ctx.approovBindingVerification) {
    console.log(`AUTH SUCCESS: Approov token binding verified successfully`);
  }
  if (ctx.httpMessageSign) {
    console.log(`AUTH SUCCESS: HTTP message signature verified successfully`);
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
