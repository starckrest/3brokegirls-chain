// Deploys the contract to a local chain (Ganache), hands out roles, seeds a few
// demo products and writes public/config.json for the website.
//
//   npm run deploy                       -> uses RPC_URL or http://127.0.0.1:8545
//   RPC_URL=http://127.0.0.1:7545 npm run deploy   (Ganache desktop app)
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { compile } = require("./compile");

const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "public", "config.json");

// Which Ganache account plays which part in the supply chain.
const ROLE = { None: 0, Maker: 1, Distributor: 2, Retailer: 3 };
const STAGE = { Crafted: 0, Packed: 1, Shipped: 2, AtHub: 3, OnShelf: 4, Sold: 5 };

const ACCOUNT_PLAN = [
  { label: "Shop owner (admin)", role: ROLE.None },
  { label: "3brokegirls Studio", role: ROLE.Maker },
  { label: "Stitch Express Logistics", role: ROLE.Distributor },
  { label: "Sunday Craft Market", role: ROLE.Retailer },
  { label: "Customer wallet", role: ROLE.None },
];

async function send(txPromise) {
  const tx = await txPromise;
  return tx.wait();
}

async function seedDemoProducts(contract, maker, distributor, retailer) {
  const as = (signer) => contract.connect(signer);
  const make = async (name, category, batch, materials) => {
    await send(as(maker).createProduct(name, category, batch, materials, "3brokegirls Studio"));
    return Number(await contract.productCount());
  };
  const step = (signer, id, stage, location, note) =>
    send(as(signer).advance(id, stage, location, note));

  // 1) A tote that made the whole journey and is already with its new owner
  let id = await make(
    "Sunflower Granny-Square Tote",
    "Bags",
    "3BG-TOTE-0001",
    "100% cotton yarn (sunshine yellow, leaf green), cotton lining"
  );
  await step(maker, id, STAGE.Packed, "3brokegirls Studio", "Wrapped in tissue, hang-tag attached");
  await step(distributor, id, STAGE.Shipped, "Studio pick-up", "Collected by courier, parcel sealed");
  await step(distributor, id, STAGE.AtHub, "Stitch Express Sorting Hub", "Scanned in, stored dry");
  await step(retailer, id, STAGE.OnShelf, "Sunday Craft Market, Stall 12", "Displayed on the front table");
  await step(retailer, id, STAGE.Sold, "Sunday Craft Market, Stall 12", "Sold to a happy customer");

  // 2) A bunny sitting in the warehouse
  id = await make(
    "Cloud Bunny Amigurumi",
    "Soft toys",
    "3BG-BUNNY-0007",
    "Baby-soft acrylic yarn, polyfill stuffing, safety eyes"
  );
  await step(maker, id, STAGE.Packed, "3brokegirls Studio", "Boxed with a tiny carrot charm");
  await step(distributor, id, STAGE.Shipped, "Studio pick-up", "Fragile sticker added");
  await step(distributor, id, STAGE.AtHub, "Stitch Express Sorting Hub", "Waiting for the next market run");

  // 3) A beanie that was only just finished
  await make(
    "Chunky Beanie - Mauve",
    "Winter wear",
    "3BG-BEANIE-0012",
    "Chunky merino-blend yarn, hand-dyed mauve"
  );

  // 4) Coasters already on a shelf
  id = await make(
    "Mini Mushroom Coasters (set of 4)",
    "Home decor",
    "3BG-COASTER-0003",
    "Cotton yarn in cream, red and sage"
  );
  await step(maker, id, STAGE.Packed, "3brokegirls Studio", "Tied with twine");
  await step(distributor, id, STAGE.Shipped, "Studio pick-up", "Picked up with the weekend batch");
  await step(distributor, id, STAGE.AtHub, "Stitch Express Sorting Hub", "Checked and re-bagged");
  await step(retailer, id, STAGE.OnShelf, "Sunday Craft Market, Stall 12", "Placed by the candle section");
}

/**
 * Deploy + configure + (optionally) seed.
 * @param provider an ethers provider whose accounts are unlocked (Ganache)
 */
async function deployAll(provider, { writeConfig = true, seed = true, log = console.log } = {}) {
  log("Compiling contract...");
  const { abi, bytecode } = compile();

  const signers = await provider.listAccounts();
  if (signers.length < ACCOUNT_PLAN.length) {
    throw new Error(
      `Need at least ${ACCOUNT_PLAN.length} unlocked accounts, but the node only has ${signers.length}.`
    );
  }
  const [owner, maker, distributor, retailer] = signers;

  log("Deploying CrochetSupplyChain...");
  const factory = new ethers.ContractFactory(abi, bytecode, owner);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  log("  contract address:", address);

  log("Assigning roles...");
  for (let i = 0; i < ACCOUNT_PLAN.length; i++) {
    if (ACCOUNT_PLAN[i].role !== ROLE.None) {
      await send(contract.connect(owner).setRole(signers[i].address, ACCOUNT_PLAN[i].role));
      log(`  ${ACCOUNT_PLAN[i].label} -> role ${ACCOUNT_PLAN[i].role}`);
    }
  }

  if (seed) {
    log("Adding demo products...");
    await seedDemoProducts(contract, maker, distributor, retailer);
  }

  const network = await provider.getNetwork();
  const config = {
    business: "3brokegirls",
    address,
    chainId: Number(network.chainId),
    abi,
    accounts: signers.slice(0, ACCOUNT_PLAN.length).map((s, i) => ({
      index: i,
      address: s.address,
      label: ACCOUNT_PLAN[i].label,
    })),
    generatedAt: new Date().toISOString(),
  };

  if (writeConfig) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    log("Wrote public/config.json");
  }

  return { contract, address, signers, config };
}

module.exports = { deployAll, ROLE, STAGE };

if (require.main === module) {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
  deployAll(provider)
    .then(() => {
      console.log("\nDone. Start the website with:  npm start");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nDeploy failed:", err.shortMessage || err.message);
      console.error(`Is Ganache running at ${rpcUrl}?  (start it with: npm run chain)`);
      process.exit(1);
    });
}
