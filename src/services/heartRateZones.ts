export interface AthleteHeartRateZones {
  fcMax: number;
  fcRest: number;
  fcReserve: number;
  zone1: [number, number];
  zone2: [number, number];
  zone3: [number, number];
  zone4: [number, number];
  zone5: [number, number];
}

/** Shared Karvonen (heart-rate-reserve) boundaries for planning and Garmin. */
export function calculateHeartRateZones(fcMax: number, fcRest: number): AthleteHeartRateZones {
  if (!Number.isFinite(fcMax) || !Number.isFinite(fcRest) || fcMax <= fcRest) {
    throw new Error('Invalid athlete heart-rate profile.');
  }
  const fcReserve = fcMax - fcRest;
  const boundary = (fraction: number) => Math.round(fcRest + fraction * fcReserve);
  return {
    fcMax,
    fcRest,
    fcReserve,
    zone1: [boundary(0.50), boundary(0.60)],
    zone2: [boundary(0.60), boundary(0.75)],
    zone3: [boundary(0.75), boundary(0.84)],
    zone4: [boundary(0.84), boundary(0.92)],
    zone5: [boundary(0.92), fcMax]
  };
}
