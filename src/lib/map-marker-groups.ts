import type { OzonMapArea, PublicOzonCluster, PublicOzonPoint } from "./ozon-delivery";

/** Merge overlapping supplier clusters and individual markers in screen pixels. */
export function groupMapMarkers(area: OzonMapArea, zoom: number, selectedId?: number): OzonMapArea {
  const scale = 256 * 2 ** zoom;
  const project = (lat: number, long: number) => {
    const sin = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    return [long / 360 * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
  };
  const groups: Array<{ x: number; y: number; cluster: PublicOzonCluster; single?: PublicOzonPoint }> = [];
  const candidates = [
    ...area.clusters.map((cluster) => ({ cluster, single: undefined as PublicOzonPoint | undefined })),
    ...area.points.filter((p) => p.id !== selectedId).map((p) => ({ single: p, cluster: { id: `point-${p.id}`, lat: p.lat, long: p.long, pointsCount: 1, viewport: { south: p.lat, north: p.lat, west: p.long, east: p.long } } })),
  ];
  for (const candidate of candidates) {
    const [x, y] = project(candidate.cluster.lat, candidate.cluster.long);
    const near = groups.find((g) => Math.hypot(g.x - x, g.y - y) < 64);
    if (!near) { groups.push({ x, y, cluster: { ...candidate.cluster, viewport: { ...candidate.cluster.viewport } }, single: candidate.single }); continue; }
    near.single = undefined;
    near.cluster.pointsCount += candidate.cluster.pointsCount;
    const a = near.cluster.viewport, b = candidate.cluster.viewport;
    near.cluster.viewport = { south: Math.min(a.south, b.south), north: Math.max(a.north, b.north), west: Math.min(a.west, b.west), east: Math.max(a.east, b.east) };
  }
  return { points: [...groups.flatMap((g) => g.single ? [g.single] : []), ...area.points.filter((p) => p.id === selectedId)], clusters: groups.filter((g) => !g.single).map((g) => g.cluster) };
}
