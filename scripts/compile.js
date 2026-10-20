// Compiles contracts/CrochetSupplyChain.sol with solc-js and writes
// build/CrochetSupplyChain.json  ({ abi, bytecode })
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "contracts", "CrochetSupplyChain.sol");
const OUT_DIR = path.join(ROOT, "build");
const OUT = path.join(OUT_DIR, "CrochetSupplyChain.json");

function compile() {
  const source = fs.readFileSync(SRC, "utf8");

  const input = {
    language: "Solidity",
    sources: { "CrochetSupplyChain.sol": { content: source } },
    settings: {
      // "paris" = no PUSH0, so it runs on every Ganache version
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const problems = output.errors || [];
  const fatal = problems.filter((e) => e.severity === "error");
  problems
    .filter((e) => e.severity !== "error")
    .forEach((e) => console.warn("solc warning:", e.formattedMessage.trim()));
  if (fatal.length) {
    fatal.forEach((e) => console.error(e.formattedMessage));
    throw new Error("Solidity compilation failed (see messages above)");
  }

  const contract = output.contracts["CrochetSupplyChain.sol"].CrochetSupplyChain;
  const artifact = { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2));
  return artifact;
}

module.exports = { compile };

if (require.main === module) {
  compile();
  console.log("Compiled -> build/CrochetSupplyChain.json");
}
