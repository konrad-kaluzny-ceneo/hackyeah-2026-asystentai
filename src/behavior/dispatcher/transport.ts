import type { MetaEventBatchPayload } from "../types";

export interface Transport {
  /**
   * Attempts to deliver the batch. Resolves true on success (HTTP 2xx),
   * false on failure (network error, non-2xx). Never throws.
   */
  send(payload: MetaEventBatchPayload): Promise<boolean>;
}

export interface TransportOptions {
  readonly endpoint: string;
  readonly fetchImpl?: typeof fetch;
  readonly sendBeacon?: (url: string, data: string) => boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Delivery transport for meta event batches. Uses `fetch` first so an HTTP
 * rejection is observable, then falls back to `sendBeacon` only when no fetch
 * response can be obtained (for example while the page is unloading).
 */
export function createTransport(options: TransportOptions): Transport {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const sendBeacon =
    options.sendBeacon ??
    (typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
      ? (url: string, data: string) =>
          navigator.sendBeacon(
            url,
            new Blob([data], { type: "application/json" }),
          )
      : undefined);

  return {
    async send(payload: MetaEventBatchPayload): Promise<boolean> {
      let body: string;
      try {
        body = JSON.stringify(payload);
      } catch {
        return false;
      }
      if (fetchImpl !== undefined) {
        try {
          const response = await fetchImpl(options.endpoint, {
            method: "POST",
            headers: JSON_HEADERS,
            body,
            keepalive: true,
          });
          return response.ok;
        } catch {
          if (isDocumentExiting()) {
            return deliverWithBeacon(sendBeacon, options.endpoint, body);
          }
          // An active page can still wait for a response without keepalive.
          try {
            const response = await fetchImpl(options.endpoint, {
              method: "POST",
              headers: JSON_HEADERS,
              body,
            });
            return response.ok;
          } catch {
            // Continue to sendBeacon when no HTTP response was available.
          }
        }
      }
      return deliverWithBeacon(sendBeacon, options.endpoint, body);
    },
  };
}

function isDocumentExiting(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "hidden"
  );
}

function deliverWithBeacon(
  sendBeacon: TransportOptions["sendBeacon"],
  endpoint: string,
  body: string,
): boolean {
  if (sendBeacon === undefined) {
    return false;
  }
  try {
    return sendBeacon(endpoint, body);
  } catch {
    return false;
  }
}
