"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWallet } from "@/components/wallet/wallet-context";
import { formatEthAmount, shortenAddress } from "@/lib/format";

/**
 * Header wallet control. Handles all wallet UI states:
 * not installed → install link; disconnected → connect prompt (only after
 * user action); connected on wrong chain → switch to Sepolia; connected on
 * Sepolia → address + balance with a details dialog.
 */

function MetaMaskInstallInfoRow() {
  return (
    <p className="text-sm text-muted-foreground">
      MetaMask was not detected in this browser.{" "}
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        Install MetaMask
      </a>{" "}
      to connect your wallet.
    </p>
  );
}

export function WalletButton() {
  const wallet = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Surface wallet errors to the user without a toast library: errors are
  // also shown in the UI state below.
  useEffect(() => {
    if (wallet.error) {
      console.warn(
        `[wallet] ${wallet.error.kind}: ${wallet.error.message}`,
      );
    }
  }, [wallet.error]);

  if (wallet.status === "checking") {
    return (
      <Button size="sm" variant="outline" disabled>
        <Wallet className="h-4 w-4" aria-hidden />
        Wallet…
      </Button>
    );
  }

  if (!wallet.hasWallet) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Wallet className="h-4 w-4" aria-hidden />
            Connect MetaMask
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>MetaMask required</DialogTitle>
            <DialogDescription>
              FundChain uses MetaMask for wallet sign-in and Sepolia test ETH
              donations. This site does not support WalletConnect or other
              wallets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <MetaMaskInstallInfoRow />
            </div>
            <DialogClose asChild>
              <Button variant="secondary" className="w-full">
                <X className="h-4 w-4" aria-hidden />
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (wallet.status !== "connected" || !wallet.address) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void wallet.connect()}
          disabled={wallet.status === "connecting"}
        >
          <Wallet className="h-4 w-4" aria-hidden />
          {wallet.status === "connecting" ? "Connecting…" : "Connect MetaMask"}
        </Button>
        {wallet.error ? (
          <span
            role="status"
            className="hidden max-w-28 truncate text-xs text-destructive md:inline"
            title={wallet.error.message}
          >
            {wallet.error.message}
          </span>
        ) : null}
      </div>
    );
  }

  const address = wallet.address;
  const sepoliaConnected = wallet.isSepolia;

  if (!sepoliaConnected) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => void wallet.switchToSepolia()}
      >
        <Wallet className="h-4 w-4" aria-hidden />
        Switch to Sepolia
      </Button>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <span
            className="h-2 w-2 rounded-full bg-emerald-500"
            aria-hidden
          />
          {shortenAddress(address)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Wallet</DialogTitle>
          <DialogDescription>
            Connected on the Ethereum Sepolia testnet. Personal keys stay in
            MetaMask — this app only signs requests you approve there.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="font-mono text-xs">{shortenAddress(address)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Network</dt>
            <dd className="font-medium">Sepolia (chain {wallet.chainId})</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Balance</dt>
            <dd className="font-medium">
              {wallet.balanceWei === null
                ? "Reading…"
                : `${formatEthAmount(wallet.balanceWei, {
                    maxFractionDigits: 5,
                  })} ETH`}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <a
            href={`https://sepolia.etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            View on Sepolia Etherscan
          </a>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => void wallet.refreshBalance()}
            >
              Refresh balance
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                wallet.disconnect();
                setDialogOpen(false);
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
