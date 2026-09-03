export interface TrailCondition {
  status: 'OPTIMAL' | 'WET_MUD' | 'ICE_SNOW' | 'HEADLAMP_ALERT';
  headline: string;
  advice: string;
  gearRecommendation: string;
  badgeColor: string;
}

export interface MontRoyalWeather {
  currentTempC: number;
  feelsLikeC: number;
  precipitationMm: number;
  snowfallCm: number;
  windSpeedKmh: number;
  weatherCode: number;
  weatherDesc: string;
  weatherEmoji: string;
  sunriseStr: string;
  sunsetStr: string;
  trailCondition: TrailCondition;
  isSunsetNear: boolean;
  lastUpdated: string;
}

const WEATHER_STORAGE_KEY = 'mont_royal_weather_cache_v2';
const CACHE_DURATION_MS = 25 * 60 * 1000; // 25 minutes

function getWeatherEmojiAndDesc(code: number): { emoji: string; desc: string } {
  if (code === 0) return { emoji: '☀️', desc: 'Ciel Dégagé' };
  if (code === 1 || code === 2) return { emoji: '🌤️', desc: 'Partiellement Nuageux' };
  if (code === 3) return { emoji: '☁️', desc: 'Couvert' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: 'Brumeux / Brouillard' };
  if (code >= 51 && code <= 55) return { emoji: '🌦️', desc: 'Bruine Légère' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', desc: 'Pluie' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', desc: 'Chutes de Neige' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', desc: 'Averses de Pluie' };
  if (code >= 85 && code <= 86) return { emoji: '🌨️', desc: 'Averses de Neige' };
  if (code >= 95) return { emoji: '⛈️', desc: 'Orage' };
  return { emoji: '⛅', desc: 'Variable' };
}

export async function fetchMontRoyalWeather(): Promise<MontRoyalWeather> {
  // Check local cache
  try {
    const rawCache = localStorage.getItem(WEATHER_STORAGE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      const cacheAge = Date.now() - new Date(parsed.lastUpdated).getTime();
      if (cacheAge < CACHE_DURATION_MS) {
        return parsed;
      }
    }
  } catch {}

  // Mont-Royal coordinates (Montreal, Quebec)
  const lat = 45.5048;
  const lon = -73.5872;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,snowfall,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=America%2FToronto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.statusText}`);
    const data = await res.json();

    const cur = data.current || {};
    const daily = data.daily || {};

    const temp = Math.round(cur.temperature_2m ?? 14);
    const feels = Math.round(cur.apparent_temperature ?? temp);
    const precip = cur.precipitation ?? 0;
    const snow = cur.snowfall ?? 0;
    const wind = Math.round(cur.wind_speed_10m ?? 10);
    const code = cur.weather_code ?? 0;
    const { emoji, desc } = getWeatherEmojiAndDesc(code);

    const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false }) : '06:15';
    const sunsetDate = daily.sunset?.[0] ? new Date(daily.sunset[0]) : new Date();
    const sunset = sunsetDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Proximité du coucher du soleil (45 min)
    const nowMs = Date.now();
    const sunsetMs = sunsetDate.getTime();
    const isSunsetNear = nowMs >= (sunsetMs - 45 * 60 * 1000);

    // Évaluation des conditions de sentier
    let condition: TrailCondition;

    if (snow > 0.2 || temp <= -2) {
      condition = {
        status: 'ICE_SNOW',
        headline: '❄️ Conditions Hivernales & Neige sur le Mont-Royal',
        advice: 'Sentiers possiblement damés ou verglacés sur les escaliers du versant nord. Attention aux appuis.',
        gearRecommendation: 'Micro-crampons de trail (Kahtoola/Yaktrax) recommandés ou repli sur tapis incliné au Gym ÉTS.',
        badgeColor: '#38bdf8'
      };
    } else if (precip > 2.5 || code >= 61) {
      condition = {
        status: 'WET_MUD',
        headline: '🌧️ Sentiers Humides & Boueux (Dalles Glissantes)',
        advice: 'Racines glissantes et boue sur les sentiers de traverse d\'Olmsted. Vigilance dans les descentes raides.',
        gearRecommendation: 'Chaussures de trail à crampons profonds (Vibram Megagrip) + veste imperméable respirante.',
        badgeColor: '#f59e0b'
      };
    } else if (isSunsetNear) {
      condition = {
        status: 'HEADLAMP_ALERT',
        headline: '🔦 Alerte Crépuscule / Pénombre',
        advice: 'Les sous-bois du Mont-Royal deviennent très sombres dès la disparition du soleil derrière la crête.',
        gearRecommendation: 'Lampe frontale obligatoire (300+ lumens) + éléments réfléchissants sur le sac.',
        badgeColor: '#c084fc'
      };
    } else {
      condition = {
        status: 'OPTIMAL',
        headline: '☀️ Sentiers du Mont-Royal Optimaux',
        advice: 'Sol sec, excellente adhérence et visibilité parfaite pour les séances de côtes et de volume aérobie.',
        gearRecommendation: 'Sac de trail 5L, 2 flasques 500 mL d\'eau/électrolytes, tenue technique légère.',
        badgeColor: '#10b981'
      };
    }

    const result: MontRoyalWeather = {
      currentTempC: temp,
      feelsLikeC: feels,
      precipitationMm: precip,
      snowfallCm: snow,
      windSpeedKmh: wind,
      weatherCode: code,
      weatherDesc: desc,
      weatherEmoji: emoji,
      sunriseStr: sunrise,
      sunsetStr: sunset,
      trailCondition: condition,
      isSunsetNear,
      lastUpdated: new Date().toISOString()
    };

    try {
      localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(result));
    } catch {}

    return result;
  } catch {
    // Secours hors ligne
    return {
      currentTempC: 15,
      feelsLikeC: 14,
      precipitationMm: 0,
      snowfallCm: 0,
      windSpeedKmh: 12,
      weatherCode: 1,
      weatherDesc: 'Ciel Dégagé',
      weatherEmoji: '☀️',
      sunriseStr: '06:15',
      sunsetStr: '19:30',
      trailCondition: {
        status: 'OPTIMAL',
        headline: '☀️ Bonnes Conditions de Sentier',
        advice: 'Adhérence optimale pour les séances d\'entraînement.',
        gearRecommendation: 'Chaussures de trail et 2 flasques souples.',
        badgeColor: '#10b981'
      },
      isSunsetNear: false,
      lastUpdated: new Date().toISOString()
    };
  }
}
