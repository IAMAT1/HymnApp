import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

let db: any = null;

// Check for DATABASE_URL - only create db connection if available
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set - profile features will be disabled');
  db = null;
} else {
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql);
}

export { db };