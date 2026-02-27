export function randomIntInclusive(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`randomIntInclusive: non-finite bounds min=${min} max=${max}`);
  }
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomDelay(minMs: number, maxMs: number): Promise<number> {
  const ms = randomIntInclusive(minMs, maxMs);
  await delay(ms);
  return ms;
}

