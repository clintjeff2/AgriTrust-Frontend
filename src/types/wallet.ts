/**
 * Type definitions for the pluggable wallet authentication strategy system.
 *
 * Each wallet provider (Freighter, Lobstr, xBull, WalletConnect, etc.) is
 * implemented as a strategy that conforms to the Strategy interface, enabling
 * runtime provider discovery and hot-swappable authentication backends.
 */

// ── strategy config & metadata ──────────────────────────────────────────

/** Features a wallet provider may or may not support. */
export type ProviderFeature =
  | "signMessage"
  | "signTransaction"
  | "multiAccount"
  | "hardwareWallet"
  | "qrCode";

/** Metadata describing a wallet provider for the UI. */
export interface ProviderMetadata {
  /** Unique provider id (e.g. "freighter", "lobstr"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** URL to the provider's icon (svg or png). */
  icon: string;
  /** Provider's website for users who need to install the extension. */
  website: string;
  /** Features this provider supports. */
  requiredFeatures: ProviderFeature[];
  /** Whether this provider is detected as installed/available. */
  installed: boolean;
}

/** Configuration needed to register a strategy. */
export interface StrategyConfig {
  metadata: ProviderMetadata;
  /** Optional priority for auto-selection (higher = preferred). */
  priority?: number;
}

// ── auth result ─────────────────────────────────────────────────────────

/** Result of an authentication flow (connect, sign, etc.). */
export interface AuthResult {
  /** The connected account address (public key). */
  account: string;
  /** Chain / network id the account is on. */
  chainId: string | null;
  /** Optional: a signed authentication challenge. */
  signature?: string;
  /** Optional: additional provider-specific data. */
  extra?: Record<string, unknown>;
}

// ── sign payload ────────────────────────────────────────────────────────

/** Payload to sign (e.g. a transaction or an auth challenge). */
export interface SignPayload {
  /** The raw message or transaction to sign. */
  message: string | Uint8Array;
  /** Optional: encoding of the message (utf8, hex, base64). */
  encoding?: "utf8" | "hex" | "base64";
}

// ── strategy interface ──────────────────────────────────────────────────

/**
 * Interface that every wallet strategy must implement.
 *
 * Strategies are lazy-loaded via dynamic import() to keep the initial
 * bundle size small.
 */
export interface WalletStrategy {
  /** Unique identifier matching ProviderMetadata.id. */
  readonly id: string;

  /** Attempt to connect to the wallet. Returns account info on success. */
  connect(): Promise<AuthResult>;

  /** Disconnect from the wallet and clean up resources. */
  disconnect(): void;

  /** Sign a message or transaction payload. */
  sign(payload: SignPayload): Promise<AuthResult>;

  /** Get the currently connected account, or null if not connected. */
  getAccount(): string | null;

  /** Whether the wallet is currently connected and available. */
  isConnected(): boolean;
}

// ── registry types ──────────────────────────────────────────────────────

/** Events emitted by the strategy registry. */
export type RegistryEventType = "strategy:registered" | "strategy:active" | "strategy:error";

export interface RegistryEvent {
  type: RegistryEventType;
  strategyId?: string;
  error?: Error;
}
