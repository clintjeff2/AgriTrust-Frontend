/**
 * Wallet selector UI component.
 *
 * Shows available wallet providers and handles user selection.  Renders
 * each discovered provider with icon, name, and connection status.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ProviderMetadata } from "@/src/types/wallet";
import {
  getStrategyRegistry,
  type StrategyRegistry,
} from "@/src/services/wallet/strategyRegistry";

interface WalletSelectorProps {
  /** Called when a provider is selected and connection succeeds. */
  onConnect?: (strategyId: string, account: string) => void;
  /** Called when connection fails. */
  onError?: (error: Error) => void;
  /** Optional class name for the container. */
  className?: string;
}

export function WalletSelector({
  onConnect,
  onError,
  className,
}: WalletSelectorProps) {
  const [available, setAvailable] = useState<ProviderMetadata[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProviders = useCallback(() => {
    const registry = getStrategyRegistry();
    setAvailable(registry.discoverProviders());
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const handleSelect = useCallback(
    async (provider: ProviderMetadata) => {
      setError(null);
      setConnecting(provider.id);

      try {
        const registry = getStrategyRegistry();
        await registry.setActive(provider.id);
        const active = registry.getActive();
        const account = active?.getAccount() ?? null;

        if (account) {
          onConnect?.(provider.id, account);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Connection failed";
        setError(message);
        onError?.(err instanceof Error ? err : new Error(message));
      } finally {
        setConnecting(null);
      }
    },
    [onConnect, onError],
  );

  if (available.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-gray-500">
          No wallet providers detected. Please install a wallet extension.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-3">Connect Wallet</h3>

      {error && (
        <div
          className="mb-3 p-2 text-sm text-red-700 bg-red-50 rounded border border-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {available.map((provider) => (
          <li key={provider.id}>
            <button
              type="button"
              disabled={connecting !== null}
              onClick={() => handleSelect(provider)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg border
                transition-colors duration-150
                ${provider.installed
                  ? "border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                  : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                }
                ${connecting === provider.id ? "opacity-60" : ""}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label={`Connect with ${provider.name}`}
            >
              {/* Provider icon */}
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-lg">
                {provider.id === "freighter" ? "🔑" :
                 provider.id === "lobstr" ? "🌐" :
                 provider.id === "walletconnect" ? "📱" : "💳"}
              </span>

              <div className="flex-1 text-left">
                <span className="font-medium block">{provider.name}</span>
                <span className="text-xs text-gray-500">
                  {provider.installed ? "Installed" : "Not installed"}
                </span>
              </div>

              {connecting === provider.id && (
                <span
                  className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                  aria-label="Connecting..."
                />
              )}

              {provider.installed && connecting !== provider.id && (
                <span className="text-blue-600 text-sm font-medium">
                  Connect →
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
