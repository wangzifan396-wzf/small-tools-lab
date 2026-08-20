(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JwtTrust = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALGORITHMS = {
    HS256: { name: "HMAC", hash: "SHA-256" },
    HS384: { name: "HMAC", hash: "SHA-384" },
    HS512: { name: "HMAC", hash: "SHA-512" },
    RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    PS256: { name: "RSA-PSS", hash: "SHA-256", saltLength: 32 },
    PS384: { name: "RSA-PSS", hash: "SHA-384", saltLength: 48 },
    PS512: { name: "RSA-PSS", hash: "SHA-512", saltLength: 64 },
    ES256: { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" },
    ES384: { name: "ECDSA", namedCurve: "P-384", hash: "SHA-384" },
    ES512: { name: "ECDSA", namedCurve: "P-521", hash: "SHA-512" },
  };
  var SEVERITY = { error: 0, warning: 1, info: 2 };

  function text(value) { return typeof value === "string" ? value : ""; }
  function finding(severity, code, message, detail) { return { severity: severity, code: code, message: message, detail: detail || "" }; }
  function b64urlToBytes(value) {
    var input = text(value).replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input) || input.length % 4 === 1) throw new Error("Invalid base64url data");
    input += "=".repeat((4 - input.length % 4) % 4);
    if (typeof atob === "function") { var binary = atob(input), bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
    return new Uint8Array(Buffer.from(input, "base64"));
  }
  function bytesToB64url(bytes) {
    var binary = ""; for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    var encoded = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeJson(value, label) { var parsed; try { parsed = JSON.parse(new TextDecoder().decode(b64urlToBytes(value))); } catch (error) { throw new Error("Invalid JWT " + label + ": " + error.message); } return parsed; }
  function parseToken(token) {
    var parts = text(token).trim().split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error("A compact JWT must contain header, payload, and signature segments");
    var header = decodeJson(parts[0], "header"), payload = decodeJson(parts[1], "payload");
    if (!header || typeof header !== "object" || Array.isArray(header)) throw new Error("JWT header must be a JSON object");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("JWT payload must be a JSON object");
    return { token: text(token).trim(), parts: parts, header: header, payload: payload, signature: b64urlToBytes(parts[2]), signingInput: parts[0] + "." + parts[1] };
  }
  function parseKeySet(input) {
    var value = input;
    if (typeof value === "string") { try { value = JSON.parse(value); } catch (error) { throw new Error("Invalid JWK or JWKS JSON: " + error.message); } }
    if (!value || typeof value !== "object") throw new Error("JWK input must be a JSON object");
    var keys = Array.isArray(value.keys) ? value.keys : [value];
    if (!keys.length) throw new Error("JWKS contains no keys");
    return keys;
  }
  function selectJwk(header, input) {
    var keys = parseKeySet(input), candidates = keys.filter(function (key) { return key && (!header.kid || key.kid === header.kid) && (!key.use || key.use === "sig") && (!key.alg || key.alg === header.alg); });
    if (!candidates.length) return { key: null, keys: keys, reason: header.kid ? "No signing key matches kid=\"" + header.kid + "\" and alg=\"" + text(header.alg) + "\"" : "No signing key matches alg=\"" + text(header.alg) + "\"" };
    if (candidates.length > 1) return { key: candidates[0], keys: keys, ambiguous: true, reason: "Multiple keys match; selected the first deterministic candidate" };
    return { key: candidates[0], keys: keys, ambiguous: false, reason: "Selected by kid, use, and alg" };
  }
  function auditClaims(payload, options, now) {
    var opts = options || {}, current = Number.isFinite(now) ? now : Math.floor(Date.now() / 1000), skew = Number.isFinite(opts.clockSkew) ? opts.clockSkew : 60, findings = [];
    if (payload.exp === undefined) findings.push(finding("warning", "claims.exp-missing", "Token has no exp claim", "Long-lived bearer tokens are harder to revoke; add a bounded expiry where possible."));
    else if (!Number.isFinite(payload.exp)) findings.push(finding("error", "claims.exp-invalid", "exp must be a numeric Unix timestamp"));
    else if (payload.exp <= current - skew) findings.push(finding("error", "claims.expired", "Token is expired", "exp=" + payload.exp + ", now=" + current));
    else if (payload.exp <= current + skew) findings.push(finding("warning", "claims.expiring", "Token expires within the configured clock-skew window"));
    if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf))) findings.push(finding("error", "claims.nbf-invalid", "nbf must be a numeric Unix timestamp"));
    else if (Number.isFinite(payload.nbf) && payload.nbf > current + skew) findings.push(finding("warning", "claims.not-active", "Token is not active yet", "nbf=" + payload.nbf + ", now=" + current));
    if (payload.iat !== undefined && (!Number.isFinite(payload.iat))) findings.push(finding("warning", "claims.iat-invalid", "iat should be a numeric Unix timestamp"));
    else if (Number.isFinite(payload.iat) && payload.iat > current + skew) findings.push(finding("warning", "claims.issued-future", "iat is in the future", "Check issuer clock synchronization."));
    if (opts.issuer && payload.iss !== opts.issuer) findings.push(finding("error", "claims.issuer-mismatch", "Issuer does not match the expected issuer", "Expected " + opts.issuer + ", received " + text(payload.iss || "<missing>")));
    if (opts.audience) { var audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]; if (audiences.indexOf(opts.audience) < 0) findings.push(finding("error", "claims.audience-mismatch", "Audience does not contain the expected value", "Expected " + opts.audience)); }
    if (!payload.sub) findings.push(finding("info", "claims.subject-missing", "Token has no subject claim"));
    return findings.sort(function (a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.code.localeCompare(b.code); });
  }
  function auditHeader(header) {
    var findings = [], alg = text(header.alg).toUpperCase();
    if (!alg || alg === "NONE") findings.push(finding("error", "header.alg-unsafe", "JWT must use a supported signing algorithm"));
    else if (!ALGORITHMS[alg]) findings.push(finding("error", "header.alg-unsupported", "Unsupported JWT algorithm: " + alg));
    if (!header.kid) findings.push(finding("warning", "header.kid-missing", "Header has no kid; key rotation selection may be ambiguous"));
    if (header.jku || header.x5u) findings.push(finding("warning", "header.remote-key-hint", "Token contains a remote key hint", "Do not fetch jku/x5u automatically without an explicit trust policy."));
    return findings;
  }
  function summarize(report) { var all = (report.headerFindings || []).concat(report.claimFindings || []).concat(report.verificationFindings || []); return { errors: all.filter(function (x) { return x.severity === "error"; }).length, warnings: all.filter(function (x) { return x.severity === "warning"; }).length, info: all.filter(function (x) { return x.severity === "info"; }).length }; }
  function inspect(token, options) { var parsed = parseToken(token); var report = { parsed: parsed, headerFindings: auditHeader(parsed.header), claimFindings: auditClaims(parsed.payload, options, options && options.now), verificationFindings: [] }; report.summary = summarize(report); return report; }
  function cryptoObject() { var value = typeof globalThis !== "undefined" ? globalThis.crypto : null; if (!value || !value.subtle) throw new Error("Web Crypto is unavailable in this context"); return value; }
  function importKey(jwk, alg) {
    var params = ALGORITHMS[alg]; if (!params) throw new Error("Unsupported JWT algorithm: " + alg);
    var usage = ["verify"];
    return cryptoObject().subtle.importKey("jwk", jwk, params, false, usage);
  }
  async function verify(token, keyInput, options) {
    var report = inspect(token, options || {}), parsed = report.parsed, alg = text(parsed.header.alg).toUpperCase();
    if (!ALGORITHMS[alg]) { report.verificationFindings.push(finding("error", "signature.algorithm", "Cannot verify unsupported algorithm")); report.summary = summarize(report); return report; }
    var selection; try { selection = selectJwk(parsed.header, keyInput); } catch (error) { report.verificationFindings.push(finding("error", "key.invalid", error.message)); report.summary = summarize(report); return report; }
    report.key = selection; if (!selection.key) { report.verificationFindings.push(finding("error", "key.not-found", selection.reason)); report.summary = summarize(report); return report; }
    if (selection.ambiguous) report.verificationFindings.push(finding("warning", "key.ambiguous", selection.reason));
    try {
      var params = ALGORITHMS[alg], verifyParams = params.name === "RSA-PSS" ? { name: params.name, saltLength: params.saltLength } : params;
      report.signatureValid = await cryptoObject().subtle.verify(verifyParams, await importKey(selection.key, alg), parsed.signature, new TextEncoder().encode(parsed.signingInput));
      report.verificationFindings.push(finding(report.signatureValid ? "info" : "error", report.signatureValid ? "signature.valid" : "signature.invalid", report.signatureValid ? "Signature verified with selected JWK" : "Signature does not match the selected JWK"));
    } catch (error) { report.verificationFindings.push(finding("error", "signature.error", "Signature verification failed", error.message)); report.signatureValid = false; }
    report.summary = summarize(report); return report;
  }
  function formatMarkdown(report) {
    var lines = ["# JWT Trust report", "", "- Signature: " + (report.signatureValid === undefined ? "not verified" : report.signatureValid ? "valid" : "invalid"), "- Errors: " + report.summary.errors, "- Warnings: " + report.summary.warnings, "- Info: " + report.summary.info, "", "## Findings", ""];
    (report.headerFindings || []).concat(report.claimFindings || [], report.verificationFindings || []).forEach(function (item) { lines.push("- **" + item.severity.toUpperCase() + "** `" + item.code + "` — " + item.message + (item.detail ? " (" + item.detail + ")" : "")); });
    return lines.join("\n") + "\n";
  }
  return { ALGORITHMS: ALGORITHMS, b64urlToBytes: b64urlToBytes, bytesToB64url: bytesToB64url, parseToken: parseToken, parseKeySet: parseKeySet, selectJwk: selectJwk, auditHeader: auditHeader, auditClaims: auditClaims, inspect: inspect, verify: verify, formatMarkdown: formatMarkdown, summarize: summarize };
}));
