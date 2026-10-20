// One command to run everything:  npm run demo
//   1. starts an in-process Ganache chain on port 8545
//   2. compiles + deploys the contract and seeds demo products
//   3. starts the website on http://localhost:3000
//
// (Prefer the Ganache desktop app or a separate terminal?  Use the 3-step
//  flow in the README instead: npm run chain / npm run deploy / npm start.)
const { ethers } = require("ethers");
const ganache = require("ganache");
const { deployAll } = require("./deploy");
const { start } = require("../server");

(async () => {
  const port = Number(process.env.GANACHE_PORT || 8545);

  const chain = ganache.server({
    wallet: { deterministic: true }, // same 10 test accounts every run
    chain: { chainId: 1337 },
    logging: { quiet: true },
  });

  try {
    await chain.listen(port);
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use (another Ganache running?).`);
      console.error(`Close it, or run the 3-step flow against it:  RPC_URL=http://127.0.0.1:${port} npm run deploy && npm start`);
    } else {
      console.error("Could not start Ganache:", err.message);
    }
    process.exit(1);
  }
  console.log(`Ganache test chain running on http://127.0.0.1:${port}`);

  process.env.RPC_URL = `http://127.0.0.1:${port}`;
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL, undefined, { batchMaxCount: 1 });

  try {
    await deployAll(provider);
  } catch (err) {
    console.error("Deploy failed:", err.shortMessage || err.message);
    await chain.close();
    process.exit(1);
  }

  start();

  const shutdown = async () => {
    await chain.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
