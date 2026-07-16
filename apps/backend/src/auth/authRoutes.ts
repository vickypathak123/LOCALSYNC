import crypto from 'crypto';
import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Server } from 'socket.io';
import {
  createOwner,
  getOwnerByEmail,
  createOrg,
  getOrgById,
  validateInviteCode,
  createAgent,
  getAgentById,
  isAgentEmailTaken,
  isAgentPhoneTaken,
  createAgentInvite,
  getAgentByEmail,
  getAgentByPhone,
  updateAgentPasswordHash,
  activateAgentPassword,
  listAgentsByOrg,
  approveAgent,
  rejectAgent,
  updateAgentDetails,
  archiveAgent,
  restoreAgent,
  deleteAgent,
} from './orgStore';
import { authMiddleware, AuthedRequest } from './authMiddleware';
import { sendAgentInviteEmail } from './mailer';
import { parseAgent, getAllAgents } from '../core/agentStore';

const SALT_ROUNDS = 8;
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateTempPassword(length = 10): string {
  return Array.from(crypto.randomBytes(length))
    .map((b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length])
    .join('');
}

function agentLoginUrl(): string {
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/agent/login`;
}

export function createAuthRoutes(io: Server): Router {
  const router = Router();

  router.post('/owner/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password, and name are required' });
      }

      const existing = await getOwnerByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Owner with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const ownerId = await createOwner(email, passwordHash, name);
      const token = jwt.sign({ id: ownerId, role: 'owner' }, process.env.JWT_SECRET as string, {
        expiresIn: '24h',
      });

      res.json({ ownerId, token, name });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Registration failed' });
    }
  });

  router.post('/owner/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
      }

      const owner = await getOwnerByEmail(email);
      if (!owner) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, owner.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: owner.ownerId, role: 'owner', orgId: owner.orgId },
        process.env.JWT_SECRET as string,
        { expiresIn: '24h' }
      );

      res.json({ ownerId: owner.ownerId, orgId: owner.orgId, token, name: owner.name });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  router.post('/org/create', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can create an organization' });
      }

      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const { orgId, inviteCode } = await createOrg(req.user.id, name);

      // The register-time token predates the org and carries no orgId claim.
      // Mint a fresh one now so the client can swap it in and immediately use
      // org-scoped endpoints (e.g. /api/agent/invite) without a re-login.
      const token = jwt.sign({ id: req.user.id, role: 'owner', orgId }, process.env.JWT_SECRET as string, {
        expiresIn: '24h',
      });

      res.json({ orgId, inviteCode, token });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Org creation failed' });
    }
  });

  router.get('/org/me', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can view organization details' });
      }
      if (!req.user.orgId) {
        return res.status(404).json({ error: 'No organization yet' });
      }

      const org = await getOrgById(req.user.orgId);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json(org);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load organization' });
    }
  });

  // --- Self-serve agent registration (invite code) — used by the Android app ---

  router.post('/agent/register', async (req, res) => {
    try {
      const { inviteCode, name, mobile, password } = req.body;
      if (!inviteCode || !name || !mobile || !password) {
        return res.status(400).json({ error: 'inviteCode, name, mobile, and password are required' });
      }

      const orgId = await validateInviteCode(inviteCode);
      if (!orgId) {
        return res.status(400).json({ error: 'Invalid invite code' });
      }

      if (await isAgentPhoneTaken(mobile)) {
        return res.status(400).json({ error: 'An agent with this mobile number already exists' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const agentId = await createAgent(orgId, name, passwordHash, mobile);

      // No token here — the account needs owner approval before it can log in.
      // Broadcast so the owner's dashboard shows the pending registration live.
      io.emit('agents:sync', await getAllAgents());

      res.json({
        agentId,
        orgId,
        accountStatus: 'pending_approval',
        message: 'Your registration is pending admin approval. You will be able to log in once an owner approves your account.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Agent registration failed' });
    }
  });

  router.post('/agent/login', async (req, res) => {
    try {
      const { agentId: bodyAgentId, email, mobile, password } = req.body;
      if ((!bodyAgentId && !email && !mobile) || !password) {
        return res.status(400).json({ error: 'mobile (or email, or agentId) and password are required' });
      }

      // mobile (phone) is the primary path for invite-code self-registered agents;
      // email/agentId remain for the owner-invited web onboarding portal and the
      // original Android contract, respectively — additive, not breaking.
      const byMobile = mobile ? await getAgentByPhone(mobile) : null;
      const byEmail = !mobile && email ? await getAgentByEmail(email) : null;
      const resolvedAgentId: string | undefined = byMobile?.agentId ?? byEmail?.agentId ?? bodyAgentId;
      const agent =
        byMobile ?? byEmail ?? (resolvedAgentId ? await getAgentById(resolvedAgentId) : null);

      if (!agent || !resolvedAgentId) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, agent.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (agent.accountStatus === 'pending_approval') {
        return res.status(403).json({
          error: 'Your account is pending admin approval. Please wait until your registration is approved.',
          accountStatus: 'pending_approval',
        });
      }
      if (agent.accountStatus === 'rejected') {
        return res.status(403).json({
          error: 'Your registration was not approved. Please contact your organization owner.',
          accountStatus: 'rejected',
        });
      }

      const token = jwt.sign(
        { id: resolvedAgentId, role: 'agent', orgId: agent.orgId },
        process.env.JWT_SECRET as string,
        { expiresIn: '24h' }
      );

      res.json({
        agentId: resolvedAgentId,
        orgId: agent.orgId,
        token,
        accountStatus: agent.accountStatus || 'active',
        mustResetPassword: agent.accountStatus === 'invited',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Agent login failed' });
    }
  });

  // --- Owner-initiated email invite (dashboard "Agents" module) ---

  router.post('/agent/invite', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can invite agents' });
      }
      if (!req.user.orgId) {
        return res.status(400).json({ error: 'Create an organization before inviting agents' });
      }

      const { email, name } = req.body;
      if (!email || !name) {
        return res.status(400).json({ error: 'email and name are required' });
      }

      if (await isAgentEmailTaken(email)) {
        return res.status(400).json({ error: 'An agent with this email already exists' });
      }

      const org = await getOrgById(req.user.orgId);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
      const agentId = await createAgentInvite(req.user.orgId, email, name, passwordHash);

      await sendAgentInviteEmail({
        to: email,
        agentName: name,
        orgName: org.name,
        tempPassword,
        loginUrl: agentLoginUrl(),
      });

      io.emit('agents:sync', await getAllAgents());

      res.json({ agentId, email, name, accountStatus: 'invited' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Agent invite failed' });
    }
  });

  router.post('/agent/resend-invite', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can resend invites' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (agent.accountStatus !== 'invited') {
        return res.status(400).json({ error: 'Only email-invited agents awaiting first login can be re-invited' });
      }

      const org = await getOrgById(req.user.orgId as string);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
      await updateAgentPasswordHash(agentId, passwordHash);

      await sendAgentInviteEmail({
        to: agent.email,
        agentName: agent.name,
        orgName: org.name,
        tempPassword,
        loginUrl: agentLoginUrl(),
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Resend invite failed' });
    }
  });

  // --- Admin approval for self-registered (invite-code) agents ---

  router.post('/agent/approve', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can approve agent registrations' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (agent.accountStatus !== 'pending_approval') {
        return res.status(400).json({ error: 'This agent is not awaiting approval' });
      }

      await approveAgent(agentId);
      io.emit('agent:approved', { agentId, name: agent.name, orgId: agent.orgId });
      io.emit('agents:sync', await getAllAgents());

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Approve failed' });
    }
  });

  router.post('/agent/reject', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can reject agent registrations' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (agent.accountStatus !== 'pending_approval') {
        return res.status(400).json({ error: 'This agent is not awaiting approval' });
      }

      await rejectAgent(agentId);
      io.emit('agents:sync', await getAllAgents());

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Reject failed' });
    }
  });

  // --- Agent record management: View (no endpoint needed — already in the client's agent list), Edit, Archive, Delete ---

  router.post('/agent/update', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can edit agents' });
      }

      const { agentId, name, phone, email } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      if (email !== undefined && email !== agent.email && email !== '') {
        if (await isAgentEmailTaken(email)) {
          return res.status(400).json({ error: 'An agent with this email already exists' });
        }
      }
      if (phone !== undefined && phone !== agent.phone && phone !== '') {
        if (await isAgentPhoneTaken(phone)) {
          return res.status(400).json({ error: 'An agent with this mobile number already exists' });
        }
      }

      await updateAgentDetails(agentId, { name, phone, email }, agent.email || '', agent.phone || '');
      io.emit('agents:sync', await getAllAgents());

      const updated = await getAgentById(agentId);
      res.json(updated ? parseAgent(agentId, updated) : { ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Update failed' });
    }
  });

  router.post('/agent/archive', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can archive agents' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      await archiveAgent(agentId);
      io.emit('agents:sync', await getAllAgents());

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Archive failed' });
    }
  });

  router.post('/agent/restore', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can restore agents' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      await restoreAgent(agentId);
      io.emit('agents:sync', await getAllAgents());

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Restore failed' });
    }
  });

  router.post('/agent/delete', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can delete agents' });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const agent = await getAgentById(agentId);
      if (!agent || agent.orgId !== req.user.orgId) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      await deleteAgent(agentId, agent.email || '', agent.phone || '');
      io.emit('agents:sync', await getAllAgents());

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Delete failed' });
    }
  });

  router.post('/agent/set-password', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'agent') {
        return res.status(403).json({ error: 'Only agents can set their password this way' });
      }

      const { newPassword, confirmPassword } = req.body;
      if (!newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'newPassword and confirmPassword are required' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const agentId = req.user.id;
      const agent = await getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await activateAgentPassword(agentId, passwordHash);

      io.emit('agent:activated', {
        agentId,
        name: agent.name,
        email: agent.email,
        orgId: agent.orgId,
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Set password failed' });
    }
  });

  // --- Agents management list (dashboard "Agents" tab) ---

  router.get('/org/agents', authMiddleware, async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can list org agents' });
      }
      if (!req.user.orgId) {
        return res.json([]);
      }

      const rawAgents = await listAgentsByOrg(req.user.orgId);
      const agents = rawAgents.map(({ agentId, ...raw }) => parseAgent(agentId, raw));
      res.json(agents);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list agents' });
    }
  });

  return router;
}
