const isLocalHostname = (hostname = "") =>
  hostname.includes("localhost") || hostname.includes("127.0.0.1");

export const getBackendBaseUrl = ({ configuredUrl, location }) => {
  // In production, keep every browser request on the PaperCut origin. The
  // hosting layer strips /papercut and Vercel then forwards /api to the API
  // project, avoiding cross-origin failures in embedded browsers.
  if (location?.origin && !isLocalHostname(location.hostname)) {
    return `${location.origin.replace(/\/+$/, "")}/papercut`;
  }

  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return "http://localhost:4000";
};
