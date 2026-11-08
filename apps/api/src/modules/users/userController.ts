import { Response } from 'express';
import { User } from '../../models/User.js';
import { AuthService } from '../../services/authService.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { RegisterUserSchema, UserRole, AuditAction } from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';

export class UserController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    // When Super Admin queries users, only return admins (MASTER_ADMIN and COMPANY_ADMIN)
    if (req.user?.role === UserRole.MASTER_ADMIN) {
      if (req.query.role && (req.query.role === UserRole.MASTER_ADMIN || req.query.role === UserRole.COMPANY_ADMIN)) {
        filter.role = req.query.role;
      } else {
        filter.role = { $in: [UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN] };
      }
    } else if (req.query.role) {
      filter.role = req.query.role;
    }

    const users = await User.find(filter)
      .populate('tenantId', 'name code')
      .populate('assignedMachines', 'name assetId')
      .select('-passwordHash -refreshToken')
      .sort({ name: 1 });

    res.json({ success: true, data: users });
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = RegisterUserSchema.parse(req.body);
    const isMasterAdmin = req.user?.role === UserRole.MASTER_ADMIN;

    // Privilege escalation prevention: Non-Master Admins cannot create MASTER_ADMIN accounts
    if (!isMasterAdmin && data.role === UserRole.MASTER_ADMIN) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot assign MASTER_ADMIN role' });
      return;
    }

    // Tenant isolation: Non-Master Admins can only create users in their own tenant
    const tenantId = isMasterAdmin ? (data.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context is required' });
      return;
    }

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      res.status(409).json({ success: false, error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await AuthService.hashPassword(data.password);

    const newUser = await User.create({
      ...data,
      tenantId,
      passwordHash
    });

    await recordAudit(
      req,
      AuditAction.USER_CREATED,
      'User',
      newUser._id.toString(),
      { email: newUser.email, role: newUser.role, name: newUser.name }
    );

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive
      }
    });
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const isMasterAdmin = req.user?.role === UserRole.MASTER_ADMIN;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const existingUser = await User.findOne(filter);
    if (!existingUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Protection against modifying a MASTER_ADMIN by non-Master Admins
    if (!isMasterAdmin && existingUser.role === UserRole.MASTER_ADMIN) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot modify a MASTER_ADMIN account' });
      return;
    }

    const updates: any = { ...req.body };
    delete updates.passwordHash;
    delete updates.refreshToken;

    // Privilege escalation prevention
    if (!isMasterAdmin) {
      if (updates.role === UserRole.MASTER_ADMIN) {
        res.status(403).json({ success: false, error: 'Forbidden: Cannot elevate role to MASTER_ADMIN' });
        return;
      }
      delete updates.tenantId; // Non-Master Admin cannot reassign tenants
    }

    if (updates.password) {
      updates.passwordHash = await AuthService.hashPassword(updates.password);
      delete updates.password;
    }

    const user = await User.findOneAndUpdate(filter, updates, { new: true })
      .select('-passwordHash -refreshToken');

    await recordAudit(
      req,
      AuditAction.USER_UPDATED,
      'User',
      existingUser._id.toString(),
      { email: user?.email, role: user?.role, name: user?.name, updates: Object.keys(updates) }
    );

    res.json({ success: true, data: user });
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const isMasterAdmin = req.user?.role === UserRole.MASTER_ADMIN;

    // Prevent self-deletion
    if (req.user?.id === id) {
      res.status(400).json({ success: false, error: 'Security policy: You cannot delete your own active user account.' });
      return;
    }

    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const targetUser = await User.findOne(filter);
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Protection against deleting a MASTER_ADMIN by non-Master Admins
    if (!isMasterAdmin && targetUser.role === UserRole.MASTER_ADMIN) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot delete a MASTER_ADMIN account' });
      return;
    }

    // Prevent deletion of the sole master admin
    if (targetUser.role === UserRole.MASTER_ADMIN) {
      const masterCount = await User.countDocuments({ role: UserRole.MASTER_ADMIN });
      if (masterCount <= 1) {
        res.status(400).json({ success: false, error: 'Cannot delete the sole Platform Owner Master Admin account.' });
        return;
      }
    }

    await User.deleteOne({ _id: id });

    await recordAudit(
      req,
      AuditAction.USER_DELETED,
      'User',
      id,
      { email: targetUser.email, role: targetUser.role, name: targetUser.name }
    );

    res.json({ success: true, message: `User account '${targetUser.email}' permanently deleted.` });
  }

  static async toggleStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { isActive } = req.body;
    const isMasterAdmin = req.user?.role === UserRole.MASTER_ADMIN;

    if (req.user?.id === id && isActive === false) {
      res.status(400).json({ success: false, error: 'Security policy: You cannot deactivate your own user account.' });
      return;
    }

    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const existingUser = await User.findOne(filter);
    if (!existingUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (!isMasterAdmin && existingUser.role === UserRole.MASTER_ADMIN) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot alter status of a MASTER_ADMIN account' });
      return;
    }

    const user = await User.findOneAndUpdate(filter, { isActive }, { new: true })
      .select('-passwordHash -refreshToken');

    res.json({ success: true, data: user });
  }
}
