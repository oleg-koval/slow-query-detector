/**
 * High-resolution timer for query duration measurement
 */

/**
 * Start a high-resolution timer
 * @returns Function that returns duration in milliseconds
 */
export function startTimer(): () => number {
  const start = process.hrtime.bigint();

  return (): number => {
    const end = process.hrtime.bigint();
    const durationNs = end - start;
    const oneMillion = BigInt(1000000);
    return Number(durationNs / oneMillion);
  };
}
