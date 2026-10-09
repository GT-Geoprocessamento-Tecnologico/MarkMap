import { describe, it, expect } from 'vitest';
import { profileFromFeatures } from './track-elevation';

describe('offline GPX/KML altitude profile',()=>{
  const line = (coords: number[][]) => ({ geometry: { type: 'LineString', coordinates: coords } });
  it('calculates ascent/descent and distance without DEM',()=>{
    const result=profileFromFeatures([line([[-48.2,-7.2,300],[-48.21,-7.21,330],[-48.22,-7.22,320]])]);
    expect(result).not.toBeNull();
    expect(result!.ascent).toBe(30);
    expect(result!.descent).toBe(10);
    expect(result!.totalDistanceKm).toBeGreaterThan(0);
    expect(result!.minElevation).toBe(300);
  });
  it('does not bridge disjoint segments or invent missing altitude',()=>{
    const multi={ geometry: { type:'MultiLineString', coordinates:[
      [[0,0,10],[0.01,0.01,20]], [[60,60,50],[60.01,60.01,55]],
    ] } };
    const result=profileFromFeatures([multi]);
    expect(result?.ascent).toBe(15);
    expect(result?.totalDistanceKm).toBeLessThan(4);
    expect(profileFromFeatures([line([[0,0],[0.01,0.01]])])).toBeNull();
  });
});
