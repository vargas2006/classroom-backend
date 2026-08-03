import express from 'express';
import { or, eq, ilike, desc, and, getTableColumns } from 'drizzle-orm';
import { user, account } from '../db/schema/index.js';
import { classes } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';
import { createId } from '@paralleldrive/cuid2';
import { requireRole } from '../middleware/role.js';

const router = express.Router();

// GET /api/users (Admin & Teacher only)
router.get('/', requireRole('admin', 'teacher'), async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const LimitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * LimitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`)
                )
            );
        }

        if (role) {
            filterConditions.push(eq(user.role, String(role) as 'student' | 'teacher' | 'admin'));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const userList = await db
            .select({ ...getTableColumns(user) })
            .from(user)
            .where(whereClause)
            .orderBy(desc(user.createdAt))
            .limit(LimitPerPage)
            .offset(offset);

        res.status(200).json({
            data: userList,
            pagination: {
                page: currentPage,
                limit: LimitPerPage,
                total: totalCount,
                totalPages: Math.ceil(Number(totalCount) / LimitPerPage),
            },
        });
    } catch (e) {
        console.error(`"GET /users error:", ${e}`);
        res.status(500).json({ error: 'Failed to get users.' });
    }
});

// POST /api/users — Admin creates a user directly (no auth flow)
router.post('/', requireRole('admin'), async (req, res) => {
    try {
        const { name, email, role, password } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ error: 'name, email, and role are required.' });
        }

        const validRoles = ['admin', 'teacher', 'student'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
        }

        // Check if email already exists
        const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase()));
        if (existing) {
            return res.status(409).json({ error: 'A user with that email already exists.' });
        }

        const newId = createId();
        const now = new Date();

        // Insert into user table
        const [newUser] = await db.insert(user).values({
            id: newId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            emailVerified: false,
            role: role as 'admin' | 'teacher' | 'student',
            createdAt: now,
            updatedAt: now,
        }).returning();

        // If a password was provided, create a credential account entry
        if (password && password.length >= 6) {
            const { hashPassword } = await import('better-auth/crypto');
            const hashed = await hashPassword(password);
            await db.insert(account).values({
                id: createId(),
                userId: newId,
                accountId: newId,
                providerId: 'credential',
                password: hashed,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoNothing();
        }

        res.status(201).json({ data: newUser });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'A user with that email already exists.' });
        }
        console.error('POST /users error:', e);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});


// GET /api/users/:id
router.get('/:id', async (req, res) => {
    try {
        const id = String(req.params.id);

        const [foundUser] = await db
            .select({ ...getTableColumns(user) })
            .from(user)
            .where(eq(user.id, id));

        if (!foundUser) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ data: foundUser });
    } catch (e) {
        console.error('GET /users/:id error:', e);
        res.status(500).json({ error: 'Failed to get user.' });
    }
});

// PUT /api/users/:id (Admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = String(req.params.id);
        const { name, role, image, imageCldPubId } = req.body;

        if (!name) return res.status(400).json({ error: 'name is required.' });

        const updateData: Record<string, any> = { name };
        if (role) updateData.role = role;
        if (image !== undefined) updateData.image = image || null;
        if (imageCldPubId !== undefined) updateData.imageCldPubId = imageCldPubId || null;

        const [updated] = await db
            .update(user)
            .set(updateData)
            .where(eq(user.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error('PUT /users/:id error:', e);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

// PATCH /api/users/:id — Self-profile update (name + image only, no role change)
router.patch('/:id', async (req, res) => {
    try {
        const id = String(req.params.id);
        if (req.user?.id !== id && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { name, image, imageCldPubId } = req.body;

        if (!name || String(name).trim().length < 2) {
            return res.status(400).json({ error: 'name is required (min 2 characters).' });
        }

        const updateData: Record<string, any> = { name: String(name).trim() };
        if (image !== undefined) updateData.image = image || null;
        if (imageCldPubId !== undefined) updateData.imageCldPubId = imageCldPubId || null;

        const [updated] = await db
            .update(user)
            .set(updateData)
            .where(eq(user.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error('PATCH /users/:id error:', e);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// POST /api/users/:id/change-password
router.post('/:id/change-password', async (req, res) => {
    try {
        const id = String(req.params.id);
        if (req.user?.id !== id && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'newPassword must be at least 6 characters.' });
        }

        // Fetch the credential account for this user
        const [credAccount] = await db
            .select({ password: account.password })
            .from(account)
            .where(eq(account.userId, id))
            .limit(1);

        if (!credAccount?.password) {
            return res.status(404).json({ error: 'No password credential found for this user.' });
        }

        const { hashPassword, verifyPassword } = await import('better-auth/crypto');
        const isValid = await verifyPassword({ hash: credAccount.password, password: String(currentPassword) });
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashed = await hashPassword(String(newPassword));
        await db
            .update(account)
            .set({ password: hashed })
            .where(eq(account.userId, id));

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (e) {
        console.error('POST /users/:id/change-password error:', e);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = String(req.params.id);

        // Restrict if user is a teacher with active classes
        const [classCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.teacherId, id));

        if (Number(classCount?.count) > 0) {
            return res.status(409).json({
                error: 'Cannot delete user — they are assigned as teacher to one or more classes. Reassign classes first.',
            });
        }

        const [deleted] = await db
            .delete(user)
            .where(eq(user.id, id))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ data: deleted, message: 'User deleted.' });
    } catch (e) {
        console.error('DELETE /users/:id error:', e);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

export default router;
