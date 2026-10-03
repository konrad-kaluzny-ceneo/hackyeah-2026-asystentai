let fallbackCounter = 0;

export function generateId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    const randomPart = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `${prefix}-${randomPart}`;
  }
  fallbackCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}
