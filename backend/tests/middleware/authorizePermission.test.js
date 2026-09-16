import { describe, expect, it } from 'vitest';
import { authorizePermission } from '../../src/middleware/auth.js';

const execute = (handler, user) => new Promise((resolve) => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve({ nextCalled: false, ...this });
    },
  };

  handler({ user }, response, () => resolve({ nextCalled: true, ...response }));
});

describe('authorizePermission', () => {
  it('autorise le comptable à inscrire un élève', async () => {
    const result = await execute(
      authorizePermission('inscription.creer'),
      {
        role: 'comptable',
        permissions: ['inscription.creer'],
      }
    );

    expect(result.nextCalled).toBe(true);
  });

  it('refuse au secrétaire la création d’une inscription', async () => {
    const result = await execute(
      authorizePermission('inscription.creer'),
      {
        role: 'secretaire',
        permissions: ['inscription.creer'],
      }
    );

    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it('refuse au censeur l’encaissement même si son profil est altéré', async () => {
    const result = await execute(
      authorizePermission('caisse.gerer'),
      {
        role: 'censeur',
        permissions: ['caisse.gerer'],
      }
    );

    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(403);
  });
});