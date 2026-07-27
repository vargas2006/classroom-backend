import express from 'express';
import { or, eq, ilike, desc, and, getTableColumns } from 'drizzle-orm';
import { user } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';

const router = express.Router();

router.get('/', async (req, res) => {
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
                totalPages: Math.ceil(totalCount / LimitPerPage),
            },
        });
    } catch (e) {
        console.error(`"GET /users error:", ${e}`);
        res.status(500).json({ error: 'Failed to get users.' });
    }
});

export default router;
