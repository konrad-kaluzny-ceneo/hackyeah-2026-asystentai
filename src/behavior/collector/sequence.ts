/**
 * Monotonic sequence counter for raw events within a session. Not persisted —
 * gaps after a tab crash are acceptable because the field exists to detect
 * buffer loss, not to be a ledger.
 */
export class Sequence {
  private next = 0;

  getNext(): number {
    const value = this.next;
    this.next += 1;
    return value;
  }

  /** Test-only hook. */
  reset(): void {
    this.next = 0;
  }
}
