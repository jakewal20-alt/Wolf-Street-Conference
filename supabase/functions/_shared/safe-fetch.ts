/**
 * Fetch a user-supplied URL without letting it reach internal services (SSRF).
 *
 * - http/https only, default ports only
 * - hostname must resolve exclusively to public IP addresses
 * - redirects are followed manually (max 5) and every hop is re-checked
 * - response body is capped
 */

const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 15_000;

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],        // "this" network
  ["10.0.0.0", 8],       // private
  ["100.64.0.0", 10],    // carrier-grade NAT
  ["127.0.0.0", 8],      // loopback
  ["169.254.0.0", 16],   // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],    // private
  ["192.0.0.0", 24],     // IETF protocol assignments
  ["192.0.2.0", 24],     // documentation
  ["192.168.0.0", 16],   // private
  ["198.18.0.0", 15],    // benchmarking
  ["198.51.100.0", 24],  // documentation
  ["203.0.113.0", 24],   // documentation
  ["224.0.0.0", 4],      // multicast
  ["240.0.0.0", 4],      // reserved + broadcast
];

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return BLOCKED_V4.some(([base, bits]) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (addr === "::" || addr === "::1") return true;
  // IPv4-mapped / -compatible (::ffff:10.0.0.1)
  const mapped = addr.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  const first = parseInt(addr.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Non-standard ports are not allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Internal hostnames are not allowed");
  }

  let addresses: string[];
  if (ipv4ToInt(host) !== null) {
    addresses = [host];
  } else if (host.includes(":")) {
    addresses = [host];
  } else {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    addresses = [...v4, ...v6];
    if (addresses.length === 0) throw new UnsafeUrlError("Could not resolve host");
  }

  for (const ip of addresses) {
    const blocked = ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
    if (blocked) throw new UnsafeUrlError("URL points to a private or internal address");
  }
  return url;
}

export async function safeFetchText(
  rawUrl: string,
  init: { headers?: Record<string, string>; maxBytes?: number } = {},
): Promise<{ response: Response; text: string; finalUrl: string }> {
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      headers: init.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new UnsafeUrlError("Redirect without a location");
      current = new URL(location, url).toString();
      continue;
    }

    // Read the body with a size cap.
    let text = "";
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          break; // keep what we have; pages are truncated, not rejected
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
    return { response, text, finalUrl: url.toString() };
  }
  throw new UnsafeUrlError("Too many redirects");
}
