import { describe, expect, it } from 'vitest';

import { checkDimensions, hasDimensionConstraint, parseAspectRatio } from './dimensions';

describe('assets/dimensions', () => {
  describe('parseAspectRatio', () => {
    it('parses W:H', () => {
      expect(parseAspectRatio('16:9')).toBeCloseTo(16 / 9);
    });

    it('parses W/H', () => {
      expect(parseAspectRatio('4/3')).toBeCloseTo(4 / 3);
    });

    it('accepts a plain number', () => {
      expect(parseAspectRatio(1.5)).toBe(1.5);
      expect(parseAspectRatio('1.5')).toBe(1.5);
    });

    it('rejects garbage / non-positive', () => {
      expect(parseAspectRatio('abc')).toBeUndefined();
      expect(parseAspectRatio('16:0')).toBeUndefined();
      expect(parseAspectRatio(0)).toBeUndefined();
    });
  });

  describe('checkDimensions', () => {
    it('passes an exact aspect ratio', () => {
      expect(checkDimensions({ width: 1920, height: 1080 }, { aspect_ratio: '16:9' })).toBe(true);
    });

    it('passes within the 1% tolerance', () => {
      // 1921×1080 is off 16:9 by ~0.05% — still accepted.
      expect(checkDimensions({ width: 1921, height: 1080 }, { aspect_ratio: '16:9' })).toBe(true);
    });

    it('fails a wrong aspect ratio', () => {
      expect(checkDimensions({ width: 1000, height: 1000 }, { aspect_ratio: '16:9' })).toBe(false);
    });

    it('fails below the resolution floor', () => {
      expect(checkDimensions({ width: 400, height: 225 }, { min_width: 800 })).toBe(false);
      expect(checkDimensions({ width: 1600, height: 200 }, { min_height: 450 })).toBe(false);
    });

    it('passes above the resolution floor', () => {
      expect(checkDimensions({ width: 1600, height: 900 }, { min_width: 800, min_height: 450 })).toBe(
        true,
      );
    });

    it('fails above the resolution ceiling', () => {
      expect(checkDimensions({ width: 5000, height: 5000 }, { max_width: 4096 })).toBe(false);
    });

    it('combines aspect ratio and resolution floor', () => {
      const config = { aspect_ratio: '16:9', min_width: 1280 };

      expect(checkDimensions({ width: 1920, height: 1080 }, config)).toBe(true);
      expect(checkDimensions({ width: 640, height: 360 }, config)).toBe(false); // right AR, too small
    });

    it('passes when no constraint is set', () => {
      expect(checkDimensions({ width: 1, height: 1 }, {})).toBe(true);
    });

    it('fails open on undecodable dimensions', () => {
      expect(checkDimensions({ width: 0, height: 0 }, { aspect_ratio: '16:9' })).toBe(true);
    });
  });

  describe('hasDimensionConstraint', () => {
    it('is true when any constraint is set', () => {
      expect(hasDimensionConstraint({ min_width: 800 })).toBe(true);
      expect(hasDimensionConstraint({ aspect_ratio: '16:9' })).toBe(true);
    });

    it('is false when empty or absent', () => {
      expect(hasDimensionConstraint({})).toBe(false);
      expect(hasDimensionConstraint(undefined)).toBe(false);
      expect(hasDimensionConstraint({ max_file_size: 500000 })).toBe(false);
    });
  });
});
