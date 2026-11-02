# FundChain — Implementation Plan

## 1. Objective

Build a minimal, portfolio-ready Web3 crowdfunding demo using one Next.js application.

The project should demonstrate four things:

1. A working MetaMask connection.
2. Correct Ethereum Sepolia network and account handling.
3. A real testnet ETH donation transaction through a small Solidity contract.
4. MongoDB-backed mock campaign content and verified donation display.

Reference: https://github.com/tamg1/Fundraiser-App-Web3

Use the reference for the crowdfunding concept and broad product flow, not as a codebase to reproduce.

## 2. Deliberate scope

### Included

- Next.js App Router + TypeScript.
- Tailwind CSS + shadcn/ui.
- MongoDB Atlas + Mongoose.
- Seeded mock campaigns.
- Homepage campaign grid.
- Campaign detail page.
- MetaMask injected-provider connection.
- Sepolia chain detection and switching.
- Account/network change handling.
- ETH balance display.
- Minimal Solidity donation contract.
- ethers.js v6 contract interaction.
- Sepolia donation transaction.
- Server-side transaction receipt/event verification.
- Verified donation records in MongoDB.
- Vercel deployment instructions.

### Excluded

- Mainnet deployment.
- Real-money fundraising.
- NFT/token features.
- WalletConnect and broad multi-wallet support.
- Full user authentication and account management.
- Admin dashboard.
- Campaign creation on-chain.
- Email/subscription system.
- Complex escrow, milestone releases, refunds, or Kickstarter-equivalent campaign rules.
- Persistent blockchain event listener/indexer.
- Smart contract audit claims.

The app must visibly state that it is a Sepolia testnet demo and not a production fundraising service.

## 3. Stack

| Concern | Technology |
|---|---|
| Application | Next.js App Router |
| Language | TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Wallet | MetaMask injected EIP-1193 provider |
| Ethereum client | ethers.js v6 |
| Contract | Solidity |
| Contract tooling | Hardhat |
| Hosting | Vercel |

Use ethers.js directly rather than introducing wagmi/RainbowKit for this learning-focused demo. The initial supported wallet is MetaMask. Do not advertise WalletConnect support.

## 4. Architecture

```text
Browser
  |
  |-- Next.js UI
  |     |-- Campaign list/detail (server-rendered where practical)
  |     |-- Wallet UI (client components)
  |     |-- Donation interaction (ethers.js v6)
  |     |
  |     |-- MetaMask injected provider
  |              |
  |              v
  |         Ethereum Sepolia
  |              |
  |              |-- CrowdfundingDemo contract
  |              |-- DonationReceived event
  |
  |-- Next.js Route Handlers
         |-- GET campaigns
         |-- GET campaign by slug
         |-- POST verify transaction
                  |
                  |-- Sepolia JSON-RPC read provider
                  |-- Verify receipt + contract event
                  |
                  v
              MongoDB Atlas
                |-- Campaigns
                |-- Verified donations
```

### Source-of-truth rules

- Campaign title, description, image, category, creator display name, goal, and deadline: MongoDB demo records.
- Wallet account and connected network: MetaMask/provider.
- Actual donation amount, donor, transaction hash, and confirmation: Ethereum receipt and decoded contract event.
- Donation records shown by the site: MongoDB records created only after server-side verification.
- Do not seed fake donation transactions or present mock raised amounts as real.

## 5. Data model

### Campaign

```ts
{
  slug: string;             // unique
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  category: string;
  creatorName: string;
  creatorWallet?: string;
  goalWei: string;          // decimal integer string, not JS float
  deadline: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Donation

```ts
{
  campaignSlug: string;
  campaignId: string;       // bytes32 identifier used by contract
  donorAddress: string;     // lowercase
  amountWei: string;        // exact integer string
  transactionHash: string;  // unique, lowercase
  blockNumber: number;
  chainId: number;          // 11155111
  status: "confirmed";
  createdAt: Date;
  updatedAt: Date;
}
```

Create a unique index on `transactionHash`, plus an index on `campaignSlug`.

## 6. API design

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/campaigns` | List published campaigns |
| GET | `/api/campaigns/[slug]` | Read one published campaign |
| POST | `/api/donations/verify` | Verify a Sepolia transaction and save its donation |

