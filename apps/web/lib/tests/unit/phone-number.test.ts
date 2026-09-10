import { describe, expect, it } from 'vitest';
import { combineContactNumbers } from '../../phone-number';

describe('combineContactNumbers', () => {
  function formData(values: string[], name = 'contactNumber'): FormData {
    const data = new FormData();
    values.forEach((value) => data.append(name, value));
    return data;
  }

  it('joins every entry with the same name', () => {
    expect(combineContactNumbers(formData(['+18761234567', '+18769990000']))).toBe('+18761234567, +18769990000');
  });

  it('drops blank entries', () => {
    expect(combineContactNumbers(formData(['+18761234567', '', '  ']))).toBe('+18761234567');
  });

  it('returns an empty string when nothing was submitted', () => {
    expect(combineContactNumbers(new FormData())).toBe('');
  });

  it('reads from a different field name when given one', () => {
    expect(combineContactNumbers(formData(['+18761234567'], 'emergencyContactNumber'), 'emergencyContactNumber')).toBe(
      '+18761234567'
    );
  });
});
