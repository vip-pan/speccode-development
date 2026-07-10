const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForPrMerge(opts = {}) {
  const {
    query,
    sleep = realSleep,
    intervalMs = 30000,
    timeoutMs = 1800000,
  } = opts;

  let elapsed = 0;
  let polls = 0;
  for (;;) {
    polls += 1;
    const state = await query();
    if (state === 'MERGED') return { outcome: 'MERGED', polls };
    if (state === 'CLOSED') return { outcome: 'CLOSED', polls };
    if (state === 'CONFLICTING') return { outcome: 'CONFLICTING', polls };
    if (elapsed >= timeoutMs) return { outcome: 'TIMEOUT', polls };
    await sleep(intervalMs);
    elapsed += intervalMs;
  }
}
