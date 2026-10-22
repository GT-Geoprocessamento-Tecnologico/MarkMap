import { parseNmeaSentence, type GnssFix } from "./nmea.js";

type Listener = (fix: GnssFix) => void;

export class GnssDeviceAdapter {
  private listeners: Listener[] = [];
  private buffer = "";

  on(event: "fix", listener: Listener): void {
    if (event === "fix") {
      this.listeners.push(listener);
    }
  }

  pushChunk(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("$")) {
        const fix = parseNmeaSentence(trimmed);
        if (fix && fix.fixQuality !== "INVALID") {
          for (const listener of this.listeners) {
            listener(fix);
          }
        }
      }
    }
  }
}
