// Gießlogik (UC3 + UC5): reine Funktionen ohne DOM/DB.
const INTERVAL_DAYS = { hoch: 2, mittel: 4, gering: 7 };
const RAIN_MM = 5; // ab dieser Tagesmenge zählt Regen als Gießen

const DAY = 86400000;
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const fmt = (iso) => new Date(iso + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// plant: Eintrag aus plants.json oder undefined (eigene Pflanze -> "mittel")
// weather: Ergebnis von fetchWeather oder null (dann nur Intervall)
// Rückgabe: { state: 'ok' | 'due' | 'wait', text }
export function wateringStatus(planting, plant, weather, todayFallback) {
  const today = weather?.today ?? todayFallback;
  const interval = INTERVAL_DAYS[plant?.water ?? 'mittel'];
  const last = planting.lastWateredAt ?? planting.plantedAt;

  const rainDays = (weather?.daily ?? [])
    .filter((d) => d.date <= today && d.date >= last && d.mm >= RAIN_MM)
    .map((d) => d.date);
  const lastRain = rainDays.at(-1);
  const effective = lastRain && lastRain > last ? lastRain : last;
  const rainNote = effective !== last ? ` (Regen am ${fmt(effective)} berücksichtigt)` : '';

  const daysLeft = dayDiff(today, addDays(effective, interval));
  if (daysLeft > 0) {
    return { state: 'ok', text: `Nächstes Gießen in ${daysLeft} Tag${daysLeft === 1 ? '' : 'en'}${rainNote}` };
  }
  const tomorrow = weather?.daily.find((d) => d.date === addDays(today, 1));
  if (tomorrow && tomorrow.mm >= RAIN_MM) {
    return { state: 'wait', text: `Gießen fällig, aber morgen Regen angekündigt (${tomorrow.mm} mm) – abwarten` };
  }
  return {
    state: 'due',
    text: daysLeft === 0 ? 'Heute gießen' : `Gießen überfällig seit ${-daysLeft} Tag${daysLeft === -1 ? '' : 'en'}`,
  };
}
