// STUB owned by oks-radial-comp

export interface ItemPosition {
  x: number;
  y: number;
  angle: number;
}

export function layoutItems(
  n: number,
  radius: number,
  startDeg: number,
  endDeg: number
): ItemPosition[] {
  // STUB owned by oks-radial-comp
  const items: ItemPosition[] = [];
  if (n <= 0) return items;
  const step = n === 1 ? 0 : (endDeg - startDeg) / (n - 1);
  for (let i = 0; i < n; i++) {
    const angle = startDeg + i * step;
    const rad = (angle * Math.PI) / 180;
    items.push({
      x: radius * Math.cos(rad),
      y: radius * Math.sin(rad),
      angle,
    });
  }
  return items;
}
