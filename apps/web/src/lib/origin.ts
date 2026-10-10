export type OriginHeaders = {
  origin: string | null;
  host: string | null;
  secFetchSite: string | null;
};

/**
 * CSRF defence for state-changing requests. Browsers always tell us where a request came from:
 * accept only requests that originate from our own site.
 */
export function isSameOrigin({ origin, host, secFetchSite }: OriginHeaders): boolean {
  if (secFetchSite) return secFetchSite === "same-origin";
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function originHeadersFrom(request: Request): OriginHeaders {
  return {
    origin: request.headers.get("origin"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  };
}
