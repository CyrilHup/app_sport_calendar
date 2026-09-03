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

const WEATHER_STORAGE_KEY = 'mont_royal_weather_cache_v1';
const CACHE_DURATION_MS = 25 * 60 * 1000; // 25 minutes

function getWeatherEmojiAndDesc(code: number): { emoji: string; desc: string } {
  if (code === 0) return { emoji: '☀️', desc: 'Clear Skies' };
  if (code === 1 || code === 2) return { emoji: '🌤️', desc: 'Partly Cloudy' };
  if (code === 3) return { emoji: '☁️', desc: 'Overcast' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: 'Foggy' };
  if (code >= 51 && code <= 55) return { emoji: '🌦️', desc: 'Light Drizzle' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', desc: 'Rain' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', desc: 'Snowfall' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', desc: 'Rain Showers' };
  if (code >= 85 && code <= 86) return { emoji: '🌨️', desc: 'Snow Showers' };
  if (code >= 95) return { emoji: '⛈️', desc: 'Thunderstorm' };
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

    const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '06:15';
    const sunsetDate = daily.sunset?.[0] ? new Date(daily.sunset[0]) : new Date();
    const sunset = sunsetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Check sunset proximity
    const nowMs = Date.now();
    const sunsetMs = sunsetDate.getTime();
    const isSunsetNear = nowMs >= (sunsetMs - 45 * 60 * 1000);

    // Determine trail condition
    let condition: TrailCondition;

    if (snow > 0.2 || temp <= -2) {
      condition = {
        status: 'ICE_SNOW',
        headline: '❄️ Winter Conditions & Packed Snow on Mont-Royal',
        advice: 'Trails may feature hard-packed snow or black ice on northern stair slopes.',
        gearRecommendation: 'Traction micro-spikes (Kahtoola/Yaktrax) recommended or switch to ÉTS treadmill incline power block.',
        badgeColor: '#38bdf8'
      };
    } else if (precip > 2.5 || code >= 61) {
      condition = {
        status: 'WET_MUD',
        headline: '🌧️ Wet & Muddy Trails (Limestone Slopes)',
        advice: 'Slippery roots and slick mud on Olmsted bypass trails. Watch your footing on descents.',
        gearRecommendation: 'Aggressive trail lugs (Vibram Megagrip) + breathable waterproof shell jacket.',
        badgeColor: '#f59e0b'
      };
    } else if (isSunsetNear) {
      condition = {
        status: 'HEADLAMP_ALERT',
        headline: '🔦 Twilight / Night Trail Advisory',
        advice: 'Mont-Royal summit paths get completely dark once the sun drops below the tree line.',
        gearRecommendation: 'Mandatory headlamp (300+ lumens, Petzl/Black Diamond) + reflective ultra vest.',
        badgeColor: '#c084fc'
      };
    } else {
      condition = {
        status: 'OPTIMAL',
        headline: '☀️ Prime Mont-Royal Trail Conditions',
        advice: 'Dry dirt paths, optimal grip and high visibility for hill repeats and aerobic base volume.',
        gearRecommendation: 'Standard trail pack, 500ml water flasque with electrolytes, light technical tee.',
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
    // Fallback if offline
    return {
      currentTempC: 15,
      feelsLikeC: 14,
      precipitationMm: 0,
      snowfallCm: 0,
      windSpeedKmh: 12,
      weatherCode: 1,
      weatherDesc: 'Clear',
      weatherEmoji: '☀️',
      sunriseStr: '06:15',
      sunsetStr: '19:30',
      trailCondition: {
        status: 'OPTIMAL',
        headline: '☀️ Good Trail Running Conditions',
        advice: 'Optimal ground grip for training sessions.',
        gearRecommendation: 'Trail footwear and hydration pack.',
        badgeColor: '#10b981'
      },
      isSunsetNear: false,
      lastUpdated: new Date().toISOString()
    };
  }
}
