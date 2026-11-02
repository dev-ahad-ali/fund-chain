# Agent Prompt — Build FundChain (Minimal Web3 Crowdfunding Demo)

You are a senior full-stack engineer. Build a small, working Web3 crowdfunding demo in the current repository. The primary objective is a reliable MetaMask connection and a real Ethereum Sepolia testnet donation flow. Keep the implementation intentionally minimal, easy to understand, and deployable on Vercel's free tier.

Use the reference project for product inspiration only:
https://github.com/tamg1/Fundraiser-App-Web3

Do not copy its implementation blindly. Build a clean Next.js application using the requirements below.

## 1. Product scope

Build **FundChain**, a minimal crowdfunding demo with:

- A public homepage showing campaign cards.
- A campaign detail page.
- Campaign information stored in MongoDB Atlas.
- Seeded mock campaign records so the site has content immediately.
- MetaMask wallet connection.
- Connected wallet address and Sepolia ETH balance.
- Sepolia network detection and a switch-network action.
- A real donation transaction to a small Solidity contract deployed on Sepolia.
- Clear wallet/transaction states and useful error messages.
- A transaction link to Sepolia Etherscan after a successful donation.

This is a portfolio/demo project, not a production fundraising service. Display a visible notice that it uses Sepolia test ETH and that campaign content is demo data.

## 2. Fixed technology choices

Use:

- Latest stable Next.js with App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui components (initialize shadcn/ui if not already configured).
- MongoDB Atlas.
- Mongoose (do not use Prisma).
- ethers.js v6.
- Solidity for the minimal donation contract.
- Hardhat for compiling, testing, and deploying the contract.
- Vercel for hosting the Next.js application.

Do not add wagmi, RainbowKit, thirdweb, Moralis, The Graph, Redux, a separate Express server, or other large frameworks. Use the browser's injected EIP-1193 provider (`window.ethereum`) and ethers.js directly. The required wallet for this demo is MetaMask. Do not claim that WalletConnect or every wallet is supported.

Use npm unless the repository already uses another package manager. Respect the existing repository structure if one exists; do not overwrite unrelated user work.

## 3. Architecture and boundaries

Keep one Next.js application. Use:

- Server Components for campaign listing/detail data fetching where practical.
- Client Components only for interactive wallet and donation UI.
- Next.js Route Handlers for MongoDB-backed API endpoints and donation verification.
- Mongoose models for campaigns and verified donations.
- A small `contracts/` directory for the Solidity contract and Hardhat setup.

Never import Mongoose, server-only secrets, or server RPC configuration into client components.

Suggested structure (adapt only when an existing project makes a better structure clear):

```text
app/
  page.tsx
  campaigns/[slug]/page.tsx
  api/campaigns/route.ts
  api/campaigns/[slug]/route.ts
  api/donations/verify/route.ts
components/
  layout/
  campaigns/
  wallet/
  ui/
lib/
  mongodb.ts
  ethers/
    browser.ts
    contract-abi.ts
    server.ts
models/
  Campaign.ts
  Donation.ts
scripts/
  seed.ts
contracts/
  contracts/CrowdfundingDemo.sol
  test/CrowdfundingDemo.test.ts
  scripts/deploy.ts
  hardhat.config.ts
public/
```

## 4. UI requirements

Create a clean, responsive, credible crowdfunding interface. Use shadcn/ui for buttons, cards, badges, dialogs, inputs, progress, skeletons, and toast/sonner feedback where appropriate.

Keep the design restrained and readable. Do not spend excessive time on animations or decorative effects.

### Homepage

- Header with brand, navigation, and wallet button.
- Hero section explaining the demo.
- Campaign grid with seeded MongoDB campaigns.
- Each campaign card shows image, title, short description, category, creator, goal, verified raised amount, and progress.
- A visible “Sepolia testnet demo” notice.
- Loading, empty, and error states.

### Campaign detail

