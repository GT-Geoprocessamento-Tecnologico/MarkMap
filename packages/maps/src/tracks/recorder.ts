import { TrackKalmanEngine, type RawPoint, type SmoothedPoint } from "./kalman.js";

export interface TrackMetadata {
  id: string;
  name: string;
  startTime: number;
}

export class TrackRecorder {
  private engine: TrackKalmanEngine;
  private metadata?: TrackMetadata;
  private isRecording: boolean = false;

  constructor(metadata: TrackMetadata) {
    this.metadata = metadata;
    this.engine = new TrackKalmanEngine();
  }

  start(): void {
    this.isRecording = true;
  }

  stop(): SmoothedPoint[] {
    this.isRecording = false;
    return this.engine.getTrack();
  }

  addPoint(point: RawPoint): SmoothedPoint | null {
    if (!this.isRecording) return null;
    return this.engine.processPoint(point);
  }

  getTrack(): SmoothedPoint[] {
    return this.engine.getTrack();
  }

  clear(): void {
    this.engine.clear();
  }
}
