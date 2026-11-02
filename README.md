# FundChain — Web3 Crowdfunding Demo

A minimal, portfolio-grade crowdfunding demo built with **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, **MongoDB Atlas via Mongoose**, **ethers.js v6**, and a small **Solidity** donation contract deployed to **Ethereum Sepolia** with **Hardhat**.

> **This is a testnet demo.** Donations use Sepolia test ETH with no real-world value, campaign content is demo data, and the contract is not audited. FundChain is not a production fundraising service.

**What works end to end:**

1. MetaMask connection via the injected EIP-1193 provider (no WalletConnect / multi-wallet support).
2. Sepolia network detection, `wallet_switchEthereumChain`, and chain-add fallback (`wallet_addEthereumChain`) with keyless public metadata.
3. A real donation: `CrowdfundingDemo.donate(campaignId)` signed by your wallet in MetaMask, showing the full transaction lifecycle and a Sepolia Etherscan link.
4. Server-side verification: `POST /api/donations/verify` re-reads the transaction receipt from Sepolia, decodes the `DonationReceived` event from the configured contract, and only then inserts a `Donation` record in MongoDB (idempotent on the transaction hash).
5. Campaign totals shown in the UI come only from these verified records — no fake donation totals.

---

## Architecture

```text
app/                        Next.js App Router routes
  page.tsx                  Homepage: hero + campaign grid (MongoDB)
  about/                    Demo notice page
  campaigns/[slug]/         Campaign detail + donation panel
  api/campaigns/            GET published campaigns (+ [slug])
  api/donations/verify/     POST — verify a Sepolia tx, record donation
components/
  campaigns/                Campaign grid/card, donation panel (client)
  layout/                   Header/footer
  wallet/                   WalletProvider (client) + header wallet button
  ui/                       shadcn/ui primitives
lib/
  mongodb.ts                Cached Mongoose connection helper
  campaigns.ts              Server data access (campaigns + verified totals)
  formatting utilities      ethers-based ETH/wei display, address/tx shortening
  ethers/
    browser.ts              Browser-only EIP-1193 types + Sepolia metadata
    contract-abi.ts         ABI fragment + public config helpers
    campaign-id.ts          bytes32 campaign id = ethers.id(slug)
    server.ts               SERVER-ONLY JsonRpcProvider for verification
models/                     Mongoose Campaign + Donation schemas
scripts/seed.ts             Idempotent demo campaign seeding (tsx)
contracts/                  Hardhat 3 workspace (separate package.json)
```

Key boundaries:

- `lib/ethers/server.ts` (RPC URL) and `lib/mongodb.ts` are never imported by client components.
- The browser never tells the server the donation amount, donor address, or confirmation status. The server derives all of it from the on-chain receipt and event.
- Amount bookkeeping uses wei strings/bigints everywhere — never JS floats for blockchain values.
- There is **no long-running event listener**. Verification happens when a user submits a transaction hash (or retries it later); Vercel serverless functions are unsuitable for persistent listeners.

---

## Prerequisites

