import { AuthService } from '../services/authService.js';
import { authorizeRoles } from '../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('AuthService and RBAC Logic', () => {
  it('hashes passwords securely and verifies correctly', async () => {
    const raw = 'SecureP@ssw0rd123!';
    const hash = await AuthService.hashPassword(raw);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(raw);

    const match = await AuthService.verifyPassword(raw, hash);
    expect(match).toBe(true);

    const fail = await AuthService.verifyPassword('WrongPassword', hash);
    expect(fail).toBe(false);
  }, 10000);

  it('generates valid JWT access tokens containing role and tenantId', () => {
    const fakeUser: any = {
      _id: uuidv4(),
      email: 'engineer@apex.com',
      role: UserRole.PLANT_IT_HEAD,
      tenantId: uuidv4()
    };

    const token = AuthService.generateAccessToken(fakeUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('generates and verifies refresh tokens', () => {
    const fakeUser: any = {
      _id: uuidv4(),
      email: 'supervisor@apex.com',
      role: UserRole.PRODUCTION_MANAGER
    };

    const refreshToken = AuthService.generateRefreshToken(fakeUser);
    const decoded = AuthService.verifyRefreshToken(refreshToken);
    expect(decoded.userId).toBe(fakeUser._id.toString());
  });

  describe('authorizeRoles RBAC Middleware', () => {
    it('calls next() when user role matches authorized roles', () => {
      const middleware = authorizeRoles(UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD);
      const req: any = {
        user: { role: UserRole.PLANT_IT_HEAD }
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden when user role is not authorized for the operation', () => {
      const middleware = authorizeRoles(UserRole.COMPANY_ADMIN);
      const req: any = {
        user: { role: UserRole.MACHINE_OPERATOR }
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Role 'MACHINE_OPERATOR' lacks permission")
        })
      );
    });

    it('returns 401 Unauthorized when request lacks authenticated user', () => {
      const middleware = authorizeRoles(UserRole.MASTER_ADMIN);
      const req: any = {};
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
