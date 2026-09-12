import { describe, expect, it } from 'vitest';
import { clampLightnessForDarkMode, hexToHslTriplet, hslTripletToHex } from '../../color';

describe('hexToHslTriplet', () => {
  it('converts a pure hue (red)', () => {
    expect(hexToHslTriplet('#ff0000')).toBe('0 100% 50%');
  });

  it('converts a pure hue that hits the green branch of the hue switch', () => {
    expect(hexToHslTriplet('#00ff00')).toBe('120 100% 50%');
  });

  it('converts a pure hue that hits the blue (default) branch of the hue switch', () => {
    expect(hexToHslTriplet('#0000ff')).toBe('240 100% 50%');
  });

  it('returns 0 saturation for a neutral gray (max === min branch)', () => {
    expect(hexToHslTriplet('#808080')).toBe('0 0% 50%');
  });

  it('converts an arbitrary color', () => {
    expect(hexToHslTriplet('#123456')).toBe('210 65% 20%');
  });
});

describe('clampLightnessForDarkMode', () => {
  it('raises a too-dark lightness up to the minimum', () => {
    expect(clampLightnessForDarkMode('210 50% 10%', 30, 70)).toBe('210 50% 30%');
  });

  it('lowers a too-light lightness down to the maximum', () => {
    expect(clampLightnessForDarkMode('210 50% 90%', 30, 70)).toBe('210 50% 70%');
  });

  it('leaves a lightness already within range untouched', () => {
    expect(clampLightnessForDarkMode('210 50% 50%', 30, 70)).toBe('210 50% 50%');
  });

  it('returns the input unchanged when it does not match the expected triplet shape', () => {
    expect(clampLightnessForDarkMode('not a triplet', 30, 70)).toBe('not a triplet');
  });
});

describe('hslTripletToHex', () => {
  it('converts back to hex for a saturated color', () => {
    expect(hslTripletToHex('0 100% 50%')).toBe('#ff0000');
  });

  it('takes the zero-saturation shortcut for a neutral gray', () => {
    expect(hslTripletToHex('0 0% 50%')).toBe('#808080');
  });

  it('falls back to black for an unparseable triplet', () => {
    expect(hslTripletToHex('nonsense')).toBe('#000000');
  });

  it('round-trips hexToHslTriplet -> hslTripletToHex to a visually equivalent color', () => {
    expect(hslTripletToHex(hexToHslTriplet('#123456'))).toBe('#123354');
  });
});
