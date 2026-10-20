// Tiny web server for the 3brokegirls tracker. No framework needed.
//
//   /                  customer tracking page (public/index.html)
//   /staff.html        staff dashboard (create products, record steps)
//   /labels.html       printable QR hang-tags
//   /rpc               proxy to the Ganache node (so phones only need this one port)
//   /api/qr?text=...   QR code as SVG
//   /api/info          LAN addresses, so the QR codes can point at your Wi-Fi IP
//
// Safety: people on your Wi-Fi get READ-ONLY blockchain access through /rpc.
// Anything that sends transactions is only accepted from the computer running
// this server (Ganache accounts are unlocked and hold fake test ether).
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const getRpcUrl = () => process.env.RPC_URL || "http://127.0.0.1:8545";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// JSON-RPC methods that are safe for anyone on the network
const READ_ONLY = new Set([
  "eth_chainId",
  "net_version",
  "web3_clientVersion",
  "eth_blockNumber",
  "eth_call",
  "eth_getCode",
  "eth_getBalance",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_gasPrice",
]);

const isLoopback = (addr) => addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";

function json(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

function rpcError(res, id, message) {
  // HTTP 200 + JSON-RPC error so the browser library shows our message
  json(res, 200, { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code: -32000, message } });
}

// ------------------------------------------------------------------ /rpc
function handleRpc(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });

  const chunks = [];
  let size = 0;
  req.on("data", (c) => {
    size += c.length;
    if (size > 1_000_000) req.destroy();
    else chunks.push(c);
  });
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return rpcError(res, null, "Invalid JSON-RPC request");
    }
    const calls = Array.isArray(parsed) ? parsed : [parsed];
    const firstId = calls[0] && calls[0].id;

    if (!isLoopback(req.socket.remoteAddress)) {
      const blocked = calls.find((c) => !c || !READ_ONLY.has(c.method));
      if (blocked) {
        return rpcError(res, firstId, "Read-only access: staff actions only work on the computer running this server.");
      }
    }

    const rpcUrl = getRpcUrl();
    const target = new URL(rpcUrl);
    const lib = target.protocol === "https:" ? https : http;
    const upstream = lib.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: (target.pathname || "/") + target.search,
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        upRes.pipe(res);
      }
    );
    upstream.on("error", (err) =>
      rpcError(res, firstId, `Cannot reach the blockchain node at ${rpcUrl} (${err.code || err.message}). Is Ganache running?`)
    );
    upstream.end(body);
  });
}

// ------------------------------------------------------------------ /api
function lanUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) urls.push(`http://${ni.address}:${PORT}`);
    }
  }
  return urls;
}

function handleQr(req, res, url) {
  const text = url.searchParams.get("text") || "";
  if (!/^https?:\/\//i.test(text) || text.length > 300) {
    return json(res, 400, { error: "text must be an http(s) URL under 300 characters" });
  }
  let QRCode;
  try {
    QRCode = require("qrcode");
  } catch {
    return json(res, 500, { error: "The 'qrcode' package is missing. Run: npm install" });
  }
  QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#3b2a33", light: "#ffffff" },
  })
    .then((svg) => {
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" });
      res.end(svg);
    })
    .catch((err) => json(res, 500, { error: String(err.message || err) }));
}

// ---------------------------------------------------------------- static
function findEthersBundle() {
  const dir = path.join(__dirname, "node_modules", "ethers", "dist");
  for (const name of ["ethers.umd.min.js", "ethers.umd.js"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: "Not found" });
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(data);
  });
}

function handleStatic(req, res, pathname) {
  if (pathname === "/vendor/ethers.js") {
    const bundle = findEthersBundle();
    if (!bundle) {
      res.writeHead(500, { "content-type": "application/javascript" });
      return res.end('document.addEventListener("DOMContentLoaded",()=>{document.body.insertAdjacentHTML("afterbegin","<p style=\\"padding:12px;background:#fdd\\">ethers.js not found. Run <b>npm install</b> in the project folder.</p>")});');
    }
    return sendFile(res, bundle);
  }

  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return json(res, 400, { error: "Bad URL" });
  }
  if (rel.endsWith("/")) rel += "index.html";
  if (!path.extname(rel)) rel += ".html"; // /staff -> /staff.html

  const file = path.resolve(PUBLIC_DIR, "." + rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return json(res, 403, { error: "Forbidden" });
  sendFile(res, file);
}

// ---------------------------------------------------------------- router
function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/rpc") return handleRpc(req, res);
  if (url.pathname === "/api/qr") return handleQr(req, res, url);
  if (url.pathname === "/api/info") return json(res, 200, { port: PORT, lan: lanUrls() });
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed" });
  return handleStatic(req, res, url.pathname);
}

function pingChain() {
  const target = new URL(getRpcUrl());
  const lib = target.protocol === "https:" ? https : http;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
  const r = lib.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname || "/",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
    },
    (up) => up.resume()
  );
  r.on("error", () =>
    console.warn(`\n  ! No blockchain node found at ${getRpcUrl()}. Start Ganache first (npm run chain), then npm run deploy.\n`)
  );
  r.end(body);
}

function start() {
  const server = http.createServer(handler);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Try:  PORT=3001 npm start`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log("\n  3brokegirls tracker is running\n");
    console.log(`  Customer page : http://localhost:${PORT}`);
    console.log(`  Staff panel   : http://localhost:${PORT}/staff.html`);
    console.log(`  QR hang-tags  : http://localhost:${PORT}/labels.html`);
    const lan = lanUrls();
    if (lan.length) console.log(`  On your Wi-Fi : ${lan.join("   ")}   (open on a phone to test scanning)`);
    console.log("");
    pingChain();
  });
  return server;
}

module.exports = { start, handler };

if (require.main === module) start();
