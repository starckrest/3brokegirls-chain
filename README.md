# 3brokegirls Chain
### Blockchain-Based Supply Chain Tracking for Handmade Crochet Goods

3brokegirls Chain is a blockchain-powered supply chain tracking dApp designed to improve transparency and traceability for handmade crochet products. It records each product's journey from the maker to the distributor and retailer, allowing customers to verify its progress through a QR code.

The project demonstrates how blockchain technology can help handmade businesses maintain trustworthy product histories and provide customers with greater visibility into the supply chain.

## Key Features

- **Blockchain-based tracking:** Records product lifecycle updates on an Ethereum-compatible blockchain.
- **Role-based access control:** Separates responsibilities between makers, distributors, and retailers.
- **Six-stage product journey:** Tracks products through crocheting and packing, shipping and hub arrival, shelf placement, and sale.
- **Append-only history:** Preserves the sequence of recorded supply chain events.
- **QR-code product tracking:** Enables customers to access product tracking information through a QR code.
- **Staff management panel:** Allows authorized participants to update product statuses.
- **Customer tracking interface:** Provides a simple interface for viewing product progress.
- **Automated testing:** Includes tests for verifying contract functionality and supply chain operations.

## Technology Stack

| Technology | Purpose |
|---|---|
| Solidity | Smart contract development |
| Ethereum / Ganache | Local blockchain environment |
| ethers.js v6 | Blockchain interaction |
| Node.js | Server-side JavaScript runtime |
| HTML, CSS, JavaScript | Frontend interfaces |
| QR Codes | Product identification and tracking |

## Supply Chain Workflow

The product moves through six stages:

1. **Crocheted and Packed** — The maker records the product's preparation.
2. **Shipped** — The distributor records dispatch.
3. **At the Hub** — The distributor records arrival at the distribution hub.
4. **On the Shelf** — The retailer records that the product is available for sale.
5. **Sold** — The retailer records the sale.

Each stage is recorded in chronological order, creating a traceable product history.

## Project Structure

```text
3brokegirls-chain/
├── build/
│   └── CrochetSupplyChain.json
├── contracts/
│   └── CrochetSupplyChain.sol
├── public/
│   ├── common.js
│   ├── config.json
│   ├── index.html
│   ├── labels.html
│   ├── logo.svg
│   ├── staff.html
│   └── style.css
├── scripts/
│   ├── compile.js
│   ├── deploy.js
│   ├── dev.js
│   ├── errtext.js
│   └── test.js
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Ganache or another compatible local Ethereum development blockchain
- Git

### 1. Clone the repository

```bash
git clone https://github.com/starckrest/3brokegirls-chain.git
cd 3brokegirls-chain
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the local blockchain

Start Ganache and configure the project to use its RPC endpoint and an appropriate development account.

Check the project's configuration files for the expected RPC URL, network settings, and contract deployment requirements.

### 4. Compile the smart contract

```bash
node scripts/compile.js
```

### 5. Deploy the smart contract

```bash
node scripts/deploy.js
```

Make sure the deployment script is configured for your running local blockchain. Update the application's contract address and network configuration as required after deployment.

### 6. Start the application

```bash
node scripts/dev.js
```

Open the local URL printed by the development server in your browser.

> **Note:** These commands reflect the project's script filenames. If your `package.json` defines npm scripts or additional setup requirements, follow those settings.

## Testing

Run the automated smart contract tests using:

```bash
node scripts/test.js
```

The project includes **13 automated tests** covering smart contract behavior and supply chain operations.

## Security and Limitations

- The project is intended for local development and demonstration.
- Ganache provides a local blockchain environment, not a production network.
- Blockchain records are designed to preserve traceability, but they do not independently prove that physical product updates are truthful.
- Production deployment would require stronger identity verification, key management, contract security reviews, and appropriate data privacy controls.

## Future Enhancements

- Deploy the smart contract to Polygon or another public EVM-compatible network.
- Integrate wallet-based authentication.
- Generate unique QR codes for individual products.
- Add product provenance certificates and downloadable tracking records.
- Improve role administration and transaction monitoring.
- Add a responsive interface for mobile devices.

## Academic Project

**Project:** 3brokegirls Chain — Blockchain-Based Supply Chain Tracking for Handmade Crochet Goods  
**Programme:** B.E. Computer Science and Engineering (AI & ML)  
**Semester:** VII  
**Academic Year:** 2026–2027  

### Contributors

- Soha Riyaz Ansari
- Khadija Hanif Chaus
- Samiya Khalid Budye

**Project Guide:** Dr. Yogesh M. Gajmal

---

*Built to explore blockchain-based transparency and traceability for handmade crochet products.*
