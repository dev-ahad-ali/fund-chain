"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Heart,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Contract } from "ethers";
import { useWallet } from "@/components/wallet/wallet-context";
import {
  CROWDFUNDING_DEMO_ABI,
  getConfiguredContractAddress,
  getTxExplorerUrl,
} from "@/lib/ethers/contract-abi";
import { campaignIdForSlug } from "@/lib/ethers/campaign-id";
import { getBrowserProvider } from "@/lib/ethers/browser";
import { parseEthAmount, shortenTxHash } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Donation transaction flow:
 * 1. Require a connected wallet ON Sepolia (switch action offered otherwise).
 * 2. Require a positive, parseable ETH amount.
 * 3. User-facing states: awaiting approval → pending (hash + explorer link)
 *    → confirmed → verified (MongoDB record) or verification-pending with a
 *    retry action. Rejections and failures are surfaced clearly.
 * 4. The server verifies the receipt/event; the client only ever sends the
 *    transaction hash and campaign slug.
 */

const SUGGESTED_AMOUNTS = ["0.001", "0.01", "0.05"];

export type TxPhase =
  | "idle"
  | "awaiting-approval"
  | "pending"
  | "confirmed"
  | "verified"
  | "rejected"
  | "failed";

type VerifyOutcome = "not-verified" | "pending" | "verified" | "failed";

