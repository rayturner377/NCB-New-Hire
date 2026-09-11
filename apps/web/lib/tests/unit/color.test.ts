import { describe, expect, it } from 'vitest';
import { clampLightnessForDarkMode, hexToHslTriplet } from '../../color';

describe('hexToHslTriplet', () => {
  it('converts a hex color to an h s% l% triplet', () => {
    expect(hexToHslTriplet('#003876')).toBe('212 100% 23%');
  });
});

describe('clampLightnessForDarkMode', () => {
  it('leaves a triplet already within range untouched', () => {
    expect(clampLightnessForDarkMode('211 90% 55%', 50, 70)).toBe('211 90% 55%');
  });

  it('raises a too-dark light-mode color up into a bright dark-mode range', () => {
    // A dark navy brand blue (light-mode primary) would otherwise render as
    // near-black-on-black under .dark's own near-black --primary-foreground.
    expect(clampLightnessForDarkMode('211 100% 23%', 50, 70)).toBe('211 100% 50%');
  });

  it('lowers a too-light light-mode color down into a dark-surface range', () => {
    // A pale light-mode accent would otherwise render as washed-out grey
    // under .dark's own near-white --accent-foreground.
    expect(clampLightnessForDarkMode('210 40% 96%', 12, 22)).toBe('210 40% 22%');
  });

  it('preserves hue and saturation, only adjusting lightness', () => {
    expect(clampLightnessForDarkMode('0 84% 60%', 28, 45)).toBe('0 84% 45%');
  });
});
