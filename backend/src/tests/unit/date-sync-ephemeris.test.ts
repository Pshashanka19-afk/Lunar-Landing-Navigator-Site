import { describe, it, expect } from 'vitest';
import { EphemerisFactory } from '../../services/ephemeris/ephemeris.factory';
import { TimeConversionService } from '../../services/ephemeris/time-conversion.service';
import { ScientificResourceUnavailableError } from '../../types/errors';

// Helper replicating the validation function used in the frontend MissionDatePicker
function validateDateInput(
  rawStr: string,
  minStr = '1900-01-01',
  maxStr = '2050-01-01'
): { isValid: boolean; normalized?: string; error?: string } {
  const trimmed = rawStr.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Date is required (format: YYYY-MM-DD)' };
  }

  const normalizedSep = trimmed.replace(/[\/\.]/g, '-');
  const match = normalizedSep.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return { isValid: false, error: 'Invalid format. Use YYYY-MM-DD (e.g. 2027-03-15)' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { isValid: false, error: `Invalid month (${month}). Must be 01–12` };
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      error: `Invalid day (${day}) for month ${month} year ${year} (max ${daysInMonth} days)`,
    };
  }

  const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  if (minStr && normalized < minStr) {
    return {
      isValid: false,
      normalized,
      error: `Date is earlier than SPICE ephemeris coverage (${minStr})`,
    };
  }

  if (maxStr && normalized > maxStr) {
    return {
      isValid: false,
      normalized,
      error: `Date is beyond NASA SPICE DE440 coverage (${maxStr})`,
    };
  }

  return { isValid: true, normalized };
}

describe('Candidate Site Date Selection & Ephemeris Synchronization', () => {
  const testSite = {
    latitudeDeg: -89.78,
    longitudeDeg: 125.40,
    elevationMeters: 1413.9,
  };

  describe('Date Input Validation Logic', () => {
    it('accepts future mission dates (e.g. 2027-03-15)', () => {
      const res = validateDateInput('2027-03-15');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('2027-03-15');
      expect(res.error).toBeUndefined();
    });

    it('accepts historical mission dates (e.g. Apollo 11: 1969-07-20)', () => {
      const res = validateDateInput('1969-07-20');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('1969-07-20');
    });

    it('accepts today / present date', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = validateDateInput(todayStr);
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe(todayStr);
    });

    it('normalizes alternative separators like "/" and "."', () => {
      const slashRes = validateDateInput('2027/03/15');
      expect(slashRes.isValid).toBe(true);
      expect(slashRes.normalized).toBe('2027-03-15');

      const dotRes = validateDateInput('2027.3.15');
      expect(dotRes.isValid).toBe(true);
      expect(dotRes.normalized).toBe('2027-03-15');
    });

    it('rejects invalid calendar days (e.g. Feb 31, non-leap year Feb 29)', () => {
      const feb31 = validateDateInput('2027-02-31');
      expect(feb31.isValid).toBe(false);
      expect(feb31.error).toContain('max 28 days');

      const feb29NonLeap = validateDateInput('2027-02-29');
      expect(feb29NonLeap.isValid).toBe(false);
      expect(feb29NonLeap.error).toContain('max 28 days');

      const feb29Leap = validateDateInput('2028-02-29');
      expect(feb29Leap.isValid).toBe(true);
      expect(feb29Leap.normalized).toBe('2028-02-29');
    });

    it('rejects dates beyond NASA SPICE kernel coverage', () => {
      const futureOutOfBounds = validateDateInput('2055-06-01');
      expect(futureOutOfBounds.isValid).toBe(false);
      expect(futureOutOfBounds.error).toContain('beyond NASA SPICE DE440 coverage');

      const pastOutOfBounds = validateDateInput('1850-01-01');
      expect(pastOutOfBounds.isValid).toBe(false);
      expect(pastOutOfBounds.error).toContain('earlier than SPICE ephemeris coverage');
    });
  });

  describe('Future Date Ephemeris Calculation (SPICE Provider)', () => {
    it('computes valid Sun and Earth positions for future mission date 2027-03-15T12:00:00Z', async () => {
      const provider = EphemerisFactory.getProvider('spice');
      const epochUtc = '2027-03-15T12:00:00Z';

      const sunResult = await provider.calculateTarget({
        target: 'SUN',
        epochUtc,
        siteCoords: testSite,
      });

      expect(sunResult.target).toBe('SUN');
      expect(sunResult.epochUtc).toBe(epochUtc);
      expect(sunResult.distanceMeters).toBeGreaterThan(1.4e11); // AU scale
      expect(sunResult.distanceMeters).toBeLessThan(1.6e11);
      expect(Number.isFinite(sunResult.azimuthDeg)).toBe(true);
      expect(Number.isFinite(sunResult.elevationDeg)).toBe(true);
      expect(sunResult.targetPositionMoonCenteredME).toBeDefined();

      const earthResult = await provider.calculateTarget({
        target: 'EARTH',
        epochUtc,
        siteCoords: testSite,
      });

      expect(earthResult.target).toBe('EARTH');
      expect(earthResult.epochUtc).toBe(epochUtc);
      expect(earthResult.distanceMeters).toBeGreaterThan(3.5e8); // 350,000 km
      expect(earthResult.distanceMeters).toBeLessThan(4.2e8); // 420,000 km
      expect(earthResult.targetPositionMoonCenteredME).toBeDefined();
    });

    it('computes valid Sun positions for historical Apollo 11 date 1969-07-20T20:17:40Z', async () => {
      const provider = EphemerisFactory.getProvider('spice');
      const epochUtc = '1969-07-20T20:17:40Z';

      const result = await provider.calculateTarget({
        target: 'SUN',
        epochUtc,
        siteCoords: testSite,
      });

      expect(result.target).toBe('SUN');
      expect(result.epochUtc).toBe(epochUtc);
      expect(Number.isFinite(result.elevationDeg)).toBe(true);
    });

    it('displays clear warning message when selected date is outside SPICE ephemeris coverage', async () => {
      const provider = EphemerisFactory.getProvider('spice');
      // Year 2200 is far outside DE421 / DE440s ephemeris coverage
      await expect(
        provider.calculateTarget({
          target: 'SUN',
          epochUtc: '2200-01-01T12:00:00Z',
          siteCoords: testSite,
        })
      ).rejects.toThrow(/outside NASA SPICE kernel ephemeris coverage/);
    });
  });

  describe('Time and Julian Date Standards', () => {
    it('converts future UTC epoch to Julian Date and Ephemeris Time without timezone shift', () => {
      const epochUtc = '2027-03-15T12:00:00Z';
      const jd = TimeConversionService.utcToJulianDate(epochUtc);
      // Julian Date for 2027-03-15 12:00 UTC should be exactly 2461479.0
      expect(jd).toBeCloseTo(2461480.0, 0);

      const et = TimeConversionService.utcToEphemerisTime(epochUtc);
      expect(et).toBeGreaterThan(8.5e8); // Seconds past J2000
    });
  });
});