export function DonationPanel({
  campaignSlug,
  campaignTitle,
}: {
  campaignSlug: string;
  campaignTitle: string;
}) {
  const wallet = useWallet();
  const router = useRouter();

  const [phase, setPhase] = useState<TxPhase>("idle");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [verifyOutcome, setVerifyOutcome] = useState<VerifyOutcome>("not-verified");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const contractAddress = useMemo(() => getConfiguredContractAddress(), []);

  /** Ask the server to verify; independent of the sign/submit flow. */
  const verifyDonation = useCallback(
    async (hash: string): Promise<VerifyOutcome> => {
      let outcome: VerifyOutcome = "failed";
      try {
        const response = await fetch("/api/donations/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignSlug,
            transactionHash: hash,
          }),
        });
        type VerifyBody = {
          ok?: boolean;
          state?: string;
          message?: string;
        };
        const body = (await response.json().catch(() => ({}))) as VerifyBody;

        if (response.ok && body.ok) {
          outcome = "verified";
          setVerifyOutcome("verified");
          setPhase("verified");
          setStatusMessage("Donation verified on-chain and recorded.");
          toast.success("Donation verified", {
            description: `${campaignTitle} totals updated.`,
          });
          // Refresh the server component so totals/donation counts update.
          router.refresh();
          return outcome;
        }

        if (response.status === 503) {
          outcome = "failed";
          setVerifyOutcome("failed");
          setStatusMessage(
            body.message ??
              "Verification is temporarily unavailable. Keep the transaction hash shown above.",
          );
        } else if (response.status === 202 || body.state === "missing-receipt") {
          outcome = "pending";
          setVerifyOutcome("pending");
          setStatusMessage(
            body.message ??
              "Receipt not available yet (transaction still settling). Retry verification shortly.",
          );
        } else {
          outcome = "failed";
          setVerifyOutcome("failed");
          setStatusMessage(
            body.message ??
              "Verification failed, but your transaction hash is preserved below.",
          );
        }
      } catch {
        outcome = "failed";
        setVerifyOutcome("failed");
        setStatusMessage(
          "Verification request failed. Your transaction hash is preserved below; retry verification.",
        );
      }
      return outcome;
    },
    [campaignSlug, campaignTitle, router],
  );

  const submitDonation = useCallback(async () => {
    if (!contractAddress) {
      setStatusMessage(
        "The donation contract is not configured yet (missing NEXT_PUBLIC_CONTRACT_ADDRESS).",
      );
      setPhase("failed");
      return;
    }
    if (!wallet.address || !wallet.isSepolia) {
      return;
    }

    const wei = parseEthAmount(amount);
    if (wei === null) {
      setAmountError("Enter a positive ETH amount, e.g. 0.01.");
      return;
    }
    setAmountError(null);
    setPhase("awaiting-approval");
    setStatusMessage(null);
    setVerifyOutcome("not-verified");

    // Track the submitted hash locally — state updates won't be visible to
    // this closure if an error is thrown later in this call.
    let submittedHash: string | null = null;

    try {
      const browserProvider = getBrowserProvider();
      const signer = await browserProvider.getSigner();
      if (
        (await signer.getAddress()).toLowerCase() !==
        wallet.address.toLowerCase()
      ) {
        throw new Error(
          "Active MetaMask account changed during donation. Review the account and retry.",
        );
      }

      const contract = new Contract(
        contractAddress,
        [...CROWDFUNDING_DEMO_ABI],
        signer,
      );
      const campaignId = campaignIdForSlug(campaignSlug);
      const tx = await contract.donate(campaignId, { value: wei });
      submittedHash = tx.hash;
      setTxHash(tx.hash);
      toast.info("Transaction submitted", {
        description: "Waiting for confirmation on Sepolia…",
      });

      // ≥1 confirmation before verification.
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        setPhase("failed");
        setStatusMessage(
          "The transaction was included but reverted. No donation was recorded.",
        );
        return;
      }

      setPhase("confirmed");
      setStatusMessage("Confirmed on Sepolia. Verifying…");
      await verifyDonation(tx.hash);
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      const rawMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : String(error);

      if (
        code === "ACTION_REJECTED" ||
        /user rejected|user denied/i.test(rawMessage)
      ) {
        setPhase("rejected");
        setStatusMessage("You rejected the transaction in MetaMask.");
      } else if (/insufficient funds/i.test(rawMessage)) {
        setPhase("failed");
        setStatusMessage(
          "Insufficient Sepolia ETH for this donation plus gas. Lower the amount or get more test ETH from a Sepolia faucet.",
        );
      } else if (submittedHash) {
        setPhase("pending");
        setStatusMessage(
          "Lost track while waiting, but the transaction may have succeeded. Check Etherscan below; verification can be retried from there.",
        );
      } else {
        setPhase("failed");
        setStatusMessage(`Transaction failed: ${rawMessage}`);
      }
    }
  }, [amount, contractAddress, campaignSlug, verifyDonation, wallet.address, wallet.isSepolia]);

  const busy =
    phase === "awaiting-approval" ||
    phase === "pending" ||
    phase === "confirmed";

  const canDonate =
    wallet.status === "connected" &&
    wallet.isSepolia &&
    !busy &&
    !!contractAddress;

  const buttonLabel = !contractAddress
    ? "Donations disabled — contract not configured"
    : !wallet.hasWallet
      ? "Install MetaMask to donate"
      : wallet.status !== "connected"
        ? "Connect MetaMask to donate"
        : !wallet.isSepolia
          ? "Switch to Sepolia to donate"
          : busy
            ? "Processing…"
            : `Donate ${amount || "ETH"}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {SUGGESTED_AMOUNTS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAmount(preset);
              setAmountError(null);
            }}
            disabled={busy}
          >
            {preset} ETH
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donation-amount">Custom amount (ETH)</Label>
        <Input
          id="donation-amount"
          type="text"
          inputMode="decimal"
          placeholder="0.01"
          value={amount}
          disabled={busy}
          onChange={(event) => {
            setAmount(event.target.value);
            setAmountError(null);
          }}
        />
        {amountError ? (
          <p className="text-xs text-destructive" role="alert">
            {amountError}
          </p>
        ) : null}
      </div>

      {wallet.hasWallet && wallet.status === "connected" && !wallet.isSepolia ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void wallet.switchToSepolia()}
        >
          Switch to Sepolia
        </Button>
      ) : null}

      <Button
        type="button"
        className={cn(
          "w-full",
          phase === "verified" && "border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-600/90",
        )}
        onClick={() => {
          if (!canDonate) return;
          void submitDonation();
        }}
        disabled={!canDonate}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Heart className="h-4 w-4" aria-hidden />
        )}
        {buttonLabel}
      </Button>

      {!contractAddress ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The donation contract has not been deployed and configured yet, so
          donating is disabled. Everything else on this page works.
        </p>
      ) : null}

      {(phase !== "idle" || txHash) && (
        <div
          className="rounded-md border p-3 text-xs space-y-2"
          role="status"
          aria-live="polite"
        >
          {phase === "awaiting-approval" ? (
            <p className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Awaiting your approval in MetaMask…
            </p>
          ) : null}
          {phase === "pending" ? (
            <p className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Transaction submitted, waiting for Sepolia confirmations…
            </p>
          ) : null}
          {phase === "confirmed" ? (
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Confirmed — verifying with the server…
            </p>
          ) : null}
          {phase === "verified" ? (
            <p className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Donation verified and recorded on the campaign.
            </p>
          ) : null}
          {phase === "rejected" ? (
            <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              Transaction rejected.
            </p>
          ) : null}
          {phase === "failed" ? (
            <p className="flex items-center gap-1.5 font-medium text-destructive">
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              Transaction failed.
            </p>
          ) : null}

          {txHash ? (
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
            >
              {shortenTxHash(txHash)}
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="font-sans">on Sepolia Etherscan</span>
            </a>
          ) : null}

          {statusMessage ? (
            <p className="text-muted-foreground">{statusMessage}</p>
          ) : null}

          {verifyOutcome === "pending" || verifyOutcome === "failed" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!txHash) return;
                void verifyDonation(txHash);
              }}
            >
              Verify transaction
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Donations are live Sepolia transactions signed by your wallet in
        MetaMask. Test ETH has no real-world value. The app never touches your
        private keys and never submits transactions without your explicit
        action.
        {contractAddress
          ? null
          : " (Contract address not configured.)"}
      </p>
    </div>
  );
}
