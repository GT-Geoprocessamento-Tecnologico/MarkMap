import { GeometrySchema } from '../geometry-helpers';
import { z } from 'zod';

describe('GeometrySchema', () => {
  test('valid Point', () => {
    const result = GeometrySchema.safeParse({ type: 'Point', coordinates: [0, 0] });
    expect(result.success).toBe(true);
  });
  test('invalid Point with wrong coords', () => {
    const result = GeometrySchema.safeParse({ type: 'Point', coordinates: [0] });
    expect(result.success).toBe(false);
  });
  test('valid LineString', () => {
    const result = GeometrySchema.safeParse({ type: 'LineString', coordinates: [[0,0],[1,1]] });
    expect(result.success).toBe(true);
  });
  test('invalid LineString less than 2 points', () => {
    const result = GeometrySchema.safeParse({ type: 'LineString', coordinates: [[0,0]] });
    expect(result.success).toBe(false);
  });
  test('valid Polygon with ring of >=4', () => {
    const result = GeometrySchema.safeParse({ type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] });
    expect(result.success).toBe(true);
  });
  test('invalid Polygon ring <4', () => {
    const result = GeometrySchema.safeParse({ type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] });
    expect(result.success).toBe(false);
  });
});