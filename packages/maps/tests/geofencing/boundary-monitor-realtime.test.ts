import { describe, it, expect } from 'vitest';
import { BoundaryGuard, type BoundaryZone } from '../../src/geofencing/boundary-guard.js';

describe('BoundaryGuard - Real-time Monitoring Implementation', () => {
  const propertyZone: BoundaryZone = {
    id: 'prop-123',
    name: 'Fazenda Exemplo Real-time',
    polygon: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  };

  it('verifies real-time monitor integration: handles sequential updates correctly', () => {
    // 500m warning threshold
    const guard = new BoundaryGuard([propertyZone], { warningThresholdMeters: 500 });

    // Initial position: Inside
    const status1 = guard.evaluateBoundaryPosition([5, 5]);
    expect(status1.alerts[0]!.status).toBe('INSIDE');

    // Outside / Exited
    const status3 = guard.evaluateBoundaryPosition([11, 5]);
    expect(status3.events[0]!.type).toBe('EXITED');
    expect(status3.alerts[0]!.status).toBe('BOUNDARY_CROSSED');
  });
});
