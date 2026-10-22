export interface RawPoint {
  lat: number;
  lon: number;
  alt: number;
  timestamp: number;
  accuracy?: number;
}

export interface SmoothedPoint extends RawPoint {
  filtered: boolean;
  kalmanGain?: number;
}

export class SimpleKalmanFilter {
  private q: number;
  private r: number;
  private p: number;
  private x: number;
  private initialized = false;

  constructor(q = 0.001, r = 1) {
    this.q = q;
    this.r = r;
    this.p = 1;
    this.x = 0;
  }

  filter(measurement: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return measurement;
    }

    this.p += this.q;
    const k = this.p / (this.p + this.r);
    this.x += k * (measurement - this.x);
    this.p *= 1 - k;

    return this.x;
  }

  reset(initialValue?: number): void {
    if (initialValue !== undefined) this.x = initialValue;
    this.p = 1;
    this.initialized = !!initialValue;
  }
}

export class TrackKalmanEngine {
  private latFilter: SimpleKalmanFilter;
  private lonFilter: SimpleKalmanFilter;
  private altFilter: SimpleKalmanFilter;
  private lastPoint: RawPoint | undefined;
  private track: SmoothedPoint[] = [];

  constructor(
    processNoise = 0.0001,
    measurementNoise = 10,
    altProcessNoise = 0.01,
    altMeasurementNoise = 5
  ) {
    this.latFilter = new SimpleKalmanFilter(processNoise, measurementNoise);
    this.lonFilter = new SimpleKalmanFilter(processNoise, measurementNoise);
    this.altFilter = new SimpleKalmanFilter(altProcessNoise, altMeasurementNoise);
  }

  processPoint(raw: RawPoint): SmoothedPoint {
    if (!this.lastPoint) {
      this.latFilter.reset(raw.lat);
      this.lonFilter.reset(raw.lon);
      this.altFilter.reset(raw.alt);
      this.lastPoint = raw;
      const smoothed: SmoothedPoint = { ...raw, filtered: true, kalmanGain: 1 };
      this.track.push(smoothed);
      return smoothed;
    }

    const dt = raw.timestamp - this.lastPoint.timestamp;
    if (dt < 100) {
      return { ...this.lastPoint, filtered: false };
    }

    const smoothedLat = this.latFilter.filter(raw.lat);
    const smoothedLon = this.lonFilter.filter(raw.lon);
    const smoothedAlt = this.altFilter.filter(raw.alt);

    this.lastPoint = raw;

    const smoothed: SmoothedPoint = {
      lat: smoothedLat,
      lon: smoothedLon,
      alt: smoothedAlt,
      timestamp: raw.timestamp,
      filtered: true,
    };
    if (raw.accuracy !== undefined) smoothed.accuracy = raw.accuracy;

    this.track.push(smoothed);
    return smoothed;
  }

  getTrack(): SmoothedPoint[] {
    return this.track.map((point) => ({ ...point }));
  }

  clear(): void {
    this.track = [];
    this.lastPoint = undefined;
    this.latFilter.reset();
    this.lonFilter.reset();
    this.altFilter.reset();
  }
}
