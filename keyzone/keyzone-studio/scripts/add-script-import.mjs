import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS script_source text NOT NULL DEFAULT 'generated'");
  console.log("Script import column ready; existing projects preserved.");
} finally { await pool.end(); }
