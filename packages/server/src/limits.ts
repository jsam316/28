// Small in-memory limiters. The server is a single process, so plain maps
// are enough; everything here is bounded and cleaned as it goes.

// A token bucket: `capacity` actions in a burst, refilled at `perSecond`.
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number
  ) {
    this.tokens = capacity;
  }

  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// Counts live things per key (e.g. open connections per IP).
export class Counter {
  private counts = new Map<string, number>();

  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  add(key: string): void {
    this.counts.set(key, this.get(key) + 1);
  }

  remove(key: string): void {
    const n = this.get(key) - 1;
    if (n <= 0) this.counts.delete(key);
    else this.counts.set(key, n);
  }
}

// Allows at most `max` events per key in any `windowMs` (e.g. rooms created
// per IP in ten minutes).
export class SlidingWindow {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  tryHit(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  prune(): void {
    const now = Date.now();
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
