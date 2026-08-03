import express from 'express';
import { eq, ilike, and, or, desc } from 'drizzle-orm';
import { subjects, departments, classes } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';
import { getTableColumns } from 'drizzle-orm';
import { requireRole } from '../middleware/role.js';

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const LimitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * LimitPerPage;
        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            );
        }
        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const subjectList = await db.select({
            ...getTableColumns(subjects),
            department: departments.name,
        }).from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(LimitPerPage)
            .offset(offset);

        res.status(200).json({
            data: subjectList,
            pagination: {
                page: currentPage,
                limit: LimitPerPage,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / LimitPerPage),
            }
        });
    } catch (e) {
        console.error(`"GET /subjects error:", ${e}`);
        res.status(500).json({ error: "Failed to get subjects." });
    }
});

// GET /api/subjects/:id
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid subject ID.' });

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: {
                    id: departments.id,
                    name: departments.name,
                    code: departments.code,
                },
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(eq(subjects.id, id));

        if (!subject) return res.status(404).json({ error: 'Subject not found.' });

        res.status(200).json({ data: subject });
    } catch (e) {
        console.error('GET /subjects/:id error:', e);
        res.status(500).json({ error: 'Failed to get subject.' });
    }
});

// POST /api/subjects (Admin only)
router.post('/', requireRole('admin'), async (req, res) => {
    try {
        const { name, code, description, departmentId } = req.body;

        if (!name || !code || !departmentId) {
            return res.status(400).json({ error: 'name, code, and departmentId are required.' });
        }

        const [newSubject] = await db
            .insert(subjects)
            .values({
                name,
                code: String(code).toUpperCase(),
                description: description || null,
                departmentId: Number(departmentId),
            })
            .returning();

        res.status(201).json({ data: newSubject });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'A subject with that code already exists.' });
        }
        if (e?.code === '23503') {
            return res.status(400).json({ error: 'Department not found.' });
        }
        console.error('POST /subjects error:', e);
        res.status(500).json({ error: 'Failed to create subject.' });
    }
});

// PUT /api/subjects/:id (Admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid subject ID.' });

        const { name, code, description, departmentId } = req.body;
        if (!name || !code || !departmentId) {
            return res.status(400).json({ error: 'name, code, and departmentId are required.' });
        }

        const [updated] = await db
            .update(subjects)
            .set({
                name,
                code: String(code).toUpperCase(),
                description: description ?? null,
                departmentId: Number(departmentId),
            })
            .where(eq(subjects.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Subject not found.' });

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'A subject with that code already exists.' });
        }
        console.error('PUT /subjects/:id error:', e);
        res.status(500).json({ error: 'Failed to update subject.' });
    }
});

// DELETE /api/subjects/:id (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid subject ID.' });

        // Restrict if classes exist
        const [classCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.subjectId, id));

        if (Number(classCount?.count) > 0) {
            return res.status(409).json({
                error: 'Cannot delete subject — it has associated classes. Remove classes first.',
            });
        }

        const [deleted] = await db
            .delete(subjects)
            .where(eq(subjects.id, id))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Subject not found.' });

        res.status(200).json({ data: deleted, message: 'Subject deleted.' });
    } catch (e) {
        console.error('DELETE /subjects/:id error:', e);
        res.status(500).json({ error: 'Failed to delete subject.' });
    }
});

export default router;