- Node.js ≥ 20 and npm
- MetaMask browser extension
- A MongoDB Atlas free cluster
- Sepolia test ETH for making donations (faucet: e.g. <https://www.alchemy.com/faucets/ethereum-sepolia> or <https://sepoliafaucet.com>)

---

## Local development setup

### 1. Configure environment variables

Copy the example and fill in the server-only secrets:

```bash
cp .env.example .env.local
```

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fundchain   # server-only
NEXT_PUBLIC_CHAIN_ID=11155111          # public
NEXT_PUBLIC_CONTRACT_ADDRESS=          # public — set after contract deployment
SEPOLIA_RPC_URL=                       # server-only; optional, public RPC fallback used when empty
```

- `MONGODB_URI` / `SEPOLIA_RPC_URL` stay server-side and is never exposed to the browser.
- `NEXT_PUBLIC_*` values are safe in the client bundle.
- Never commit `.env.local`.

### 2. Install, seed, run

```bash
npm install
npm run seed       # idempotent: upserts demo campaigns by slug
npm run dev        # http://localhost:3000
```

The seed script inserts 5 demo campaigns and **never** creates donation records — totals grow only from verified Sepolia transactions. Re-running it is safe.

### 3. Verify against MongoDB

Open <http://localhost:3000> — campaign cards render from Atlas. `GET /api/campaigns` returns the same data as JSON.

---

## Contract (Hardhat 3 workspace)

```bash
cd contracts
npm install
npm run build                                  # compile (optional; test compiles too)
npm run test                                   # 9 contract tests vs in-memory network
```

`contracts/contracts/CrowdfundingDemo.sol` implements:

- `donate(bytes32 campaignId)` — payable, rejects zero-value donations, tracks per-campaign totals (`totalRaised`, `totalRaisedFor`) and per-donor contributions (`contributions`, `contributionFor`), emits `DonationReceived(bytes32 indexed campaignId, address indexed donor, uint256 amount)`.
- Owner-only `withdraw(address, uint256)` / `withdrawAll(address)` with a checks-effects-interactions ordering and a nonReentrant guard, plus explicit errors and a `Withdrawn` event.
- Plain ETH transfers without a campaign revert (`CallToContract`).

**This contract is a demo.** It implements no deadlines, refunds, or escrow logic and is not audited.

### Deploy to Sepolia (local machine only — never from Vercel)

```bash
cd contracts
npx hardhat keystore set SEPOLIA_RPC_URL                # e.g. https://ethereum-sepolia-rpc.publicnode.com
npx hardhat keystore set SEPOLIA_DEPLOYER_PRIVATE_KEY   # funded Sepolia-only account (test ETH)
npx hardhat run scripts/deploy.ts --network sepolia
```

The deployer account must hold a little Sepolia ETH for gas. Copy the printed address into:

- `.env.local` → `NEXT_PUBLIC_CONTRACT_ADDRESS` (local)
- Vercel env vars → `NEXT_PUBLIC_CONTRACT_ADDRESS` (deployed app)

> The network config is written for Sepolia only (`chainId 11155111`). Do not point this project at mainnet.

---

## Verification flow and limitations

After a successful donation:

1. The client shows the transaction hash with a Sepolia Etherscan link and waits for ≥1 confirmation (`tx.wait(1)`).
2. It sends **only** `{ campaignSlug, transactionHash }` to `POST /api/donations/verify`.
3. The server fetches the receipt via its own `JsonRpcProvider`, requires:
   - a success status (not reverted),
   - the Sepolia chain,
   - a `DonationReceived` event emitted by the configured contract,
   - the event's `campaignId` to match `ethers.id(campaignSlug)`,
4. and inserts the donor/amount (derived from the event) into MongoDB. The unique index on `transactionHash` makes this idempotent — duplicate verifications never duplicate donations.

**Limitations to know about:**

- If the verification API is temporarily unavailable, or the receipt isn't available yet (still pending), the UI keeps the transaction hash visible and offers a **Verify transaction** retry. You are never asked to donate again because verification failed.
- Donations made by third parties directly on-chain are not auto-indexed (no listener). Coverage of totals is limited to donations verified through the app.

---

## MongoDB Atlas network access

For a fast demo, Atlas's *Network Access* can be opened to `0.0.0.0/0` (allow access from anywhere) because Vercel serverless IPs are not generally fixed. Be aware of the tradeoff:

- **Convenient for demos** — works with any Vercel/production region.
- **Not ideal production security** — prefer Atlas's dedicated Vercel integration, private networking, or a fixed IP allowlist when your platform supports it, and always use a least-privilege database user.

Use strong passwords regardless; demo or not.

---

## Deploy the app to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com), import the repo (framework auto-detected as Next.js).
3. Add environment variables (Project → Settings → Environment Variables):
   - `MONGODB_URI` (server-only)
   - `SEPOLIA_RPC_URL` (server-only; optional but recommended — bring your own RPC for reliable verification)
   - `NEXT_PUBLIC_CHAIN_ID=11155111`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed contract address>`
4. Deploy. `next build` runs automatically in the Vercel build step.
5. In Atlas, allow Vercel's network access (see above).
6. Test the deployment end-to-end with MetaMask on Sepolia: browse campaigns, connect, switch networks, donate, then confirm the donation count/total updates after verification (verifiable on Sepolia Etherscan and in Atlas).

Also deployed contract steps must be run from a local machine — Vercel never deploys or holds contract keys.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (Next 15+ enabled Cache Components) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | ESLint (strict next/core-web-vitals + TS) |
| `npm run seed` | Idempotent MongoDB demo-campaign seeding (tsx) |
| `cd contracts && npm run test` | Contract unit tests (Hardhat 3 + ethers + Mocha) |
| `cd contracts && npm run build` | Compile the Solidity contract |

---

## Security checklist honored

- [x] MetaMask connection prompts only after explicit user action (`eth_accounts` on load, `eth_requestAccounts` on click).
- [x] User rejection (4001), pending-authorization (−32002), unknown-chain (4902), RPC, and unexpected errors handled without crashing.
- [x] Account/chain change events update UI state; listeners cleaned up on unmount.
- [x] Disconnect clears app state only (EIP-1193 has no universal programmatic permission revoke; revoke access in MetaMask → Connected sites).
- [x] Never asks for or stores seed phrases / private keys; no server-side transaction signing.
- [x] Browser sends only `{ campaignSlug, transactionHash }` for verification; server derives donor/amount from on-chain data.
- [x] Unique index on `Donation.transactionHash` → no double-counting.
- [x] No private RPC keys in client code; Sepolia metadata for `wallet_addEthereumChain` is keyless.
- [x] No secrets committed; `.env*` git-ignored (`.env.example` kept).
- [x] CORS/safety: no `dangerouslySetInnerHTML`, no unvalidated slugs.
- [x] Balance/amount math in wei/bigint only.

---

## License

MIT — this is demo/portfolio code, not production infrastructure.
