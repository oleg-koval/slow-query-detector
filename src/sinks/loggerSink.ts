/**
 * Logger-based event sink implementation
 */

import type { IEventSink, ILogger, QueryEvent } from "../types";
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

  handle(event: QueryEvent): void {
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
