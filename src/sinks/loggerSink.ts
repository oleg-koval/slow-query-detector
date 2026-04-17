/**
 * Logger-based event sink implementation
 */

import type { DetectorEvent, IEventSink, ILogger } from "../types";
import { DEFAULT_CONFIG } from "../config";

/**
 * Logger sink that logs events using injected logger
 */
export class LoggerSink implements IEventSink {
  constructor(
    private readonly logger: ILogger,
    private readonly config: {
      sampleRateNormal?: number;
      sampleRateSlow?: number;
    },
  ) {}

  handle(event: DetectorEvent): void {
    if (event.event === "db.request.budget") {
      this.logger.warn(event);
      return;
    }

    const sampleRateNormal = this.config.sampleRateNormal ?? DEFAULT_CONFIG.sampleRateNormal;

    switch (event.subtype) {
      case "error":
        this.logger.error(event);
        break;

      case "slow":
      case "very_slow":
        this.logger.warn(event);
        break;

      case "normal":
        // Sample normal queries
        if (Math.random() < sampleRateNormal) {
          this.logger.info(event);
        }
        break;
    }
  }
}
