"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EIP1193_ERROR_CODES,
  SEPOLIA_CHAIN_ID,
  getBrowserProvider,
  getInjectedProvider,
  type Eip1193Provider,
} from "@/lib/ethers/browser";

/**
 * MetaMask wallet state, behavior, and lifecycle for the whole app.
 *
 * Design notes:
 * - On mount we only call `eth_accounts` (no surprise permission prompts).
 * - The MetaMask permission prompt happens exclusively on user action
 *   (Connect click → `eth_requestAccounts`).
 * - "Disconnect" clears app-local state only; an injected EIP-1193 provider
 *   has no universal programmatic permission-revoke method — users revoke
 *   site access from MetaMask's own "Connected sites" settings.
 * - We never request or touch private keys or seed phrases; MetaMask owns
 *   all signing, and the app never auto-submits transactions.
 */

export type WalletStatus =
  | "checking" // initial provider/account discovery in progress
  | "disconnected"
  | "connecting"
  | "connected";

export type WalletError = {
  kind:
    | "no-provider"
    | "user-rejected"
    | "pending-authorization"
    | "rpc-error"
    | "unexpected";
  message: string;
};

export type WalletContextValue = {
  status: WalletStatus;
  /** True when an injected EIP-1193 provider exists in this browser. */
  hasWallet: boolean;
  isMetaMaskProvider: boolean;
  /** Connected (checksummed) address, or null. */
  address: string | null;
  /** Active decimal chain id, or null when unknown. */
  chainId: number | null;
  isSepolia: boolean;
  /** Sepolia balance in wei, or null when unknown/unavailable. */
  balanceWei: bigint | null;
  error: WalletError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToSepolia: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/** Parse hex or decimal chain-id strings into a decimal number, else null. */
function parseChainId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("0x")) {
    const parsed = Number.parseInt(trimmed, 16);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  return null;
}

