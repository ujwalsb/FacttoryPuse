import { Request, Response } from 'express';
import { User } from '../../models/User.js';
import { Tenant } from '../../models/Tenant.js';
import { AuthService } from '../../services/authService.js';
import { LoginSchema, RegisterUserSchema, UserRole, AuditAction } from '@factorypulse/shared';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { recordAudit } from '../../middleware/audit.js';

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, error: 'User account has been deactivated' });
      return;
    }

    const isMatch = await AuthService.verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify tenant is active if user is not Master Admin
    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'SUSPENDED') {
        res.status(403).json({ success: false, error: 'Company subscription is suspended or inactive' });
        return;
      }
    }

    user.lastLoginAt = new Date();
    const accessToken = AuthService.generateAccessToken(user);
    const refreshToken = AuthService.generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    // Set secure HttpOnly cookie for refresh token
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Record audit event
    await recordAudit(
      { user, headers: req.headers, socket: req.socket } as any,
      AuditAction.USER_LOGIN,
      'User',
      user._id.toString(),
      { email: user.email }
    );

    res.json({
      success: true,
      data: {
        token: accessToken,
        user: {
          id: user._id.toString(),
          tenantId: user.tenantId ? user.tenantId.toString() : undefined,
          tenantName: tenant ? tenant.name : 'Platform Owner',
          name: user.name,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          assignedMachines: user.assignedMachines
        }
      }
    });
  }

  static async register(req: Request, res: Response): Promise<void> {
    const data = RegisterUserSchema.parse(req.body);

    // Security check: Unauthenticated public registration cannot create administrative roles
    if (data.role === UserRole.MASTER_ADMIN || data.role === UserRole.COMPANY_ADMIN) {
      res.status(403).json({
        success: false,
        error: 'Privilege escalation blocked: Administrative accounts cannot be registered via public endpoints. Authorized provisioning is required.'
      });
      return;
    }

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      res.status(409).json({ success: false, error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await AuthService.hashPassword(data.password);

    const newUser = await User.create({
      tenantId: data.tenantId,
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      assignedMachines: data.assignedMachines || []
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    try {
      const decoded = AuthService.verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        res.status(401).json({ success: false, error: 'Invalid or revoked refresh token' });
        return;
      }

      const newAccessToken = AuthService.generateAccessToken(user);
      const newRefreshToken = AuthService.generateRefreshToken(user);

      user.refreshToken = newRefreshToken;
      await user.save();

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        data: {
          token: newAccessToken
        }
      });
    } catch (err) {
      res.status(401).json({ success: false, error: 'Expired or malformed refresh token' });
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save();

      await recordAudit(
        req,
        AuditAction.USER_LOGOUT,
        'User',
        req.user._id.toString()
      );
    }

    res.clearCookie('refresh_token');
    res.json({ success: true, message: 'Successfully logged out' });
  }

  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let tenant = null;
    if (req.user.tenantId) {
      tenant = await Tenant.findById(req.user.tenantId);
    }

    res.json({
      success: true,
      data: {
        id: req.user._id.toString(),
        tenantId: req.user.tenantId ? req.user.tenantId.toString() : undefined,
        tenantName: tenant ? tenant.name : 'Platform Owner',
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        mfaEnabled: req.user.mfaEnabled,
        assignedMachines: req.user.assignedMachines
      }
    });
  }
}
