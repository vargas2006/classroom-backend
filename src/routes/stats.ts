import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { classes, departments, subjects, enrollments } from '../db/schema/index.js';
import { user } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm/sql';

const router = express.Router();

// GET /api/stats — aggregated dashboard data
router.get('/', async (req, res) => {
    try {
        // User counts by role
        const userCountsRaw = await db
            .select({
                role: user.role,
                count: sql<number>`count(*)`,
            })
            .from(user)
            .groupBy(user.role);

        const userCounts = { student: 0, teacher: 0, admin: 0, total: 0 };
        for (const row of userCountsRaw) {
            const role = row.role as 'student' | 'teacher' | 'admin';
            userCounts[role] = Number(row.count);
            userCounts.total += Number(row.count);
        }

        // Class counts by status
        const classCountsRaw = await db
            .select({
                status: classes.status,
                count: sql<number>`count(*)`,
            })
            .from(classes)
            .groupBy(classes.status);

        const classCounts = { active: 0, inactive: 0, archived: 0, total: 0 };
        for (const row of classCountsRaw) {
            const status = row.status as 'active' | 'inactive' | 'archived';
            classCounts[status] = Number(row.count);
            classCounts.total += Number(row.count);
        }

        // Total enrollments
        const [enrollmentCountResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments);
        const totalEnrollments = Number(enrollmentCountResult?.count ?? 0);

        // Total departments and subjects
        const [deptCount] = await db.select({ count: sql<number>`count(*)` }).from(departments);
        const [subjectCount] = await db.select({ count: sql<number>`count(*)` }).from(subjects);

        // Classes by department
        const classesByDept = await db
            .select({
                department: departments.name,
                count: sql<number>`count(*)`,
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .groupBy(departments.name)
            .orderBy(desc(sql`count(*)`));

        // Enrollment trends — use class created_at as proxy (enrollments has no timestamp)
        const monthlyEnrollments = await db.execute(sql`
            SELECT
                TO_CHAR(DATE_TRUNC('month', c.created_at), 'Mon') as month,
                DATE_TRUNC('month', c.created_at) as month_date,
                COUNT(e.student_id) as count
            FROM classes c
            LEFT JOIN enrollments e ON e.class_id = c.id
            GROUP BY DATE_TRUNC('month', c.created_at)
            ORDER BY DATE_TRUNC('month', c.created_at) ASC
            LIMIT 8
        `);

        // Capacity status — classes grouped by fill level
        const capacityData = await db
            .select({
                classId: classes.id,
                name: classes.name,
                capacity: classes.capacity,
                enrollmentCount: sql<number>`(
                    SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ${classes.id}
                )`,
            })
            .from(classes)
            .where(eq(classes.status, 'active'))
            .limit(50);

        const capacityStatus = { available: 0, nearFull: 0, full: 0 };
        for (const cls of capacityData) {
            const pct = cls.capacity > 0 ? (Number(cls.enrollmentCount) / cls.capacity) : 0;
            if (pct >= 1) capacityStatus.full++;
            else if (pct >= 0.8) capacityStatus.nearFull++;
            else capacityStatus.available++;
        }

        // Recent activity (last 10 classes created)
        const recentClasses = await db
            .select({
                id: classes.id,
                name: classes.name,
                status: classes.status,
                createdAt: classes.createdAt,
                teacherName: user.name,
            })
            .from(classes)
            .leftJoin(user, eq(classes.teacherId, user.id))
            .orderBy(desc(classes.createdAt))
            .limit(8);

        // Monthly classes created (for trend chart)
        const monthlyClassTrend = await db.execute(sql`
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
                DATE_TRUNC('month', created_at) as month_date,
                COUNT(*) as count
            FROM classes
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
            LIMIT 8
        `);

        res.status(200).json({
            data: {
                userCounts,
                classCounts,
                totalEnrollments,
                totalDepartments: Number(deptCount?.count ?? 0),
                totalSubjects: Number(subjectCount?.count ?? 0),
                classesByDept,
                monthlyEnrollments: monthlyEnrollments.rows ?? [],
                capacityStatus,
                monthlyClassTrend: monthlyClassTrend.rows ?? [],
                recentClasses,
            }
        });
    } catch (e) {
        console.error('GET /stats error:', e);
        res.status(500).json({ error: 'Failed to get stats.' });
    }
});

export default router;
