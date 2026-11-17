// Regeln für Warnungen (UC8 Mischkultur, UC9 Fruchtfolge, UC11 Frost/Hitze,
// UC15 Sonne/Schatten, Platzbedarf). Reine Funktionen ohne DOM/DB.
export const isActive = (p) => !p.endedAt;
const year = (iso) => Number(iso.slice(0, 4));
const FRUCHTFOLGE_JAHRE = 3;
export const FROST_C = 2;
export const HEAT_C = 30;

const plantMap = (plants) => new Map(plants.map((p) => [p.id, p]));

// Warntexte für ein Beet: schlechte Nachbarn (nur aktive Pflanzungen) und Fruchtfolge.
export function bedWarnings(bedPlantings, plants) {
  const byId = plantMap(plants);
  const active = bedPlantings.filter(isActive);
  const out = [];

  const seen = new Set();
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = byId.get(active[i].plantId);
      const b = byId.get(active[j].plantId);
      if (!a || !b || a.id === b.id) continue;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      if (a.bad?.includes(b.id) || b.bad?.includes(a.id)) {
        seen.add(key);
        out.push(`Schlechte Nachbarn: ${a.name} und ${b.name}`);
      }
    }
  }

  for (const p of active) {
    const info = byId.get(p.plantId);
    if (!info?.family) continue;
    const years = bedPlantings
      .filter((o) => o.id !== p.id && byId.get(o.plantId)?.family === info.family)
      .map((o) => year(o.plantedAt))
      .filter((y) => y < year(p.plantedAt) && y >= year(p.plantedAt) - FRUCHTFOLGE_JAHRE);
    if (years.length) {
      out.push(`Fruchtfolge: ${p.name} (${info.family}) stand hier zuletzt ${Math.max(...years)} – ${FRUCHTFOLGE_JAHRE} Jahre Pause empfohlen`);
    }
  }
  return out;
}

// Platzbedarf grob: Anzahl × Abstand² gegen Beetfläche. Liefert Text oder null.
export function spaceWarning(bed, bedPlantings, plants) {
  const byId = plantMap(plants);
  let needCm2 = 0;
  for (const p of bedPlantings.filter(isActive)) {
    const info = byId.get(p.plantId);
    if (info) needCm2 += (p.count ?? 1) * info.spacingCm ** 2;
  }
  const areaCm2 = (bed.widthCm ?? 100) * (bed.lengthCm ?? 200);
  if (needCm2 <= areaCm2) return null;
  const m2 = (v) => (v / 10000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return `Zu eng bepflanzt: ca. ${m2(needCm2)} m² nötig, Beet hat ${m2(areaCm2)} m²`;
}

// UC15: passt die Pflanze zur Sonnenlage des Beets? Sonnige Beete passen für alle.
export const sunFits = (bed, plant) => (bed.sun ?? 'sonnig') === 'sonnig' || plant.sun === 'halbschattig';

// UC11: Frost-/Hitzewarnungen für die nächsten Tage (nur aktive, empfindliche Pflanzungen).
export function weatherWarnings(plantings, plants, weather) {
  if (!weather) return [];
  const byId = plantMap(plants);
  const days = weather.daily.filter((d) => d.date >= weather.today);
  const names = (flag) => [...new Set(plantings.filter(isActive)
    .filter((p) => byId.get(p.plantId)?.[flag]).map((p) => p.name))];
  const day = (d) => new Date(d.date + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const out = [];

  const frost = days.filter((d) => d.min <= FROST_C);
  const frostNames = names('frostSensitive');
  if (frost.length && frostNames.length) {
    out.push({ type: 'frost', text: `Frostgefahr (${frost.map((d) => `${day(d)}: ${Math.round(d.min)} °C`).join(', ')}) – abdecken: ${frostNames.join(', ')}` });
  }
  const hot = days.filter((d) => d.max >= HEAT_C);
  const heatNames = names('heatSensitive');
  if (hot.length && heatNames.length) {
    out.push({ type: 'heat', text: `Hitze (${hot.map((d) => `${day(d)}: ${Math.round(d.max)} °C`).join(', ')}) – schattieren und gießen: ${heatNames.join(', ')}` });
  }
  return out;
}
