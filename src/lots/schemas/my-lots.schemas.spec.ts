import { myLotsQuerySchema } from './my-lots.schemas.js';

describe('myLotsQuerySchema', () => {
  it('coerces and accepts valid pagination parameters', () => {
    expect(myLotsQuerySchema.parse({ page: '2', limit: '10' })).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it('rejects invalid pagination and unrecognized filters', () => {
    expect(myLotsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(myLotsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(
      myLotsQuerySchema.safeParse({ sellerId: 'another-user' }).success,
    ).toBe(false);
  });
});
