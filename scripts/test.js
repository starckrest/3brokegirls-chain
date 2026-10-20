// Contract tests on an in-memory Ganache chain (no ports needed):  npm test
const ganache = require("ganache");
const { ethers } = require("ethers");
const assert = require("assert");
const { deployAll, STAGE } = require("./deploy");
const { errorText } = require("./errtext");

let raw; // the underlying Ganache provider, set in main()

// If ethers hid the reason, ask Ganache directly with the same call to read its own error
async function rawReason(e) {
  try {
    const tx = e && e.transaction;
    if (!tx || !raw) return "";
    const call = { from: tx.from, to: tx.to, data: tx.data };
    Object.keys(call).forEach((k) => call[k] === undefined && delete call[k]);
    if (e.action === "call") await raw.request({ method: "eth_call", params: [call, "latest"] });
    else await raw.request({ method: "eth_estimateGas", params: [call] });
  } catch (inner) {
    return errorText(inner);
  }
  return "";
}

async function expectRevert(promise, text) {
  try {
    await promise;
  } catch (e) {
    let msg = errorText(e);
    if (msg.includes(text)) return;
    msg += " | " + (await rawReason(e));
    if (msg.includes(text)) return;
    throw new Error(`Expected a revert containing "${text}" but got: ${msg.slice(0, 600)}`);
  }
  throw new Error(`Expected a revert containing "${text}" but the call succeeded`);
}

let passed = 0;
async function it(name, fn) {
  await fn();
  passed++;
  console.log("  ok  " + name);
}

(async () => {
  const eip1193 = ganache.provider({ wallet: { deterministic: true }, chain: { chainId: 1337 }, logging: { quiet: true } });
  raw = eip1193;
  const provider = new ethers.BrowserProvider(eip1193);
  const quiet = () => {};

  // ---- Part 1: rules of the contract, starting from an empty chain ----
  const { contract, signers } = await deployAll(provider, { writeConfig: false, seed: false, log: quiet });
  const [owner, maker, distributor, retailer, customer] = signers;
  const as = (s) => contract.connect(s);

  console.log("\nContract rules");
  await it("starts with no products", async () => {
    assert.strictEqual(Number(await contract.productCount()), 0);
  });

  await it("rejects product creation by a non-maker", async () => {
    await expectRevert(as(customer).createProduct("Hat", "Wear", "B1", "Wool", "Studio"), "Only a registered Maker");
  });

  await it("maker creates a product (stage Crafted, 1 history entry)", async () => {
    await (await as(maker).createProduct("Test Tote", "Bags", "B1", "Cotton", "Studio")).wait();
    const p = await contract.getProduct(1);
    assert.strictEqual(Number(p.id), 1);
    assert.strictEqual(p.name, "Test Tote");
    assert.strictEqual(Number(p.stage), STAGE.Crafted);
    assert.strictEqual(p.maker, maker.address);
    assert.strictEqual((await contract.getHistory(1)).length, 1);
  });

  await it("blocks skipping a step", async () => {
    await expectRevert(as(distributor).advance(1, STAGE.Shipped, "x", "x"), "Steps must happen in order");
  });

  await it("blocks the wrong role from a step", async () => {
    await expectRevert(as(retailer).advance(1, STAGE.Packed, "x", "x"), "Your role cannot record this step");
  });

  await it("blocks a customer with no role", async () => {
    await expectRevert(as(customer).advance(1, STAGE.Packed, "x", "x"), "Your role cannot record this step");
  });

  await it("walks the full journey Maker -> Distributor -> Retailer -> Customer", async () => {
    await (await as(maker).advance(1, STAGE.Packed, "Studio", "boxed")).wait();
    await (await as(distributor).advance(1, STAGE.Shipped, "Pick-up", "collected")).wait();
    await (await as(distributor).advance(1, STAGE.AtHub, "Hub", "stored")).wait();
    await (await as(retailer).advance(1, STAGE.OnShelf, "Stall 12", "displayed")).wait();
    await (await as(retailer).advance(1, STAGE.Sold, "Stall 12", "sold")).wait();
    const h = await contract.getHistory(1);
    assert.strictEqual(h.length, 6);
    assert.deepStrictEqual(h.map((c) => Number(c.stage)), [0, 1, 2, 3, 4, 5]);
    assert.strictEqual(h[2].actor, distributor.address);
    assert.strictEqual(h[2].location, "Pick-up");
  });

  await it("blocks changes after the item is sold", async () => {
    await expectRevert(as(retailer).advance(1, STAGE.Sold, "x", "x"), "Already sold");
  });

  await it("rejects unknown product IDs", async () => {
    await expectRevert(contract.getProduct(99), "Unknown product ID");
  });

  await it("only the owner can assign roles", async () => {
    await expectRevert(as(maker).setRole(customer.address, 1), "Only the owner");
  });

  await it("a second maker cannot touch someone else's piece", async () => {
    await (await as(owner).setRole(customer.address, 1)).wait(); // customer becomes a Maker
    await (await as(maker).createProduct("Beanie", "Wear", "B2", "Wool", "Studio")).wait(); // id 2
    await expectRevert(as(customer).advance(2, STAGE.Packed, "x", "x"), "Only this piece's maker");
  });

  // ---- Part 2: the demo data used by `npm run deploy` ----
  console.log("\nDemo seed data");
  const seeded = await deployAll(provider, { writeConfig: false, seed: true, log: quiet });
  await it("seeds 4 demo products", async () => {
    assert.strictEqual(Number(await seeded.contract.productCount()), 4);
  });
  await it("seed histories have the expected lengths [6,4,1,5]", async () => {
    const lens = [];
    for (let i = 1; i <= 4; i++) lens.push((await seeded.contract.getHistory(i)).length);
    assert.deepStrictEqual(lens, [6, 4, 1, 5]);
  });

  console.log(`\nAll ${passed} tests passed.`);
  process.exit(0);
})().catch((err) => {
  console.error("\nTEST FAILED:", err.message);
  process.exit(1);
});
