import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('WARN: DATABASE_URL is not defined. Database operations will fail.');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
