const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const defaultSleep = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

const requestPathname = (url) => {
  try {
    return new URL(url, "http://papercut.local").pathname;
  } catch (_error) {
    return String(url || "");
  }
};

export const canRetryRequest = (url, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  // Wallet initialization is an idempotent get-or-create operation. Other
  // POST requests can move funds or mutate content and must never be replayed.
  return method === "POST" && requestPathname(url).endsWith("/api/user/wallet");
};

const retryDelayFromResponse = (response, fallback) => {
  const retryAfter = Number(response.headers?.get?.("retry-after"));
  if (!Number.isFinite(retryAfter) || retryAfter <= 0) return fallback;
  return Math.min(retryAfter * 1000, 3000);
};

export async function resilientAuthFetch(url, options = {}, context = {}) {
  const {
    authenticated = false,
    getAccessToken = async () => null,
    identityToken = "",
    fetchImpl = globalThis.fetch,
    retryDelays = [250, 750],
    sleep = defaultSleep,
  } = context;

  const retryable = canRetryRequest(url, options);
  let transientRetries = 0;
  let authenticationRetried = false;

  for (;;) {
    const headers = new Headers(options.headers || {});
    if (authenticated) {
      const accessToken = await getAccessToken();
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      if (identityToken && !authenticationRetried) {
        headers.set("X-Privy-Identity-Token", identityToken);
      } else {
        headers.delete("X-Privy-Identity-Token");
      }
    }

    let response;
    try {
      response = await fetchImpl(url, { ...options, headers });
    } catch (error) {
      if (!retryable || transientRetries >= retryDelays.length) throw error;
      await sleep(retryDelays[transientRetries]);
      transientRetries += 1;
      continue;
    }

    // Identity tokens can briefly lag behind a refreshed Privy access token.
    // A 401 means no route mutation occurred, so retry once using only the
    // authoritative access token and let the API load that user's identity.
    if (authenticated && response.status === 401 && !authenticationRetried) {
      authenticationRetried = true;
      continue;
    }

    if (
      retryable &&
      TRANSIENT_HTTP_STATUSES.has(response.status) &&
      transientRetries < retryDelays.length
    ) {
      const delay = retryDelayFromResponse(response, retryDelays[transientRetries]);
      transientRetries += 1;
      await sleep(delay);
      continue;
    }

    return response;
  }
}
