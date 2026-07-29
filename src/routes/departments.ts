import express from 'express';
import { eq, ilike, and, or, desc } from 'drizzle-orm';
import { departments, subjects } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';

const router = express.Router();

// GET /api/departments
router.get('/', async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        if (search) {
            filterConditions.push(
                or(
                    ilike(departments.name, `%${search}%`),
                    ilike(departments.code, `%${search}%`)
                )
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const list = await db
            .select()
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: list,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (e) {
        console.error('GET /departments error:', e);
        res.status(500).json({ error: 'Failed to get departments.' });
    }
});

// GET /api/departments/:id
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid department ID.' });

        const [dept] = await db.select().from(departments).where(eq(departments.id, id));
        if (!dept) return res.status(404).json({ error: 'Department not found.' });

        res.status(200).json({ data: dept });
    } catch (e) {
        console.error('GET /departments/:id error:', e);
        res.status(500).json({ error: 'Failed to get department.' });
    }
});

// POST /api/departments
router.post('/', async (req, res) => {
    try {
        const { code, name, description } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'code and name are required.' });
        }

        const [newDept] = await db
            .insert(departments)
            .values({ code: String(code).toUpperCase(), name, description: description || null })
            .returning();

        res.status(201).json({ data: newDept });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'A department with that code already exists.' });
        }
        console.error('POST /departments error:', e);
        res.status(500).json({ error: 'Failed to create department.' });
    }
});

// PUT /api/departments/:id
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid department ID.' });

        const { code, name, description } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'code and name are required.' });
        }

        const [updated] = await db
            .update(departments)
            .set({ code: String(code).toUpperCase(), name, description: description ?? null })
            .where(eq(departments.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Department not found.' });

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'A department with that code already exists.' });
        }
        console.error('PUT /departments/:id error:', e);
        res.status(500).json({ error: 'Failed to update department.' });
    }
});

// DELETE /api/departments/:id
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid department ID.' });

        // Restrict if subjects exist
        const [subjectCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .where(eq(subjects.departmentId, id));

        if (Number(subjectCount?.count) > 0) {
            return res.status(409).json({
                error: 'Cannot delete department — it has associated subjects. Remove subjects first.',
            });
        }

        const [deleted] = await db
            .delete(departments)
            .where(eq(departments.id, id))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Department not found.' });

        res.status(200).json({ data: deleted, message: 'Department deleted.' });
    } catch (e) {
        console.error('DELETE /departments/:id error:', e);
        res.status(500).json({ error: 'Failed to delete department.' });
    }
});

export default router;
