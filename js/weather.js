// PLZ -> Koordinaten (Zippopotam.us, kennt jede deutsche PLZ) und Wetter (Open-Meteo, UC4).
const ZIP = 'https://api.zippopotam.us/de';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';

// Liefert { zip, name, lat, lon } oder null, wenn die PLZ unbekannt ist.
export async function geocodeZip(zip) {
  const res = await fetch(`${ZIP}/${encodeURIComponent(zip)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('PLZ-Suche fehlgeschlagen');
  const place = (await res.json()).places?.[0];
  if (!place) return null;
  return { zip, name: place['place name'], lat: Number(place.latitude), lon: Number(place.longitude) };
}

// Liefert aktuelles Wetter, Tageswerte der letzten 7 Tage und der nächsten 3 Tage.
export async function fetchWeather({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min',
    past_days: 7,
    forecast_days: 3,
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST}?${params}`);
  if (!res.ok) throw new Error('Wetterabruf fehlgeschlagen');
  const j = await res.json();
  return {
    today: j.current.time.slice(0, 10),
    current: {
      temp: j.current.temperature_2m,
      precipitation: j.current.precipitation,
      wind: j.current.wind_speed_10m,
      text: weatherText(j.current.weather_code),
    },
    daily: j.daily.time.map((date, i) => ({
      date,
      mm: j.daily.precipitation_sum[i] ?? 0,
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
    })),
  };
}

export function weatherText(code) {
  if (code === 0) return 'klar';
  if (code <= 3) return 'bewölkt';
  if (code === 45 || code === 48) return 'Nebel';
  if (code >= 51 && code <= 57) return 'Nieselregen';
  if (code >= 61 && code <= 67) return 'Regen';
  if (code >= 71 && code <= 77) return 'Schnee';
  if (code >= 80 && code <= 82) return 'Regenschauer';
  if (code === 85 || code === 86) return 'Schneeschauer';
  if (code >= 95) return 'Gewitter';
  return 'wechselhaft';
}