### Verification endpoint

Request body:

```json
{
  "campaignSlug": "community-library",
  "transactionHash": "0x..."
}
```

The server must independently verify the transaction. It must not accept amount, donor address, status, or chain ID as trusted request values.

Verification steps:

1. Validate `campaignSlug` and transaction hash.
2. Load the campaign and derive its expected bytes32 campaign ID.
3. Fetch the receipt from Sepolia using the server-side RPC URL.
4. Require successful receipt status.
5. Require logs from the configured contract address.
6. Decode `DonationReceived`.
7. Match the decoded campaign ID.
8. Derive donor and amount from the event.
9. Insert with duplicate-safe behavior.
10. Return the verified record or existing record.

If verification is temporarily unavailable after a successful chain transaction, preserve the transaction hash in the UI and let the user retry verification. Never prompt them to donate again just because the API failed.

## 7. Wallet behavior

Implement a reusable wallet context or hook.

### Initial load

- Check for `window.ethereum`.
- If present, call `eth_accounts` to discover an already-authorized account.
- Do not call `eth_requestAccounts` automatically.
- Read `eth_chainId`.
- If connected on Sepolia, read balance.
- If connected on another chain, show a switch-network action.

### Explicit connect

- User clicks Connect.
- Call `eth_requestAccounts`.
- Validate/normalize the returned address.
- Read chain ID and balance.
- Update UI.

### Network switching

- Target chain ID: `11155111`.
- Hex chain ID: `0xaa36a7`.
- Call `wallet_switchEthereumChain`.
- If error code `4902`, call `wallet_addEthereumChain` with Sepolia metadata.
- Never place a private RPC API key in public client configuration.

### Provider events

Subscribe to:

- `accountsChanged`
- `chainChanged`

Update account, network, and balance. Remove event listeners on component cleanup.

### Error states

Handle at minimum:

- MetaMask not installed.
- User rejects connection (`4001`).
- No authorized account.
- Wrong network.
- Wallet locked/unavailable.
- RPC/network error.
- Transaction rejected.
- Transaction reverted.
- Transaction pending.
- Receipt confirmed but API verification pending.

The app's Disconnect action only clears local UI state. Do not claim it revokes MetaMask's site permission.

## 8. Smart contract plan

Create `CrowdfundingDemo.sol` with a minimal donation interface:

- `donate(bytes32 campaignId)` payable.
- `DonationReceived(bytes32 campaignId, address donor, uint256 amount)`.
- Total raised per campaign.
- Per-donor contribution per campaign.
- Read methods as useful.
- A clearly defined owner-only withdrawal mechanism with reentrancy protection, or omit withdrawal and explicitly disclose that the demo contract is donation-only and funds are not recoverable.

Use checks-effects-interactions and avoid arbitrary external calls. Add tests for:

- Successful donation.
- Zero-value donation rejected.
- Total raised updated.
- Donor contribution updated.
- Event emitted with correct values.
- Unauthorized withdrawal rejected, if withdrawal exists.
- Authorized withdrawal works, if withdrawal exists.

Campaign ID derivation must be consistent:

```ts
const campaignId = ethers.id(campaign.slug);
```

Do not claim the contract implements production escrow, refunds, campaign deadlines, or a complete Kickstarter model.

Deploy the contract to Sepolia separately using Hardhat. Never deploy it to mainnet for this demo.

## 9. UI pages and components

### `/`

- Header and brand.
- Connect wallet button.
- Hero with concise product explanation.
- Sepolia/demo notice.
- Campaign cards from MongoDB.
- Raised/goal progress based on verified donations.
- Empty, loading, and error states.

### `/campaigns/[slug]`

- Campaign image and information.
- Goal, deadline, category, creator.
- Verified raised amount and donation count.
- Donation amount selector/input.
- Wallet connection/network prompts.
- Donate button.
- Transaction lifecycle and Etherscan link.
- Retry verification action if needed.

Keep the visual system simple and responsive. Use shadcn/ui components rather than building a large design system.

## 10. Environment configuration

`.env.example`:

```dotenv
MONGODB_URI=
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=
SEPOLIA_RPC_URL=
```

