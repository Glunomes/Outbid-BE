import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { vi } from 'vitest';
import { WalletsController } from './wallets.controller.js';
import type { WalletsService } from './wallets.service.js';

describe('WalletsController.getWallet', () => {
  it('requires JWT authentication', () => {
    const handler = Object.getOwnPropertyDescriptor(
      WalletsController.prototype,
      'getWallet',
    )?.value;
    if (typeof handler !== 'function') {
      throw new Error('getWallet handler is missing.');
    }

    const guards = Reflect.getMetadata('__guards__', handler) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('looks up only the authenticated user wallet', async () => {
    const service = {
      getWallet: vi.fn().mockResolvedValue({
        availableBalance: '0.00',
        reservedBalance: '0.00',
      }),
    };
    const controller = new WalletsController(
      service as unknown as WalletsService,
    );

    await controller.getWallet({
      userId: 'authenticated-user-id',
      email: 'user@example.com',
    });

    expect(service.getWallet).toHaveBeenCalledWith('authenticated-user-id');
  });
});

describe('WalletsController.deposit', () => {
  it('requires JWT authentication', () => {
    const handler = Object.getOwnPropertyDescriptor(
      WalletsController.prototype,
      'deposit',
    )?.value;
    if (typeof handler !== 'function') {
      throw new Error('deposit handler is missing.');
    }

    const guards = Reflect.getMetadata('__guards__', handler) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('deposits only to the authenticated user wallet', async () => {
    const service = {
      deposit: vi.fn().mockResolvedValue({
        availableBalance: '5.00',
        reservedBalance: '0.00',
      }),
    };
    const controller = new WalletsController(
      service as unknown as WalletsService,
    );

    await controller.deposit(
      { userId: 'authenticated-user-id', email: 'user@example.com' },
      { amount: '5.00' },
    );

    expect(service.deposit).toHaveBeenCalledWith(
      '5.00',
      'authenticated-user-id',
    );
  });
});
