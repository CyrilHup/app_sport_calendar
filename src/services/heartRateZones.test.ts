import { describe, expect, it } from 'vitest';
import { getAthleteHeartRateZones, getDynamicAthleteProfile } from './garminService';
import { calculateHeartRateZones } from './heartRateZones';
import { createAppConfig, getDailyWorkoutPlan, getPeriodizationContext } from './periodizationEngine';

describe('shared athlete heart-rate zones', () => {
  it('never places a zone above FCmax for a narrow but valid reserve', () => {
    const zones = calculateHeartRateZones(140, 120);
    expect(zones.zone5[0]).toBeLessThanOrEqual(zones.fcMax);
    expect(zones.fcReserve).toBe(20);
  });

  it('uses the same boundaries in the plan and Garmin profile', () => {
    const config = createAppConfig({ fcMax: 180, fcRest: 60 });
    const zones = calculateHeartRateZones(180, 60);
    const garminZones = getAthleteHeartRateZones(getDynamicAthleteProfile([], { fcMax: 180, fcRest: 60 }));
    expect(garminZones).toEqual(zones);

    const date = new Date('2027-01-12T12:00:00');
    const context = getPeriodizationContext(date, config);
    const hill = getDailyWorkoutPlan(1, false, false, context, date, undefined, config);
    const easy = getDailyWorkoutPlan(3, false, false, context, date, undefined, config);
    const long = getDailyWorkoutPlan(5, false, false, context, date, undefined, config);

    expect(hill.targetHeartRateRange).toEqual([zones.zone4[0], zones.zone5[0]]);
    expect(hill.description).toContain('effort perçu');
    expect(easy.targetHeartRateRange).toEqual(zones.zone2);
    expect(long.targetHeartRateRange).toEqual(zones.zone2);
    expect(long.description).toContain('aisance respiratoire');
  });

  it('counts race week by calendar date, including midday on race day', () => {
    const config = createAppConfig({ raceName: 'Course test', raceDate: '2027-07-03' });
    const context = getPeriodizationContext(new Date('2027-07-03T12:00:00'), config);

    expect(context.phase).toBe('RACE_WEEK');
    expect(context.daysToRace).toBe(0);
    expect(context.label).toContain('Course test');
    expect(context.weekNumber).toBeGreaterThan(0);
  });
});