function describeWalletError(error: unknown): WalletError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);

  if (code === EIP1193_ERROR_CODES.USER_REJECTED) {
    return {
      kind: "user-rejected",
      message: "You rejected the request in MetaMask.",
    };
  }
  if (
    code === "ACTION_REJECTED" ||
    /user rejected|user denied/i.test(rawMessage)
  ) {
    return {
      kind: "user-rejected",
      message: "You rejected the request in MetaMask.",
    };
  }
  if (code === EIP1193_ERROR_CODES.UNAUTHORIZED) {
    return {
      kind: "pending-authorization",
      message:
        "MetaMask already has a pending request for this site. Open the MetaMask extension to respond to it.",
    };
  }
  if (/no.*provider|No MetaMask provider/i.test(rawMessage)) {
    return {
      kind: "no-provider",
      message:
        "No MetaMask provider found in this browser. Install MetaMask to continue.",
    };
  }
  if (/-32603|-32701|Internal JSON-RPC/i.test(String(code))) {
    return {
      kind: "rpc-error",
      message:
        "MetaMask returned an RPC error. Check your network connection or MetaMask's selected network settings, then try again.",
    };
  }
  return {
    kind: "unexpected",
    message: `Wallet request failed: ${rawMessage}`,
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("checking");
  const [hasWallet, setHasWallet] = useState(false);
  const [isMetaMaskProvider, setIsMetaMaskProvider] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [error, setError] = useState<WalletError | null>(null);

  const providerRef = useRef<Eip1193Provider | null>(null);
  const addressRef = useRef<string | null>(null);

  // Keep the latest address reachable from stable callbacks without
  // re-creating them on every render (do not touch refs during render).
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  /** Read the balance for the given account on the current chain. */
  const refreshBalance = useCallback(async () => {
    const account = addressRef.current;
    if (!account) {
      setBalanceWei(null);
      return;
    }
    try {
      const browserProvider = getBrowserProvider();
      setBalanceWei(await browserProvider.getBalance(account));
    } catch (err) {
      console.warn("[wallet] balance read failed", err);
      setBalanceWei(null);
    }
  }, []);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) {
      // Defer so we do not set state synchronously inside the effect.
      const timer = window.setTimeout(() => {
        setHasWallet(false);
        setStatus("disconnected");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    providerRef.current = provider;

    let cancelled = false;

    const bootstrap = () => {
      setHasWallet(true);
      setIsMetaMaskProvider(provider.isMetaMask === true);

      const initialCheck = async () => {
        try {
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          if (cancelled) return;

          const account = Array.isArray(accounts) ? accounts[0] : undefined;
          if (account) {
            const activeChainId = parseChainId(
              await provider.request({ method: "eth_chainId" }),
            );
            if (cancelled) return;
            setAddress(account);
            setChainId(activeChainId ?? null);
            setStatus("connected");
            // Balance is only meaningful/available on Sepolia for this demo.
            if (activeChainId === SEPOLIA_CHAIN_ID) {
              void refreshBalance();
            }
          } else {
            setStatus("disconnected");
          }
        } catch (err) {
          if (!cancelled) {
            setStatus("disconnected");
            console.warn("[wallet] initial eth_accounts check failed", err);
          }
        }
      };

      void initialCheck();
    };

    // Defer the bootstrap out of the effect body so no state is set
    // synchronously during the effect run.
    const timer = window.setTimeout(bootstrap, 0);

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const account = Array.isArray(accounts) ? accounts[0] : undefined;
      if (account) {
        setAddress(account);
        setStatus("connected");
        void refreshBalance();
      } else {
        // All accounts disconnected in MetaMask itself.
        setAddress(null);
        setBalanceWei(null);
        setStatus("disconnected");
      }
    };

    const onChainChanged = (...args: unknown[]) => {
      const hexChainId = args[0];
      const parsed = parseChainId(hexChainId);
      setChainId(parsed);
      // MetaMask may reload page context; our state is source of truth here.
      // Balance must be re-read for the newly selected chain.
      if (parsed === SEPOLIA_CHAIN_ID) {
        void refreshBalance();
      } else {
        setBalanceWei(null);
      }
    };

    try {
      provider.on?.("accountsChanged", onAccountsChanged);
      provider.on?.("chainChanged", onChainChanged);
    } catch (err) {
      console.warn("[wallet] failed to subscribe to provider events", err);
    }

    return () => {
      cancelled = true;
      try {
        window.clearTimeout(timer);
        provider.removeListener?.("accountsChanged", onAccountsChanged);
        provider.removeListener?.("chainChanged", onChainChanged);
      } catch (err) {
        console.warn("[wallet] failed to clean up provider listeners", err);
      }
    };
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    const provider = providerRef.current ?? getInjectedProvider();
    if (!provider) {
      setError({
        kind: "no-provider",
        message:
          "No MetaMask provider found in this browser. Install MetaMask to continue.",
      });
      return;
    }
    providerRef.current = provider;
    setStatus("connecting");
    setError(null);

    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = Array.isArray(accounts) ? accounts[0] : undefined;
      if (!account) {
        setStatus("disconnected");
        setError({
          kind: "unexpected",
          message: "MetaMask returned no account. Unlock MetaMask and retry.",
        });
        return;
      }

      setAddress(account);
      const activeChainId = parseChainId(
        await provider.request({ method: "eth_chainId" }),
      );
      setChainId(activeChainId ?? null);
      setStatus("connected");

      if (activeChainId === SEPOLIA_CHAIN_ID) {
        void refreshBalance();
      }
    } catch (err) {
      setStatus("disconnected");
      setError(describeWalletError(err));
    }
  }, [refreshBalance]);

  // Local-state "disconnect"; see module doc for the permission caveat.
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setBalanceWei(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    const provider = providerRef.current ?? getInjectedProvider();
    if (!provider) {
      setError({
        kind: "no-provider",
        message:
          "No MetaMask provider found in this browser. Install MetaMask to continue.",
      });
      return;
    }
    setError(null);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      // chainChanged listener updates state; also set directly for safety.
      setChainId(SEPOLIA_CHAIN_ID);
      void refreshBalance();
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (code === EIP1193_ERROR_CODES.CHAIN_NOT_ADDED) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
                // Public, keyless endpoints only — never ship private RPC keys.
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
          setChainId(SEPOLIA_CHAIN_ID);
          void refreshBalance();
          return;
        } catch (addError) {
          setError(describeWalletError(addError));
          return;
        }
      }
      setError(describeWalletError(err));
    }
  }, [refreshBalance]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      hasWallet,
      isMetaMaskProvider,
      address,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      balanceWei,
      error,
      connect,
      disconnect,
      switchToSepolia,
      refreshBalance,
      clearError,
    }),
    [
      status,
      hasWallet,
      isMetaMaskProvider,
      address,
      chainId,
      balanceWei,
      error,
      connect,
      disconnect,
      switchToSepolia,
      refreshBalance,
      clearError,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside a <WalletProvider>.");
  }
  return context;
}
