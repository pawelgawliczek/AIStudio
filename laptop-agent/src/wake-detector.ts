/**
 * ST-281: Detect hibernation/wake by monitoring time jumps
 *
 * When laptop hibernates, setInterval timers freeze. On wake, we detect
 * a large gap between expected and actual elapsed time.
 */
export class WakeDetector {
  private lastCheckTime: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly THRESHOLD_MS = 30_000; // 30s = likely wake from sleep
  private readonly CHECK_INTERVAL_MS = 10_000; // Check every 10s

  onWakeDetected: (() => void) | null = null;

  start(): void {
    this.lastCheckTime = Date.now();
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastCheckTime;

      // If more time passed than expected + threshold, we likely woke from sleep
      if (elapsed > this.CHECK_INTERVAL_MS + this.THRESHOLD_MS) {
        console.log(`[WakeDetector] Time jump detected: ${elapsed}ms (expected ~${this.CHECK_INTERVAL_MS}ms)`);
        this.onWakeDetected?.();
      }

      this.lastCheckTime = now;
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
