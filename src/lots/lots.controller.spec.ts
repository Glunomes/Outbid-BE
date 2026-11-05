import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { vi } from 'vitest';
import { LotsController } from './lots.controller.js';
import type { LotsService } from './lots.service.js';

describe('LotsController.getMyLots', () => {
  it('requires JWT authentication', () => {
    const handler = Object.getOwnPropertyDescriptor(
      LotsController.prototype,
      'getMyLots',
    )?.value;
    if (typeof handler !== 'function') {
      throw new Error('getMyLots handler is missing.');
    }

    const guards = Reflect.getMetadata('__guards__', handler) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('passes only the authenticated user ID to the service', async () => {
    const service = {
      getMyLots: vi.fn().mockResolvedValue({ lots: [] }),
    };
    const controller = new LotsController(service as unknown as LotsService);

    await controller.getMyLots(
      { page: 2, limit: 5 },
      { userId: 'authenticated-user-id', email: 'user@example.com' },
    );

    expect(service.getMyLots).toHaveBeenCalledWith('authenticated-user-id', {
      page: 2,
      limit: 5,
    });
  });
});
