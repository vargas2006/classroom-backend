import express from 'express';
import { or, eq, ilike, desc, and, getTableColumns } from 'drizzle-orm';
import { classes, subjects } from '../db/schema/index.js';
import { user } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';
import crypto from 'crypto';

const router = express.Router();

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

export default router;