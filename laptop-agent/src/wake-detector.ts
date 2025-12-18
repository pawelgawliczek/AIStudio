/**
 * ST-281: Detect hibernation/wake by monitoring time jumps
 *
 * When laptop hibernates, setInterval timers freeze. On wake, we detect
 * a large gap between expected and actual elapsed time.
 */
import { Logger } from './logger';

export class WakeDetector {
  private lastCheckTime: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly THRESHOLD_MS = 30_000; // 30s = likely wake from sleep
  private readonly CHECK_INTERVAL_MS = 10_000; // Check every 10s
  private readonly logger = new Logger('WakeDetector');

  onWakeDetected: (() => void) | null = null;

  start(): void {
    this.lastCheckTime = Date.now();
    this.logger.info('Wake detector started', {
      checkIntervalMs: this.CHECK_INTERVAL_MS,
      thresholdMs: this.THRESHOLD_MS
    });
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastCheckTime;

      // If more time passed than expected + threshold, we likely woke from sleep
      if (elapsed > this.CHECK_INTERVAL_MS + this.THRESHOLD_MS) {
        this.logger.info('Time jump detected - possible wake from hibernation', {
          elapsedMs: elapsed,
          expectedMs: this.CHECK_INTERVAL_MS,
          thresholdMs: this.THRESHOLD_MS,
        });
        this.onWakeDetected?.();
      }

      this.lastCheckTime = now;
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Wake detector stopped');
    }
  }
}
