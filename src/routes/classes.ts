import express from 'express';
import { or, eq, ilike, desc, and, getTableColumns } from 'drizzle-orm';
import { classes, departments, subjects, enrollments } from '../db/schema/index.js';
import { user } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';
import crypto from 'crypto';

const router = express.Router();

// GET /api/classes
router.get('/', async (req, res) => {
    try {
        const { search, subject, teacher, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const LimitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * LimitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(classes.name, `%${search}%`),
                    ilike(classes.inviteCode, `%${search}%`)
                )
            );
        }
        if (subject) {
            const subjectPattern = `%${String(subject).replace(/[%_]/g, '')}%`;
            filterConditions.push(ilike(subjects.name, subjectPattern));
        }
        if (teacher) {
            const teacherPattern = `%${String(teacher).replace(/[%_]/g, '')}%`;
            filterConditions.push(ilike(user.name, teacherPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const classList = await db
            .select({
                ...getTableColumns(classes),
                subject: {
                    id: subjects.id,
                    name: subjects.name,
                    code: subjects.code,
                },
                teacher: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                },
                enrollmentCount: sql<number>`(
                    SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ${classes.id}
                )`,
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause)
            .orderBy(desc(classes.createdAt))
            .limit(LimitPerPage)
            .offset(offset);

        res.status(200).json({
            data: classList,
            pagination: {
                page: currentPage,
                limit: LimitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / LimitPerPage),
            },
        });
    } catch (e) {
        console.error(`"GET /classes error:", ${e}`);
        res.status(500).json({ error: 'Failed to get classes.' });
    }
});

// GET /api/classes/:id
router.get('/:id', async (req, res) => {
    try {
        const classId = Number(req.params.id);

        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'No Class Found.' });

        const [classDetails] = await db
            .select({
                ...getTableColumns(classes),
                subject: {
                    ...getTableColumns(subjects),
                },
                department: {
                    ...getTableColumns(departments),
                },
                teacher: {
                    ...getTableColumns(user),
                },
                enrollmentCount: sql<number>`(
                    SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ${classId}
                )`,
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(eq(classes.id, classId));

        if (!classDetails) return res.status(404).json({ error: 'No class found.' });

        res.status(200).json({ data: classDetails });
    } catch (e) {
        console.error(`"GET /classes/:id error:", ${e}`);
        res.status(500).json({ error: 'Failed to get class details.' });
    }
});

// POST /api/classes
router.post('/', async (req, res) => {
    try {
        const {
            name,
            subjectId,
            teacherId,
            description,
            capacity,
            status,
            bannerUrl,
            bannerCldPubId,
            inviteCode,
            schedules,
        } = req.body;

        if (!name || !subjectId || !teacherId) {
            res.status(400).json({ error: 'name, subjectId, and teacherId are required.' });
            return;
        }

        const code = inviteCode || crypto.randomBytes(4).toString('hex').toUpperCase();

        const [newClass] = await db
            .insert(classes)
            .values({
                name,
                subjectId: Number(subjectId),
                teacherId,
                description: description || null,
                capacity: capacity ? Number(capacity) : 50,
                status: status || 'active',
                bannerUrl: bannerUrl || null,
                bannerCldPubId: bannerCldPubId || null,
                inviteCode: code,
                schedules: schedules || [],
            })
            .returning();

        res.status(201).json({ data: newClass });
    } catch (e) {
        console.error(`"POST /classes error:", ${e}`);
        res.status(500).json({ error: 'Failed to create class.' });
    }
});

// PUT /api/classes/:id
router.put('/:id', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const {
            name,
            subjectId,
            teacherId,
            description,
            capacity,
            status,
            bannerUrl,
            bannerCldPubId,
            schedules,
        } = req.body;

        if (!name || !subjectId || !teacherId) {
            return res.status(400).json({ error: 'name, subjectId, and teacherId are required.' });
        }

        const [updated] = await db
            .update(classes)
            .set({
                name,
                subjectId: Number(subjectId),
                teacherId,
                description: description ?? null,
                capacity: capacity ? Number(capacity) : 50,
                status: status || 'active',
                bannerUrl: bannerUrl ?? null,
                bannerCldPubId: bannerCldPubId ?? null,
                schedules: schedules || [],
            })
            .where(eq(classes.id, classId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Class not found.' });

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error('PUT /classes/:id error:', e);
        res.status(500).json({ error: 'Failed to update class.' });
    }
});

// DELETE /api/classes/:id
router.delete('/:id', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const [deleted] = await db
            .delete(classes)
            .where(eq(classes.id, classId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Class not found.' });

        res.status(200).json({ data: deleted, message: 'Class deleted.' });
    } catch (e) {
        console.error('DELETE /classes/:id error:', e);
        res.status(500).json({ error: 'Failed to delete class.' });
    }
});

// POST /api/classes/:id/regenerate-invite
router.post('/:id/regenerate-invite', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const [updated] = await db
            .update(classes)
            .set({ inviteCode: newCode })
            .where(eq(classes.id, classId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Class not found.' });

        res.status(200).json({ data: updated, inviteCode: newCode });
    } catch (e) {
        console.error('POST /classes/:id/regenerate-invite error:', e);
        res.status(500).json({ error: 'Failed to regenerate invite code.' });
    }
});

// GET /api/classes/:id/enrollments
router.get('/:id/enrollments', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const enrolled = await db
            .select({
                studentId: enrollments.studentId,
                classId: enrollments.classId,
                student: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                },
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .where(eq(enrollments.classId, classId))
            .orderBy(user.name);

        res.status(200).json({ data: enrolled, total: enrolled.length });
    } catch (e) {
        console.error('GET /classes/:id/enrollments error:', e);
        res.status(500).json({ error: 'Failed to get enrollments.' });
    }
});

// POST /api/classes/:id/enrollments
router.post('/:id/enrollments', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ error: 'studentId is required.' });

        // Check class exists and get capacity
        const [classData] = await db
            .select({ capacity: classes.capacity, id: classes.id })
            .from(classes)
            .where(eq(classes.id, classId));

        if (!classData) return res.status(404).json({ error: 'Class not found.' });

        // Check current enrollment count
        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, classId));

        if (Number(countResult?.count) >= classData.capacity) {
            return res.status(409).json({ error: 'Class is at full capacity.' });
        }

        const [newEnrollment] = await db
            .insert(enrollments)
            .values({ studentId, classId })
            .returning();

        res.status(201).json({ data: newEnrollment });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'Student is already enrolled in this class.' });
        }
        if (e?.code === '23503') {
            return res.status(400).json({ error: 'Student not found.' });
        }
        console.error('POST /classes/:id/enrollments error:', e);
        res.status(500).json({ error: 'Failed to enroll student.' });
    }
});

// DELETE /api/classes/:id/enrollments/:studentId
router.delete('/:id/enrollments/:studentId', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        const studentId = String(req.params.studentId);

        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID.' });

        const [deleted] = await db
            .delete(enrollments)
            .where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, studentId)))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Enrollment not found.' });

        res.status(200).json({ data: deleted, message: 'Student unenrolled.' });
    } catch (e) {
        console.error('DELETE /classes/:id/enrollments/:studentId error:', e);
        res.status(500).json({ error: 'Failed to unenroll student.' });
    }
});

export default router;