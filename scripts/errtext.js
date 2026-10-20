// Pulls every readable string out of an ethers / Ganache error.
//
// Why: Ganache reports a revert as { message: "VM Exception ... revert <reason>",
// data: { result: "0x08c379a0...", reason: "<reason>" } }. ethers v6 can't read
// that shape, so it says "missing revert data" and keeps the real message deeper
// inside the error object (error.info.error.message). This walks the whole error.

// Decode a standard Error(string) revert payload: 0x08c379a0 + ABI-encoded string
function decodeRevertHex(h) {
  try {
    if (typeof h !== "string" || !/^0x08c379a0([0-9a-fA-F]{2})+$/.test(h)) return null;
    const body = h.slice(10);
    const len = parseInt(body.slice(64, 128), 16);
    const strHex = body.slice(128, 128 + len * 2);
    const bytes = new Uint8Array(strHex.match(/../g).map((x) => parseInt(x, 16)));
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return null;
  }
}

function errorText(e) {
  const seen = new Set();
  const out = [];
  const KEYS = ["reason", "shortMessage", "message", "data", "error", "info", "result", "revert", "args"];
  (function walk(v, depth) {
    if (v == null || depth > 6) return;
    if (typeof v === "string") {
      out.push(v);
      const decoded = decodeRevertHex(v);
      if (decoded) out.push(decoded);
      return;
    }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    for (const k of KEYS) {
      try {
        if (v[k] !== undefined) walk(v[k], depth + 1);
      } catch (_) { /* ignore getters that throw */ }
    }
  })(e, 0);
  return out.join(" | ");
}

module.exports = { errorText, decodeRevertHex };
