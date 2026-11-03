import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WalletProvider } from "@/components/wallet/wallet-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FundChain — Web3 Crowdfunding Demo",
    template: "%s | FundChain",
  },
  description:
    "A Sepolia testnet crowdfunding demo with MetaMask, on-chain donation verification, and MongoDB-backed campaigns.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    // Dark mode is the default for this demo (class-based variant).
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="flex min-h-full flex-col">
        <WalletProvider>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </WalletProvider>
        <Toaster />
      </body>
    </html>
  );
}