- Campaign image, title, description, creator, category, goal, deadline, and progress.
- Display verified on-chain raised amount and number of verified donations.
- Donation panel with a small set of suggested ETH amounts and a custom amount input.
- Donate button disabled when wallet is disconnected, wrong network, invalid amount, or a transaction is pending.
- Show transaction lifecycle: awaiting wallet approval, submitted/pending, confirmed, rejected, or failed.
- On confirmation, show transaction hash and Sepolia Etherscan link.
- Explain that test ETH has no real-world value.

Do not show fake donation totals as if they were verified. Seeded campaign goal and descriptive content are mock data; initialize raised totals to zero unless verified donation records exist.

## 5. MongoDB requirements

Use Mongoose and MongoDB Atlas.

Create a reusable MongoDB connection helper that caches the connection/promise across hot reloads and serverless invocations. Fail with a clear server-side error if `MONGODB_URI` is missing.

Create these models:

### Campaign

Suggested fields:

- `slug`: unique string
- `title`: string
- `shortDescription`: string
- `description`: string
- `imageUrl`: string
- `category`: string
- `creatorName`: string
- `creatorWallet`: optional string
- `goalWei`: string (store precise integer units as a decimal string)
- `deadline`: Date
- `isPublished`: boolean
- timestamps

Do not store ETH values as JavaScript floating-point numbers. Store the goal as wei string and format it for display with ethers.js.

### Donation

Suggested fields:

- `campaignSlug`: string, indexed
- `campaignId`: string (the on-chain bytes32 campaign identifier)
- `donorAddress`: normalized lowercase address
- `amountWei`: string
- `transactionHash`: unique, normalized lowercase
- `blockNumber`: number
- `chainId`: number
- `status`: confirmed
- timestamps

Add a unique index on `transactionHash` so a transaction cannot be recorded twice.

### API endpoints

Implement only what the UI needs:

- `GET /api/campaigns`: return published campaigns.
- `GET /api/campaigns/[slug]`: return one published campaign.
- `POST /api/donations/verify`: accept a transaction hash and campaign slug, then independently verify the transaction on the server before inserting a Donation record.

Use `runtime = "nodejs"` for handlers that use Mongoose or ethers server-side.

### Donation verification security

The browser must never be trusted to tell the server the donation amount, donor address, or confirmation status.

For `POST /api/donations/verify`:

1. Validate the input and transaction hash format.
2. Load the campaign from MongoDB.
3. Fetch the transaction receipt from Sepolia using a server-side `JsonRpcProvider`.
4. Require a successful receipt.
5. Require the configured contract address and Sepolia chain.
6. Parse the expected `DonationReceived` event from the configured contract ABI.
7. Verify the emitted campaign ID matches the selected campaign.
8. Derive donor address and amount from the decoded on-chain event, not the request body.
9. Insert idempotently using the unique transaction hash.
10. Return the existing record if this transaction was already verified.
11. Return safe, actionable errors; do not expose RPC credentials or stack traces.

Do not add a persistent event-listener process. Vercel serverless functions are not a place for a permanently running listener. The demo can verify a transaction after the user submits it and the receipt is available. Explain this limitation in the README.

## 6. Wallet integration — highest priority

Implement direct MetaMask integration using ethers.js v6 and the injected EIP-1193 provider.

Create a small wallet context/provider or a focused reusable hook. Avoid duplicating wallet logic across components.

Required behavior:

