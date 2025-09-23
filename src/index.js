// node_modules/@tsndr/cloudflare-worker-jwt/index.js
function bytesToByteString(bytes) {
   let byteStr = "";
   for (let i = 0; i < bytes.byteLength; i++) {
     byteStr += String.fromCharCode(bytes[i]);
   }
   return byteStr;
 }
 function byteStringToBytes(byteStr) {
   let bytes = new Uint8Array(byteStr.length);
   for (let i = 0; i < byteStr.length; i++) {
     bytes[i] = byteStr.charCodeAt(i);
   }
   return bytes;
 }
 function arrayBufferToBase64String(arrayBuffer) {
   return btoa(bytesToByteString(new Uint8Array(arrayBuffer)));
 }
 function base64StringToUint8Array(b64str) {
   return byteStringToBytes(atob(b64str));
 }
 function textToUint8Array(str) {
   return byteStringToBytes(str);
 }
 function arrayBufferToBase64Url(arrayBuffer) {
   return arrayBufferToBase64String(arrayBuffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
 }
 function base64UrlToUint8Array(b64url) {
   return base64StringToUint8Array(b64url.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
 }
 function textToBase64Url(str) {
   const encoder = new TextEncoder();
   const charCodes = encoder.encode(str);
   const binaryStr = String.fromCharCode(...charCodes);
   return btoa(binaryStr).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
 }
 function pemToBinary(pem) {
   return base64StringToUint8Array(pem.replace(/-+(BEGIN|END).*/g, "").replace(/\s/g, ""));
 }
 async function importTextSecret(key, algorithm, keyUsages) {
   return await crypto.subtle.importKey("raw", textToUint8Array(key), algorithm, true, keyUsages);
 }
 async function importJwk(key, algorithm, keyUsages) {
   return await crypto.subtle.importKey("jwk", key, algorithm, true, keyUsages);
 }
 async function importPublicKey(key, algorithm, keyUsages) {
   return await crypto.subtle.importKey("spki", pemToBinary(key), algorithm, true, keyUsages);
 }
 async function importPrivateKey(key, algorithm, keyUsages) {
   return await crypto.subtle.importKey("pkcs8", pemToBinary(key), algorithm, true, keyUsages);
 }
 async function importKey(key, algorithm, keyUsages) {
   if (typeof key === "object")
     return importJwk(key, algorithm, keyUsages);
   if (typeof key !== "string")
     throw new Error("Unsupported key type!");
   if (key.includes("PUBLIC"))
     return importPublicKey(key, algorithm, keyUsages);
   if (key.includes("PRIVATE"))
     return importPrivateKey(key, algorithm, keyUsages);
   return importTextSecret(key, algorithm, keyUsages);
 }
 function decodePayload(raw) {
   try {
     const bytes = Array.from(atob(raw), (char) => char.charCodeAt(0));
     const decodedString = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
     return JSON.parse(decodedString);
   } catch {
     return;
   }
 }
if (typeof crypto === "undefined" || !crypto.subtle)
  throw new Error("SubtleCrypto not supported!");
var algorithms = {
  ES256: { name: "ECDSA", namedCurve: "P-256", hash: { name: "SHA-256" } },
  HS256: { name: "HMAC", hash: { name: "SHA-256" } }
};
async function sign(payload, secret, options = "HS256") {
  if (typeof options === "string")
    options = { algorithm: options };
  options = { algorithm: "HS256", header: { typ: "JWT", ...options.header ?? {} }, ...options };
  if (!payload || typeof payload !== "object")
    throw new Error("payload must be an object");
  if (!secret || (typeof secret !== "string" && typeof secret !== "object"))
    throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof options.algorithm !== "string")
    throw new Error("options.algorithm must be a string");
  if (!(options.algorithm === "HS256" || options.algorithm === "ES256"))
    throw new Error("Only HS256 and ES256 algorithms are supported");
  const algorithm = algorithms[options.algorithm];
  if (!algorithm)
    throw new Error("algorithm not found");
  if (!payload.iat)
    payload.iat = Math.floor(Date.now() / 1e3);
  const partialToken = `${textToBase64Url(JSON.stringify({ ...options.header, alg: options.algorithm }))}.${textToBase64Url(JSON.stringify(payload))}`;
  const key = secret instanceof CryptoKey ? secret : await importKey(secret, algorithm, ["sign"]);
  const signature = await crypto.subtle.sign(algorithm, key, textToUint8Array(partialToken));
  return `${partialToken}.${arrayBufferToBase64Url(signature)}`;
}
async function verify(token, secret, options = "HS256") {
  if (typeof options === "string")
    options = { algorithm: options };
  options = { algorithm: "HS256", clockTolerance: 0, throwError: false, ...options };
  if (typeof token !== "string")
    throw new Error("token must be a string");
  if (typeof secret !== "string" && typeof secret !== "object")
    throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof options.algorithm !== "string")
    throw new Error("options.algorithm must be a string");
  if (!(options.algorithm === "HS256" || options.algorithm === "ES256"))
    throw new Error("Only HS256 and ES256 algorithms are supported");
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3)
    throw new Error("token must consist of 3 parts");
  const algorithm = algorithms[options.algorithm];
  if (!algorithm)
    throw new Error("algorithm not found");
  const decodedToken = decode(token);
  try {
    if (decodedToken.header?.alg !== options.algorithm)
      throw new Error("INVALID_SIGNATURE");
    if (decodedToken.payload) {
      const now = Math.floor(Date.now() / 1e3);
      if (decodedToken.payload.nbf && decodedToken.payload.nbf > now && decodedToken.payload.nbf - now > (options.clockTolerance ?? 0))
        throw new Error("NOT_YET_VALID");
      if (decodedToken.payload.exp && decodedToken.payload.exp <= now && now - decodedToken.payload.exp > (options.clockTolerance ?? 0))
        throw new Error("EXPIRED");
    }
    const key = secret instanceof CryptoKey ? secret : await importKey(secret, algorithm, ["verify"]);
    if (!await crypto.subtle.verify(algorithm, key, base64UrlToUint8Array(tokenParts[2]), textToUint8Array(`${tokenParts[0]}.${tokenParts[1]}`)))
      throw new Error("INVALID_SIGNATURE");
    return decodedToken;
  } catch (err) {
    if (options.throwError)
      throw err;
    return;
  }
}
function decode(token) {
  return {
    header: decodePayload(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")),
    payload: decodePayload(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
  };
}
var index_default = {
  sign,
  verify,
  decode
};

// src/index.js
var establishContext = (env) => {
  const approovSecretRaw = env.APPROOV_SECRET_BASE64.trim();
  let approovSecret;
  if (approovSecretRaw.includes("PUBLIC KEY")) {
    approovSecret = approovSecretRaw.replace(/-----BEGIN PUBLIC KEY-----/g, "").replace(/-----END PUBLIC KEY-----/g, "").replace(/\n/g, "").trim();
  } else {
    // Accept both base64url and standard base64
   let b64 = approovSecretRaw;
   if (/[^A-Za-z0-9+/=]/.test(b64)) {
     // If contains base64url chars, convert to base64
     b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
   }
   b64 = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
   approovSecret = atob(b64);
  }
  const ctx = {
    approovSecret,
    approovTokenHeaderName: env.APPROOV_TOKEN_HEADER_NAME || "Approov-Token",
    approovBindingHeaderName: env.APPROOV_BINDING_HEADER_NAME || "Authorization",
    approovBindingClaimName: "pay",
    approovBindingVerification: env.APPROOV_BINDING_VERIFICATION || false,
    isValid: !!approovSecret
  };
  return ctx;
};
var extractToken = (ctx, request) => {
  return request.headers.get(ctx.approovTokenHeaderName);
};
var validateToken = async (ctx, token) => {
  if (!ctx || !token) return { valid: false, reason: "No context or token" };
  const { header } = index_default.decode(token);
  if (!header || !header.alg) return { valid: false, reason: "No header or alg" };
  const allowedAlgorithms = ["ES256", "HS256"];
  const algorithm = header.alg;
  if (!allowedAlgorithms.includes(algorithm)) {
    return { valid: false, reason: `Unsupported JWT algorithm: ${algorithm}` };
  }
  const options = { algorithm, throwError: true };
  try {
    const result = await index_default.verify(token, ctx.approovSecret, options);
    if (!result) return { valid: false, reason: "Unknown verification failure" };
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: err && err.message ? err.message : String(err) };
  }
};
var extractBinding = (ctx, request) => {
  return request.headers.get(ctx.approovBindingHeaderName);
};
var validateBinding = async (ctx, token, binding) => {
  if (!ctx || !token || !binding) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(binding);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const hash = btoa(binary);
  const { payload } = index_default.decode(token);
  const claim = payload ? payload[ctx.approovBindingClaimName] : null;
  if (!claim) return false;
  return claim === hash;
};
var handleRequest = async (request, env) => {
   // Log the request headers for debugging purposes
   console.log('Request Headers:');
   for (const [key, value] of request.headers.entries()) {
      console.log(`${key}: ${value}`);
   }
  const ctx = establishContext(env);
  if (!ctx.isValid) {
    console.error(`CONTEXT ERROR: Unable to establish context; check environmental values and secrets`);
    return new Response("internal server error", { status: 500 });
  }

  const approovToken = extractToken(ctx, request);
  if (!approovToken) {
    console.error(`AUTH FAILURE: Approov token not found`);
    return new Response("unauthorized", { status: 401 });
  }

  const tokenResult = await validateToken(ctx, approovToken);
  if (!tokenResult.valid) {
    console.error(`AUTH FAILURE: ${tokenResult.reason}`);
    return new Response("unauthorized", { status: 401 });
  }

  if (ctx.approovBindingVerification) {
    const approovBinding = extractBinding(ctx, request);
    isAuthorized = await validateBinding(ctx, approovToken, approovBinding);
    if (!isAuthorized) {
      console.error(`AUTH FAILURE: Approov token binding missing or invalid`);
      return new Response("unauthorized", { status: 401 });
    }
  }

  // Forward the request to the original URL (preserving method, headers, and body)
  // Remove the Approov token header before forwarding
  const url = new URL(request.url);
  // Optionally, you may want to delete the Approov token header (as in original.js)
  const forwardRequest = new Request(url.toString(), request);
  //forwardRequest.headers.delete(ctx.approovTokenHeaderName);

  // Forward the request and return the response
  return fetch(forwardRequest);
};
var index_default2 = {
  async fetch(request, env) {
    return await handleRequest(request, env);
  }
};
export {
  index_default2 as default
};

