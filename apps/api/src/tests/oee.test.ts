import { OEEService } from '../services/oeeService.js';

describe('OEEService Calculation Engine', () => {
  it('correctly calculates Availability, Performance, Quality, and OEE with nominal metrics', () => {
    // 480 min planned, 420 min operating, 60 min downtime
    // Good count: 2000, Rejects: 100 => Total: 2100
    // Ideal cycle time: 10s
    // Availability = (420 / 480) * 100 = 87.5%
    // Standard operating sec = 2100 * 10 = 21000s; Operating sec = 420 * 60 = 25200s
    // Performance = (21000 / 25200) * 100 = 83.3%
    // Quality = (2000 / 2100) * 100 = 95.2%
    // OEE = 87.5% * 83.3% * 95.2% = 69.4%
    const result = OEEService.calculateOEE({
      operatingTimeMinutes: 420,
      plannedTimeMinutes: 480,
      downtimeMinutes: 60,
      goodCount: 2000,
      rejectCount: 100,
      idealCycleTimeSeconds: 10
    });

    expect(result.availability).toBe(87.5);
    expect(result.performance).toBe(83.3);
    expect(result.quality).toBe(95.2);
    expect(result.oee).toBe(69.4);
    expect(result.totalProcessedCount).toBe(2100);
  });

  it('handles edge cases with zero counts and planned time safely without division by zero', () => {
    const result = OEEService.calculateOEE({
      operatingTimeMinutes: 0,
      plannedTimeMinutes: 0,
      downtimeMinutes: 0,
      goodCount: 0,
      rejectCount: 0,
      idealCycleTimeSeconds: 10
    });

    expect(result.availability).toBe(100);
    expect(result.performance).toBe(0);
    expect(result.quality).toBe(100);
    expect(result.oee).toBe(0);
  });

  it('handles 100% perfect shift throughput', () => {
    const result = OEEService.calculateOEE({
      operatingTimeMinutes: 480,
      plannedTimeMinutes: 480,
      downtimeMinutes: 0,
      goodCount: 2880,
      rejectCount: 0,
      idealCycleTimeSeconds: 10
    });

    expect(result.availability).toBe(100);
    expect(result.performance).toBe(100);
    expect(result.quality).toBe(100);
    expect(result.oee).toBe(100);
  });
});
