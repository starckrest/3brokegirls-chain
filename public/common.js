/* 3brokegirls - shared browser code. Talks to the contract through ethers.js.
   Exposes one global: BG */
(function () {
  "use strict";

  const STAGES = [
    { key: "Crafted", label: "Crocheted", icon: "\u{1F9F6}", by: "Maker", line: "Made by hand at the studio" },
    { key: "Packed", label: "Packed", icon: "\u{1F4E6}", by: "Maker", line: "Tagged and boxed up" },
    { key: "Shipped", label: "Shipped", icon: "\u{1F69A}", by: "Distributor", line: "Picked up by the courier" },
    { key: "AtHub", label: "At the hub", icon: "\u{1F3EC}", by: "Distributor", line: "Stored at the sorting hub" },
    { key: "OnShelf", label: "On the shelf", icon: "\u{1F6CD}️", by: "Retailer", line: "Received by the shop" },
    { key: "Sold", label: "Sold", icon: "\u{1F49D}", by: "Retailer", line: "Handed to its new owner" },
  ];
  const ROLES = ["None", "Maker", "Distributor", "Retailer"];

  // ---------------------------------------------------------------- helpers
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  const fmtDate = (unixSeconds) =>
    new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    });

  // Result objects from ethers: read by name, fall back to position
  const get = (r, name, i) => {
    try {
      const v = r[name];
      if (v !== undefined) return v;
    } catch (_) { /* fall through */ }
    return r[i];
  };

  const normProduct = (p) => ({
    id: Number(get(p, "id", 0)),
    name: get(p, "name", 1),
    category: get(p, "category", 2),
    batchCode: get(p, "batchCode", 3),
    materials: get(p, "materials", 4),
    maker: get(p, "maker", 5),
    stage: Number(get(p, "stage", 6)),
    createdAt: Number(get(p, "createdAt", 7)),
  });

  const normCheckpoint = (c) => ({
    stage: Number(get(c, "stage", 0)),
    actor: get(c, "actor", 1),
    role: Number(get(c, "actorRole", 2)),
    location: get(c, "location", 3),
    note: get(c, "note", 4),
    timestamp: Number(get(c, "timestamp", 5)),
  });

  // Messages the contract can send back, so people see plain sentences
  const KNOWN_REVERTS = [
    "Only a registered Maker can create products",
    "Product needs a name",
    "Already sold to a customer",
    "Steps must happen in order",
    "Your role cannot record this step",
    "Only this piece's maker can record this step",
    "Only the owner can do this",
    "Unknown product ID",
  ];

  // Decode a standard Error(string) revert payload (0x08c379a0 + ABI-encoded string)
  function decodeRevertHex(h) {
    try {
      if (typeof h !== "string" || !/^0x08c379a0([0-9a-fA-F]{2})+$/.test(h)) return null;
      const body = h.slice(10);
      const len = parseInt(body.slice(64, 128), 16);
      const bytes = new Uint8Array(body.slice(128, 128 + len * 2).match(/../g).map((x) => parseInt(x, 16)));
      return new TextDecoder().decode(bytes);
    } catch (_) {
      return null;
    }
  }

  // ethers v6 can't read Ganache's revert format and reports "missing revert data",
  // but the real message sits deeper in the error. Collect every string we can find.
  function errorText(e) {
    const seen = new Set();
    const out = [];
    const KEYS = ["reason", "shortMessage", "message", "data", "error", "info", "result", "revert", "args"];
    (function walk(v, depth) {
      if (v == null || depth > 6) return;
      if (typeof v === "string") {
        out.push(v);
        const d = decodeRevertHex(v);
        if (d) out.push(d);
        return;
      }
      if (typeof v !== "object" || seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
      for (const k of KEYS) {
        try { if (v[k] !== undefined) walk(v[k], depth + 1); } catch (_) { /* ignore */ }
      }
    })(e, 0);
    return out.join(" | ");
  }

  function errMsg(e) {
    const blob = errorText(e);
    for (const m of KNOWN_REVERTS) if (blob.includes(m)) return m + ".";
    if (/user rejected|denied/i.test(blob)) return "The transaction was cancelled.";
    if (blob.includes("Read-only access")) return "Staff actions only work on the computer running the server.";
    return (e && (e.shortMessage || e.reason || e.message)) || "Something went wrong.";
  }

  function initProblem(e) {
    switch (e && e.message) {
      case "NO_CONFIG":
        return "This site isn't connected to a blockchain yet. In the project folder, run npm run demo (or npm run deploy), then reload.";
      case "NO_CHAIN":
        return "Can't reach the blockchain. Check that Ganache and the server are running (npm run demo), then reload.";
      case "NO_CONTRACT":
        return "The contract isn't on this chain any more, which usually means Ganache was restarted. Run npm run deploy again, then reload.";
      default:
        return errMsg(e);
    }
  }

  // ------------------------------------------------------------ connection
  let ctx = null;
  async function init() {
    if (ctx) return ctx;
    let cfg;
    try {
      const r = await fetch("/config.json", { cache: "no-store" });
      if (!r.ok) throw new Error("missing");
      cfg = await r.json();
    } catch (_) {
      throw new Error("NO_CONFIG");
    }
    const provider = new ethers.JsonRpcProvider(location.origin + "/rpc", cfg.chainId, {
      staticNetwork: true,
      batchMaxCount: 1,
    });
    let code;
    try {
      code = await provider.getCode(cfg.address);
    } catch (_) {
      throw new Error("NO_CHAIN");
    }
    if (!code || code === "0x") throw new Error("NO_CONTRACT");
    const contract = new ethers.Contract(cfg.address, cfg.abi, provider);
    ctx = { cfg, provider, contract };
    return ctx;
  }

  async function getPiece(id) {
    const { contract } = await init();
    const count = Number(await contract.productCount());
    if (!Number.isInteger(id) || id < 1 || id > count) return null;
    const [p, h] = await Promise.all([contract.getProduct(id), contract.getHistory(id)]);
    return { product: normProduct(p), history: Array.from(h, (c) => normCheckpoint(c)), count };
  }

  async function listPieces() {
    const { contract } = await init();
    const count = Number(await contract.productCount());
    const ids = [];
    for (let i = count; i >= 1; i--) ids.push(i);
    const rows = await Promise.all(ids.map((i) => contract.getProduct(i)));
    return rows.map(normProduct);
  }

  window.BG = { STAGES, ROLES, esc, short, fmtDate, errMsg, initProblem, init, getPiece, listPieces };
})();
