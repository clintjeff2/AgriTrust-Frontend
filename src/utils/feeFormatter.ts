/**
 * Fee formatting utilities
 * Converts stroops to human-readable units (XLM, USDC)
 */

// 1 XLM = 10,000,000 stroops
const STROOPS_PER_XLM = BigInt(10_000_000);

// Exchange rate cache
interface ExchangeRateCache {
  xlmToUsd: number;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

let exchangeRateCache: ExchangeRateCache | null = null;

/**
 * Formats stroops as XLM with proper decimal handling
 * @param stroops Amount in stroops (smallest unit of XLM)
 * @returns Formatted string like "0.5000000 XLM"
 */
export function formatStroops(stroops: bigint): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return xlm.toFixed(7);
}

/**
 * Formats stroops as XLM with currency label
 */
export function formatStroopsWithLabel(stroops: bigint): string {
  return `${formatStroops(stroops)} XLM`;
}

/**
 * Converts stroops to XLM as a number
 */
export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / Number(STROOPS_PER_XLM);
}

/**
 * Fetches current XLM to USD exchange rate
 * Uses cache to avoid excessive API calls (5 minute TTL)
 */
export async function fetchExchangeRate(): Promise<number> {
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Return cached rate if still valid
  if (exchangeRateCache && now - exchangeRateCache.timestamp < CACHE_TTL) {
    return exchangeRateCache.xlmToUsd;
  }

  try {
    // Fetch from CoinGecko API (free tier, no API key required)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data?.stellar?.usd;

    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error('Invalid exchange rate received');
    }

    // Update cache
    exchangeRateCache = {
      xlmToUsd: rate,
      timestamp: now,
      ttl: CACHE_TTL,
    };

    return rate;
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    
    // Return cached rate if available, even if expired
    if (exchangeRateCache) {
      console.warn('Using stale exchange rate from cache');
      return exchangeRateCache.xlmToUsd;
    }

    // Fallback rate if no cache available
    console.warn('Using fallback exchange rate: $0.10');
    return 0.10;
  }
}

/**
 * Formats stroops as USD using current exchange rate
 * @param stroops Amount in stroops
 * @param exchangeRate XLM to USD rate (if not provided, will fetch)
 */
export async function formatStroopsAsUsd(
  stroops: bigint,
  exchangeRate?: number
): Promise<string> {
  const rate = exchangeRate ?? (await fetchExchangeRate());
  const xlm = stroopsToXlm(stroops);
  const usd = xlm * rate;
  
  return usd.toFixed(4);
}

/**
 * Formats stroops with both XLM and USD display
 * Example: "0.5000000 XLM ($0.0500)"
 */
export async function formatStroopsDual(
  stroops: bigint,
  exchangeRate?: number
): Promise<string> {
  const xlmStr = formatStroops(stroops);
  const usdStr = await formatStroopsAsUsd(stroops, exchangeRate);
  
  return `${xlmStr} XLM ($${usdStr})`;
}

/**
 * Formats large numbers with thousand separators
 * Example: 1234567 -> "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Formats bytes to human-readable format
 * Example: 1024 -> "1.0 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Clears the exchange rate cache (useful for testing)
 */
export function clearExchangeRateCache(): void {
  exchangeRateCache = null;
}

/**
 * Gets cached exchange rate without fetching (returns null if no cache)
 */
export function getCachedExchangeRate(): number | null {
  return exchangeRateCache?.xlmToUsd ?? null;
}
