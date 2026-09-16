import { describe, expect, it } from 'vitest';
import { parseGPXString } from './gpxParser';

describe('parseGPXString', () => {
  const sample = `<?xml version="1.0"?>
    <gpx><trk><name>Morning Run</name><trkseg>
      <trkpt lon="-73.6000" lat="45.5000"><time>2026-09-16T12:00:00Z</time><ele>10</ele></trkpt>
      <trkpt lat="45.5100" lon="-73.6000"><ele>20</ele><time>2026-09-16T12:10:00Z</time></trkpt>
      <trkpt lon="-73.6000" lat="45.5200"><time>2026-09-16T12:20:00Z</time></trkpt>
    </trkseg></trk></g>`;

  it('keeps a stable identity across repeated imports and accepts reordered fields', () => {
    const first = parseGPXString(sample, 'run.gpx');
    const second = parseGPXString(sample, 'run.gpx');

    expect(first.activityId).toBe(second.activityId);
    expect(first.durationMinutes).toBe(20);
    expect(first.distanceKm).toBeGreaterThan(2);
    expect(first.elevationGainM).toBe(10);
    expect(first.startTimeLocal).toBe('2026-09-16T12:00:00.000Z');
  });

  it('rejects files with no usable trackpoint', () => {
    expect(() => parseGPXString('<gpx><trkpt lat="NaN" lon="0"/></gpx>', 'bad.gpx'))
      .toThrow('aucun point');
  });
});
