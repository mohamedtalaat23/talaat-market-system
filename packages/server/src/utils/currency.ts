/**
 * Banker's Rounding (Round-Half-To-Even)
 * Rounds to the nearest even number when the fraction is exactly 0.5.
 * Eliminates upward rounding bias in large, high-volume financial transactions.
 */
export function bankersRound(num: number, decimals: number = 2): number {
  const m = Math.pow(10, decimals);
  const n = +(num * m).toFixed(8); // Shift decimal to prevent float issues
  const i = Math.floor(n);
  const f = n - i;
  const e = 1e-9; // Floating point epsilon
  
  const r = (f - 0.5 < -e) 
    ? i 
    : (f - 0.5 > e) 
      ? i + 1 
      : (i % 2 === 0) 
        ? i 
        : i + 1;
        
  return r / m;
}