- Detect whether `window.ethereum` exists.
- If absent, show a clear “Install MetaMask” link to https://metamask.io/download/.
- On initial load, use `eth_accounts` to check whether the user has already granted access. Do not unexpectedly open the MetaMask permission prompt on page load.
- On explicit Connect click, call `eth_requestAccounts`.
- Validate and display the connected address in shortened form.
- Read the connected account's Sepolia ETH balance with ethers.js.
- Detect the active chain using `eth_chainId`.
- Require Sepolia (`11155111`, hex `0xaa36a7`).
- Provide a “Switch to Sepolia” action using `wallet_switchEthereumChain`.
- Handle error code `4902` by requesting Sepolia addition with `wallet_addEthereumChain`, including chain ID, ETH currency, and reliable Sepolia RPC/explorer metadata. Prefer the wallet's configured/default RPC where possible; do not put a private RPC key in client code.
- Subscribe to `accountsChanged` and `chainChanged`.
- Clean up event listeners on unmount.
- When the account changes, refresh account and balance state.
- When the chain changes, refresh network state and balance. Handle MetaMask's provider reload behavior safely.
- Provide Disconnect in the UI by clearing the app's local connected state. Explain in code comments that an injected wallet does not provide a universal programmatic permission-revoke method.
- Handle user rejection (`4001`), locked/unavailable wallet, unsupported provider, RPC errors, and unexpected errors without crashing.
- Never request, read, store, or transmit a user's seed phrase or private key.
- Never auto-submit a transaction.

Use ethers.js v6 APIs (`BrowserProvider`, `parseEther`, `formatEther`, `getSigner`, `Contract`). Do not use deprecated ethers v5 APIs.

## 7. Smart contract — minimal and testnet-only

Create a small Solidity contract suitable for this demo.

Requirements:

- A `DonationReceived` event containing `campaignId`, `donor`, and `amount`.
- `donate(bytes32 campaignId)` payable.
- Reject zero-value donations.
- Track total raised per campaign ID.
- Track each donor's contribution per campaign ID.
- Provide read functions for totals/contributions if useful.
- Provide a simple, explicit withdrawal mechanism controlled by the contract owner for this demo, with checks against zero-value withdrawals and reentrancy.
- Use checks-effects-interactions and a reentrancy guard (OpenZeppelin is acceptable if it does not add unnecessary complexity).
- Emit a withdrawal event.
- Add Hardhat tests for successful donation, zero-value rejection, totals, contributor accounting, unauthorized withdrawal, and successful authorized withdrawal.

The campaign's `campaignId` must be a deterministic bytes32 value derived from its stable MongoDB slug (for example, `ethers.id(slug)` in the frontend/server). Use the same derivation everywhere.

This is a testnet demo contract, not audited production financial software. Make this explicit in the README and UI. Do not imply the contract implements a complete Kickstarter refund/deadline/escrow model. Do not deploy to mainnet.

If a safe, testable withdrawal design cannot be implemented quickly, omit withdrawal rather than shipping unsafe fund-handling logic, and clearly document that the demo contract is donation-only and funds are not recoverable. Never silently leave funds trapped while claiming the contract is production-ready.

## 8. Donation transaction flow

1. User opens a campaign.
2. User connects MetaMask.
3. App confirms Sepolia is selected.
4. User enters a valid positive ETH amount.
5. App calls the contract's `donate(campaignId)` with `value: ethers.parseEther(amount)`.
6. UI immediately shows wallet approval/submission state.
7. Once submitted, show the transaction hash and pending state.
8. Wait for at least one confirmation using the transaction response's `wait()` method.
9. Call `POST /api/donations/verify` with only the transaction hash and campaign slug.
10. Server independently verifies receipt and event before writing to MongoDB.
11. Refresh campaign donation totals from verified MongoDB records.
12. Handle rejected, reverted, timed-out, duplicate, and verification-pending cases gracefully.

If the chain transaction succeeds but the verification API is temporarily unavailable, do not ask the user to donate again. Keep the transaction hash visible and provide a “Verify transaction” retry action.

## 9. Environment variables

Create `.env.example` with placeholders only:

```dotenv
MONGODB_URI=
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=
SEPOLIA_RPC_URL=
```

Rules:

- `MONGODB_URI` and `SEPOLIA_RPC_URL` are server-only.
- `NEXT_PUBLIC_CHAIN_ID` and `NEXT_PUBLIC_CONTRACT_ADDRESS` are public configuration.
- Never commit `.env.local`, secrets, private keys, or funded wallet credentials.
- Do not use a server wallet/private key for user donations.
- The user signs donations in MetaMask.
- Validate required environment variables at the point they are used and provide actionable errors.

