/** Splits a whole number of cents in proportion to the weights, so the parts add back to the total exactly. */
export function shareOut(total: number, weights: number[]) {
  const whole = weights.reduce((sum, weight) => sum + weight, 0);
  if (!whole) return weights.map(() => 0);
  const parts = weights.map((weight) =>
    Number((BigInt(total) * BigInt(weight)) / BigInt(whole)),
  );
  let left = total - parts.reduce((sum, part) => sum + part, 0);
  const byRemainder = weights
    .map((weight, index) => ({
      index,
      remainder: (BigInt(total) * BigInt(weight)) % BigInt(whole),
    }))
    .sort((a, b) =>
      b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0,
    );
  for (const { index } of byRemainder) {
    if (!left) break;
    parts[index]++;
    left--;
  }
  return parts;
}
