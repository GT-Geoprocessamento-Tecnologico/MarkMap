export interface AutomotiveSession {
  platform: "android-auto" | "carplay";
  connected: boolean;
  appVersion: string;
  templateType: "map" | "list" | "navigation" | "place";
  capabilities: Array<"turn-by-turn" | "search" | "destinations" | "voice">;
}

export interface AutomotiveNavigationState {
  active: boolean;
  distanceToNextManeuver: number;
  nextManeuverType: string;
  nextRoadName?: string;
  totalDistanceRemaining: number;
  etaSeconds: number;
  currentSpeedKph: number;
  offRoute: boolean;
}

export interface AutomotiveAdapter {
  isSupported(): boolean;
  startSession(): Promise<AutomotiveSession>;
  endSession(): Promise<void>;
  updateNavigation(state: AutomotiveNavigationState): void;
  showDestination(lon: number, lat: number, name: string): void;
  onManeuverChange(callback: (state: AutomotiveNavigationState) => void): void;
}

export class AndroidAutoAdapter implements AutomotiveAdapter {
  private session: AutomotiveSession | null = null;
  private callback: ((state: AutomotiveNavigationState) => void) | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "androidAuto" in window;
  }

  async startSession(): Promise<AutomotiveSession> {
    if (!this.isSupported()) {
      throw new Error("Android Auto not supported on this platform");
    }
    this.session = {
      platform: "android-auto",
      connected: true,
      appVersion: "1.0.0",
      templateType: "map",
      capabilities: ["turn-by-turn", "search", "destinations", "voice"],
    };
    return this.session;
  }

  async endSession(): Promise<void> {
    this.session = null;
  }

  updateNavigation(state: AutomotiveNavigationState): void {
    this.callback?.(state);
  }

  showDestination(lon: number, lat: number, name: string): void {
    if (typeof window !== "undefined" && "androidAuto" in window) {
      (window as Record<string, unknown>).androidAuto = {
        action: "showDestination",
        lon,
        lat,
        name,
      };
    }
  }

  onManeuverChange(callback: (state: AutomotiveNavigationState) => void): void {
    this.callback = callback;
  }
}

export class CarPlayAdapter implements AutomotiveAdapter {
  private session: AutomotiveSession | null = null;
  private callback: ((state: AutomotiveNavigationState) => void) | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "carplay" in window;
  }

  async startSession(): Promise<AutomotiveSession> {
    if (!this.isSupported()) {
      throw new Error("CarPlay not supported on this platform");
    }
    this.session = {
      platform: "carplay",
      connected: true,
      appVersion: "1.0.0",
      templateType: "map",
      capabilities: ["turn-by-turn", "search", "destinations", "voice"],
    };
    return this.session;
  }

  async endSession(): Promise<void> {
    this.session = null;
  }

  updateNavigation(state: AutomotiveNavigationState): void {
    this.callback?.(state);
  }

  showDestination(lon: number, lat: number, name: string): void {
    if (typeof window !== "undefined" && "carplay" in window) {
      (window as Record<string, unknown>).carplay = {
        action: "showDestination",
        lon,
        lat,
        name,
      };
    }
  }

  onManeuverChange(callback: (state: AutomotiveNavigationState) => void): void {
    this.callback = callback;
  }
}
