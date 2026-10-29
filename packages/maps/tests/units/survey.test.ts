import { describe, expect, it } from 'vitest';
import { 
  convertSqMToHectares, 
  convertHectaresToAlqueire 
} from '../../src/units/survey.js';

describe('Survey Units Conversion', () => {
  it('converts hectares to various Alqueire types correctly', () => {
    expect(convertHectaresToAlqueire(2.42, 'paulista')).toBe(1);
    expect(convertHectaresToAlqueire(4.84, 'mineiro')).toBe(1);
    expect(convertHectaresToAlqueire(9.68, 'baiano')).toBe(1);
    expect(convertHectaresToAlqueire(2.7225, 'norte')).toBe(1);
  });

  it('converts sq meters to hectares', () => {
    expect(convertSqMToHectares(10000)).toBe(1);
  });
});