## 10. Seed data

Create a repeatable seed script that inserts 4–6 plausible demo campaigns into MongoDB.

Use remote image URLs from stable, legitimate image sources or simple local placeholders. Avoid depending on an image API key.

Seed should be idempotent (upsert by slug), and should not overwrite existing verified donation records. Include sample campaign titles, descriptions, categories, creators, goals, and future deadlines.

Mock campaign content is allowed. Do not seed fake on-chain donations or fabricated transaction hashes.

Document how to run the seed script locally.

## 11. Vercel deployment requirements

Make the app compatible with Vercel's Node.js serverless runtime:

- No long-running server or background listener.
- No local filesystem persistence.
- No in-memory data as the source of truth.
- Cache Mongoose connections safely.
- Keep API handlers short and bounded.
- Do not run contract deployment from Vercel.
- Deploy the contract separately to Sepolia using Hardhat from a local machine.
- Configure environment variables in Vercel.
- Explain MongoDB Atlas network access configuration. For a quick demo, document the implications of allowing Vercel access; do not claim that a broad IP allowlist is ideal production security.
- Include build and deployment instructions.

## 12. Quality requirements

- Strict TypeScript; avoid `any` unless there is a documented reason.
- Keep components small and focused.
- Validate user input on both client and server.
- Use `bigint`/ethers BigInt utilities for wei arithmetic; never use floating-point arithmetic for blockchain amounts.
- Never trust client-provided donation amount or wallet address.
- Do not expose secrets in browser bundles or logs.
- Add loading, empty, error, pending, success, and rejected states.
- Add useful server-side logging without secrets.
- Add a basic README with setup, seed, contract test/deploy, local development, and Vercel deployment instructions.
- Add `.gitignore` entries for environment files, build outputs, and Hardhat artifacts/cache.
- Ensure `npm run lint`, `npm run build`, and contract tests pass.

## 13. Work process — follow this order

1. Inspect the repository and existing files before changing anything.
2. Summarize the implementation plan and identify any missing configuration.
3. Scaffold the Next.js app if needed.
4. Implement the database models, connection helper, and seed script.
5. Build the campaign UI and verify MongoDB-backed campaign display.
6. Implement and test the Solidity contract.
7. Implement MetaMask connection and network handling.
8. Implement donation interaction and server-side receipt verification.
9. Add loading/error/empty states and responsive polish.
10. Write `.env.example` and README.
11. Run lint, typecheck, build, and contract tests; fix all failures.
12. Report exactly what works, what needs user-provided configuration, and the steps to deploy.

Do not stop after generating a plan or scaffolding. Implement the working application. If credentials or a deployed contract address are unavailable, complete all code and tests that can be completed, then provide precise manual steps for the user to configure and deploy it.

## 14. Final acceptance checklist

The project is complete only when:

- [ ] Homepage loads campaigns from MongoDB.
- [ ] Seed script creates demo campaigns idempotently.
- [ ] Campaign detail page loads by slug.
- [ ] MetaMask is detected correctly.
- [ ] Connect prompts MetaMask only after user action.
- [ ] Connected account and Sepolia balance display correctly.
- [ ] Account changes update the UI.
- [ ] Network changes update the UI.
- [ ] Wrong network can be switched to Sepolia.
- [ ] Missing MetaMask has an install path and graceful UI.
- [ ] Contract compiles and tests pass.
- [ ] A Sepolia donation can be submitted and confirmed.
- [ ] Server verifies the receipt/event before saving donation data.
- [ ] Duplicate verification does not duplicate donations.
- [ ] Transaction hash links to Sepolia Etherscan.
- [ ] A successful chain transaction is not lost if the verification API temporarily fails.
- [ ] No private keys or secrets are committed or exposed.
- [ ] README explains local setup and Vercel deployment.
- [ ] Production build succeeds.

Prioritize correct wallet and transaction behavior over extra features or visual complexity.
