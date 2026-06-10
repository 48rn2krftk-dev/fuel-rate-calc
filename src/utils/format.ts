export function formatNumber(value: number): string {
  return value
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")} ч ${String(m).padStart(2, "0")} м`;
}