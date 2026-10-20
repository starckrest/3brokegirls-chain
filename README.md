# 3brokegirls chain

Blockchain supply-chain tracking for handmade crochet goods.

A piece is followed from the studio to its new owner, and every handoff is a transaction on the blockchain:

```
Maker  ->  Distributor  ->  Retailer  ->  Customer
Crocheted -> Packed -> Shipped -> At the hub -> On the shelf -> Sold
```

Each piece gets a QR hang-tag. A customer scans it and sees the full history: who made it, who moved it, where, and when.

**Tech:** Solidity (contract), Ganache (local blockchain), ethers.js, plain HTML/CSS/JS, a small Node server.

---

## What you need

- **Node.js 18 or 20 (LTS)** from https://nodejs.org. Check with `node -v`.
- That's it. Ganache, the Solidity compiler and everything else install with `npm install`.

## Run it (one command)

Open a terminal in this folder, then:

```bash
npm install
npm test        # optional but recommended: checks the contract on your machine
npm run demo
```

`npm run demo` starts a Ganache test chain, compiles and deploys the contract, adds 4 demo pieces, and starts the website.

Then open:

| Page | Address |
|------|---------|
| Customer tracking page | http://localhost:3000 |
| Staff panel | http://localhost:3000/staff.html |
| Printable QR hang-tags | http://localhost:3000/labels.html |

Try http://localhost:3000/?id=1 first. That's a tote that has made the whole journey.

> The test chain lives in memory. When you stop `npm run demo`, everything resets. Start it again and you get a fresh chain with the same demo pieces.

## Walk a piece through the whole chain

1. Open the **Staff panel**. You start as **3brokegirls Studio** (the Maker).
2. **Add a new piece**, for example "Strawberry Pouch".
3. Switch **Working as** to **Stitch Express Logistics** (Distributor) and record *Shipped*, then *At the hub*.
4. Switch to **Sunday Craft Market** (Retailer) and record *On the shelf*, then *Sold*.
5. Open the customer page with the piece number, or print its QR tag from the **Tags** page and scan it.

Each role can only record its own steps, in order. If you try something else, the contract refuses and the panel tells you why.

## Scan a QR code with your phone

1. Put your phone on the **same Wi-Fi** as your computer.
2. On the **Tags** page, choose the address that is *not* `localhost` (it looks like `http://192.168.x.x:3000`). A phone can't open `localhost`, because that means "this phone".
3. Scan a tag with the phone camera.

People on your Wi-Fi get **read-only** access to the blockchain. Only the computer running the server can add pieces or record steps.

## Using the Ganache app or a separate terminal instead

If you prefer to run Ganache yourself (three steps, three terminals or one app):

```bash
npm run chain      # terminal 1: starts Ganache on port 8545
npm run deploy     # terminal 2: compiles, deploys, seeds demo pieces
npm start          # terminal 2 or 3: starts the website
```

**Ganache desktop app** (usually port 7545). Quickstart workspace, then:

- Mac / Linux: `RPC_URL=http://127.0.0.1:7545 npm run deploy` then `RPC_URL=http://127.0.0.1:7545 npm start`
- Windows PowerShell: `$env:RPC_URL="http://127.0.0.1:7545"; npm run deploy; npm start`

Every time you restart Ganache you get a new empty chain, so run `npm run deploy` again.

## Who does what (the smart contract)

`contracts/CrochetSupplyChain.sol`

| Step | Recorded by |
|------|-------------|
| Crocheted, Packed | Maker (and only the maker of that piece) |
| Shipped, At the hub | Distributor |
| On the shelf, Sold | Retailer |

- The shop owner (the wallet that deployed the contract) gives out the roles with `setRole`.
- Steps must happen in order. Nothing can be skipped, edited or deleted, and nothing can be added after *Sold*.
- Anyone can read a piece's history: `getProduct(id)` and `getHistory(id)`.

Ganache account roles (set up by the deploy script):

| Account | Role |
|---------|------|
| 0 | Shop owner (admin) |
| 1 | 3brokegirls Studio (Maker) |
| 2 | Stitch Express Logistics (Distributor) |
| 3 | Sunday Craft Market (Retailer) |
| 4 | Customer wallet |

## Project layout

```
contracts/CrochetSupplyChain.sol   the smart contract
scripts/compile.js                 compiles it (solc)
scripts/deploy.js                  deploys, assigns roles, seeds demo pieces, writes public/config.json
scripts/dev.js                     "npm run demo": Ganache + deploy + website in one go
scripts/test.js                    "npm test": contract tests on an in-memory chain
server.js                          website, /rpc proxy to Ganache, QR code endpoint
public/index.html                  customer tracking page
public/staff.html                  staff panel
public/labels.html                 printable QR hang-tags
public/common.js, style.css        shared code and look
```

## Troubleshooting

**"This site isn't connected to a blockchain yet."** You haven't deployed. Run `npm run demo` (or `npm run deploy`).

**"The contract isn't on this chain any more."** Ganache was restarted, which wipes the chain. Run `npm run deploy` again.

**Ganache won't start or crashes on startup.** Ganache can be fussy with very new Node versions. Switch to Node 20 LTS (for example with `nvm install 20 && nvm use 20`), delete `node_modules`, and run `npm install` again.

**"Port 8545 / 3000 is already in use."** Another Ganache or server is still running. Close it, or pick another port: `PORT=3001 npm start` (PowerShell: `$env:PORT=3001; npm start`).

**QR codes don't work from my phone.** Make sure the phone is on the same Wi-Fi and the Tags page is set to the `192.168.x.x` address. Some guest or office Wi-Fi networks block devices from talking to each other.

**`npm install` shows warnings.** Warnings about deprecated packages or optional native modules are normal. Only errors matter.

## Good to know

This runs on a **local test chain with fake ether**, which is perfect for a demo or a project submission. To make it real, deploy the same contract to a public network (for example Sepolia) and swap the staff panel's Ganache accounts for a wallet such as MetaMask.
