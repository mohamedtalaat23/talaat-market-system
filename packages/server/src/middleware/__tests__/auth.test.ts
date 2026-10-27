import jwt from 'jsonwebtoken';
import { invalidateAuthCache, requireAuth, requireRoles } from '../auth';
import { AuthorizationError, AuthenticationError } from '../errorHandler';
import { employeeRepository } from '../../repositories/employee.repository';

jest.mock('jsonwebtoken');
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../../config/env', () => ({
  env: { JWT_SECRET: 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  isDev: false,
  isProd: false,
  isTest: true,
}));
jest.mock('../../repositories/employee.repository', () => ({
  employeeRepository: { findById: jest.fn() },
}));

describe('requireRoles (RBAC middleware)', () => {
  it('allows a role present in the allowed list', () => {
    const next = jest.fn();
    const req = { user: { id: 1, username: 'mgr', role: 'manager' } } as any;

    requireRoles('admin', 'manager')(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('denies a role not present in the allowed list', () => {
    const next = jest.fn();
    const req = { user: { id: 1, username: 'cashier', role: 'cashier' } } as any;

    requireRoles('admin', 'manager')(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('denies a request with no authenticated user', () => {
    const next = jest.fn();
    const req = { user: undefined } as any;

    requireRoles('admin')(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });
});

describe('requireAuth (forced password rotation gate)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateAuthCache();
  });

  function mockSignedEmployee(id: number, mustChangePassword: boolean) {
    (jwt.verify as jest.Mock).mockReturnValue({ id, username: `user${id}`, role: 'admin' });
    (employeeRepository.findById as jest.Mock).mockResolvedValue({
      id,
      username: `user${id}`,
      role: 'admin',
      is_active: true,
      deleted_at: null,
      must_change_password: mustChangePassword,
    });
  }

  function buildRequest(url: string) {
    return { headers: { authorization: 'Bearer test-token' }, originalUrl: url } as any;
  }

  it('blocks a flagged account on a regular endpoint with PASSWORD_CHANGE_REQUIRED', async () => {
    mockSignedEmployee(901, true);
    const next = jest.fn();

    await requireAuth(buildRequest('/api/v1/products'), {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeDefined();
    expect(error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(error.statusCode).toBe(403);
  });

  it('allows a flagged account to reach the change-password endpoint', async () => {
    mockSignedEmployee(902, true);
    const next = jest.fn();
    const req = buildRequest('/api/v1/auth/change-password');

    await requireAuth(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.must_change_password).toBe(true);
  });

  it('allows a flagged account to reach /auth/me and /auth/logout', async () => {
    mockSignedEmployee(903, true);

    for (const url of ['/api/v1/auth/me', '/api/v1/auth/logout']) {
      const next = jest.fn();
      await requireAuth(buildRequest(url), {} as any, next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('does not block accounts that have already rotated their password', async () => {
    mockSignedEmployee(904, false);
    const next = jest.fn();

    await requireAuth(buildRequest('/api/v1/products'), {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });
});
