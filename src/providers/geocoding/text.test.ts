import { describe, expect, it } from 'vitest';
import { translateCountry } from './text';

describe('translateCountry', () => {
  it('translates a trailing Vietnamese country name', () => {
    expect(translateCountry('Bangkok thái lan')).toBe('Bangkok Thailand');
    expect(translateCountry('Tokyo Nhật Bản')).toBe('Tokyo Japan');
    expect(translateCountry('Seoul hàn quốc')).toBe('Seoul South Korea');
    expect(translateCountry('Paris nước Pháp')).toBe('Paris France');
  });

  it('leaves Vietnamese place names alone', () => {
    expect(translateCountry('Phước Mỹ')).toBe('Phước Mỹ');
    expect(translateCountry('Lào Cai')).toBe('Lào Cai');
    expect(translateCountry('Đức Trọng')).toBe('Đức Trọng');
    expect(translateCountry('thái lan')).toBe('thái lan');
    expect(translateCountry('Đà Nẵng')).toBe('Đà Nẵng');
  });
});
