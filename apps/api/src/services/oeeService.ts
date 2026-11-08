import { IOEEMetrics } from '@factorypulse/shared';

export class OEEService {
  /**
   * Computes OEE components using exact industrial formulas.
   *
   * Availability = (Operating Time / Planned Production Time) * 100
   * Performance = (Total Processed * Ideal Cycle Time seconds) / (Operating Time seconds) * 100
   * Quality = (Good Units / Total Processed) * 100
   * OEE = (Availability * Performance * Quality) / 10000
   */
  static calculateOEE(params: {
    operatingTimeMinutes: number;
    plannedTimeMinutes: number;
    downtimeMinutes: number;
    goodCount: number;
    rejectCount: number;
    idealCycleTimeSeconds: number;
    periodStart?: string;
    periodEnd?: string;
  }): IOEEMetrics {
    const {
      operatingTimeMinutes,
      plannedTimeMinutes,
      downtimeMinutes,
      goodCount,
      rejectCount,
      idealCycleTimeSeconds,
      periodStart = new Date().toISOString(),
      periodEnd = new Date().toISOString()
    } = params;

    const totalProcessedCount = goodCount + rejectCount;

    // 1. Availability calculation
    let availability = 100;
    if (plannedTimeMinutes > 0) {
      availability = Math.min(100, Math.max(0, (operatingTimeMinutes / plannedTimeMinutes) * 100));
    }

    // 2. Performance calculation
    let performance = 100;
    const operatingTimeSeconds = operatingTimeMinutes * 60;
    if (operatingTimeSeconds > 0 && totalProcessedCount > 0) {
      const standardOperatingSeconds = totalProcessedCount * idealCycleTimeSeconds;
      performance = Math.min(100, Math.max(0, (standardOperatingSeconds / operatingTimeSeconds) * 100));
    } else if (totalProcessedCount === 0) {
      performance = 0;
    }

    // 3. Quality calculation
    let quality = 100;
    if (totalProcessedCount > 0) {
      quality = Math.min(100, Math.max(0, (goodCount / totalProcessedCount) * 100));
    }

    // 4. Overall Equipment Effectiveness (OEE)
    const oee = Math.min(100, Math.max(0, (availability * performance * quality) / 10000));

    return {
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: Math.round(quality * 10) / 10,
      oee: Math.round(oee * 10) / 10,
      operatingTimeMinutes: Math.round(operatingTimeMinutes),
      plannedTimeMinutes: Math.round(plannedTimeMinutes),
      downtimeMinutes: Math.round(downtimeMinutes),
      totalProcessedCount,
      goodCount,
      rejectCount,
      idealCycleTimeSeconds,
      periodStart,
      periodEnd
    };
  }
}