- `MONGODB_URI`: server only.
- `SEPOLIA_RPC_URL`: server only.
- `NEXT_PUBLIC_CHAIN_ID`: public.
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: public.
- Never commit `.env.local`, private keys, or RPC credentials.
- The user's MetaMask signs the donation. The application must not use a server private key to send donations.

## 11. Seed data

Create 4–6 campaigns with plausible titles and descriptions, for example:

- Community Library Renovation
- Clean Water for Rural Communities
- Open-Source Education Lab
- Neighborhood Solar Project
- Local Food Bank Expansion

Seed by slug using upserts. Seed campaign content only; no fake donation records. Raised totals should start at zero and grow only from verified Sepolia donations.

## 12. Vercel deployment plan

1. Create a MongoDB Atlas free cluster.
2. Create a database user and database.
3. Configure Atlas network access for the deployed Vercel app. Document the trade-off of broad IP access for a quick demo; do not call it ideal production security.
4. Run the seed script against Atlas.
5. Configure a Sepolia RPC endpoint.
6. Compile and test the contract locally.
7. Deploy the contract to Sepolia from a local machine using Hardhat.
8. Copy the deployed contract address into `NEXT_PUBLIC_CONTRACT_ADDRESS`.
9. Add environment variables in Vercel:
   - `MONGODB_URI`
   - `SEPOLIA_RPC_URL`
   - `NEXT_PUBLIC_CHAIN_ID`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
10. Deploy the Next.js app to Vercel.
11. Test the production URL with MetaMask on Sepolia.
12. Confirm campaign reads, wallet connection, network switching, donation, and server verification.

Do not deploy contracts from a Vercel build. Do not rely on persistent background workers or local filesystem storage.

## 13. Implementation sequence

### Milestone 1 — Scaffold and UI

- Inspect repository.
- Initialize Next.js/TypeScript/Tailwind/shadcn.
- Build homepage and campaign detail layout with temporary typed data.
- Confirm responsive behavior.

### Milestone 2 — MongoDB

- Add Mongoose connection helper.
- Add Campaign and Donation models.
- Add campaign read endpoints.
- Add idempotent seed script.
- Connect pages to MongoDB.

### Milestone 3 — Contract

- Add Solidity contract and Hardhat.
- Add contract tests.
- Compile and test locally.
- Document Sepolia deployment.

### Milestone 4 — MetaMask

- Add wallet context/hook.
- Implement connect, initial account discovery, address display, balance, chain detection, Sepolia switch, provider events, and error states.
- Test with MetaMask before implementing donations.

### Milestone 5 — Donation and verification

- Add ethers contract client.
- Implement donation transaction.
- Show pending/confirmed/rejected states.
- Add server-side receipt/event verification.
- Save verified donations idempotently.
- Refresh campaign totals.

### Milestone 6 — Release readiness

- Add `.env.example`, `.gitignore`, and README.
- Run lint, typecheck, build, and contract tests.
- Deploy contract to Sepolia.
- Deploy app to Vercel.
- Test the deployed app end to end.

## 14. Acceptance checklist

- [ ] App builds successfully.
- [ ] MongoDB campaign seed is repeatable.
- [ ] Homepage displays MongoDB campaigns.
- [ ] Campaign details load by slug.
- [ ] MetaMask is detected.
- [ ] Connect works only after a user click.
- [ ] Address and Sepolia balance display.
- [ ] Account changes update the UI.
- [ ] Network changes update the UI.
- [ ] Wrong network can be switched to Sepolia.
- [ ] Missing MetaMask is handled clearly.
- [ ] Contract compiles and tests pass.
- [ ] Sepolia donation can be submitted and confirmed.
- [ ] Server verifies the receipt and event.
- [ ] Duplicate verification cannot duplicate a donation.
- [ ] Etherscan transaction link is displayed.
- [ ] Verification can be retried without a second donation.
- [ ] No secrets or private keys are exposed.
- [ ] Vercel deployment instructions are complete.

## 15. Definition of done

The demo is done when a visitor can open the deployed Vercel site, browse campaigns loaded from MongoDB Atlas, connect MetaMask, switch to Sepolia, see their wallet address and test ETH balance, make a small testnet donation, and see the confirmed donation reflected after server-side verification.

Do not add features beyond this definition of done until the full flow works reliably.
