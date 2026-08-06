// jwtpeek — zero-dependency JWT decoder.
//
// Decodes a JWT (header.payload.signature) WITHOUT verifying the signature.
// It base64url-decodes the two JSON parts, parses them, and surfaces expiry /
// issued / not-before timing with a human verdict. Signature verification is
// intentionally out of scope: this is an inspection tool, not an auth library.

const JWT_RE = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)$/;

// Decode a base64url segment into a UTF-8 string. Works in Node (Buffer) and
// the browser (atob + TextDecoder).
export function b64urlDecode(segment) {
  let s = String(segment == null ? "" : segment).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return Buffer.from(s, "base64").toString("utf8");
  }
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Decode + parse one segment. Returns { ok, value, raw }.
export function decodeSegment(segment) {
  const raw = b64urlDecode(segment);
  try {
    const value = JSON.parse(raw);
    return { ok: true, value, raw };
  } catch {
    return { ok: false, value: null, raw };
  }
}

function toIso(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  // timestamps may be seconds (JWT) or ms; treat < 1e12 as seconds
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(".000Z", "Z");
}

// Inspect a JWT. `now` is the reference time in ms (defaults to Date.now()).
export function parse(token, now = Date.now()) {
  const s = String(token == null ? "" : token).trim();
  const m = JWT_RE.exec(s);
  if (!m) {
    return { valid: false, error: "not-a-jwt", header: null, payload: null, signature: null, timing: null };
  }

  const header = decodeSegment(m[1]);
  const payload = decodeSegment(m[2]);
  const signature = m[3] || "";

  const p = payload.value || {};
  const exp = typeof p.exp === "number" ? p.exp : null;
  const iat = typeof p.iat === "number" ? p.iat : null;
  const nbf = typeof p.nbf === "number" ? p.nbf : null;

  let status = "no-exp";
  let msUntilExp = null;
  if (exp != null) {
    const expMs = exp < 1e12 ? exp * 1000 : exp;
    msUntilExp = expMs - now;
    status = msUntilExp > 0 ? "valid" : "expired";
  }
  let notYet = false;
  if (nbf != null) {
    const nbfMs = nbf < 1e12 ? nbf * 1000 : nbf;
    notYet = nbfMs > now;
    if (notYet) status = "not-yet";
  }

  const timing = {
    exp,
    expAt: toIso(exp),
    iat,
    iatAt: toIso(iat),
    nbf,
    nbfAt: toIso(nbf),
    status,
    msUntilExp,
    notYet,
    hasExpiry: exp != null,
  };

  return {
    valid: true,
    error: null,
    header: header.value,
    headerParsed: header.ok,
    payload: payload.value,
    payloadParsed: payload.ok,
    signature,
    hasSignature: signature.length > 0,
    claimCount: p && typeof p === "object" ? Object.keys(p).length : 0,
    timing,
  };
}

// CLI / test helper: render a compact, human-readable summary.
export function summarize(token, now = Date.now()) {
  const r = parse(token, now);
  if (!r.valid) return { code: 1, out: "不是合法的 JWT（应为 header.payload.signature 三段 base64url）" };
  const lines = [];
  lines.push(`算法 ${r.header && r.header.alg ? r.header.alg : "?"} · 类型 ${r.header && r.header.typ ? r.header.typ : "?"}`);
  lines.push(`签名 ${r.hasSignature ? "有 (" + r.signature.length + " 字符)" : "无（未签名）"}`);
  lines.push(`声明 ${r.claimCount} 项`);
  const t = r.timing;
  if (t.hasExpiry) {
    const verb = t.status === "expired" ? "已于" : "将于";
    const when = t.expAt;
    lines.push(`过期 ${verb} ${when}${t.status === "expired" ? "（已失效）" : ""}`);
  } else {
    lines.push("过期 无 exp 字段（永不过期）");
  }
  if (t.iatAt) lines.push(`签发于 ${t.iatAt}`);
  if (t.notYet) lines.push(`生效时间 nbf=${t.nbfAt}（尚未生效）`);
  return { code: 0, out: lines.join("\n") };
}
