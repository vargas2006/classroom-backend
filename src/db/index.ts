import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('WARN: DATABASE_URL is not defined. Database operations will fail.');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const sql = neon(connectionString);
export const db = drizzle(sql);
