import { FlaskConical, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "About",
};

const FACTS = [
  {
    icon: FlaskConical,
    title: "Sepolia testnet only",
    body: "Donations are live transactions on Ethereum Sepolia using test ETH, which has no real-world value and cannot be exchanged. This demo is never deployed to mainnet.",
  },
  {
    icon: ShieldCheck,
    title: "Verified totals only",
    body: "Raised amounts are computed exclusively from donations the server has independently verified on-chain (transaction receipt + decoded DonationReceived event). Campaign text, goals, and deadlines are editable demo data.",
  },
  {
    icon: Wallet,
    title: "MetaMask required",
    body: "Wallet connection, switching networks, and signing donations all happen through MetaMask. WalletConnect and other wallets are not supported in this demo. The app never sees your private keys or seed phrase.",
  },
];

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">About FundChain</h1>
      <p className="mt-3 text-muted-foreground">
        FundChain is a portfolio demo of verifiable crowdfunding: a Next.js
        app backed by MongoDB Atlas, with donations recorded by a minimal
        Solidity contract on Ethereum Sepolia and verified server-side before
        being trusted by the UI.
      </p>
      <div className="mt-8 grid gap-4">
        {FACTS.map((fact) => (
          <Card key={fact.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <fact.icon className="h-4 w-4" aria-hidden />
                {fact.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="leading-6">
                {fact.body}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Badge variant="outline">Demo project</Badge>
        <Badge variant="outline">Not audited</Badge>
        <Badge variant="outline">Not a production fundraising service</Badge>
      </div>
    </div>
  );
}
