import { type Card, RANKS, SUITS } from './types.js';

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// A uniform float in [0, 1) from the platform's cryptographic generator.
// Math.random (xorshift128+ in V8) can be reconstructed from enough observed
// outputs, which would let a patient attacker who watches their own deals
// predict everyone else's hands; the Web Crypto generator cannot be. Both
// browsers and Node 20+ expose it as globalThis.crypto.
export function secureRandom(): number {
  const c = (globalThis as { crypto?: { getRandomValues<T extends ArrayBufferView>(a: T): T } }).crypto;
  if (!c?.getRandomValues) return Math.random();
  const buf = new Uint32Array(2);
  c.getRandomValues(buf);
  // 53 random bits: 27 from the first word, 26 from the second.
  return ((buf[0] >>> 5) * 67108864 + (buf[1] >>> 6)) / 9007199254740992;
}

export function shuffle<T>(items: T[], rng: () => number = secureRandom): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
