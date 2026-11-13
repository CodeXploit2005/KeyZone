import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS reference_image_kind text NOT NULL DEFAULT 'place'");
  await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_image_paths jsonb NOT NULL DEFAULT '[]'::jsonb");
  console.log("Product reference column ready; existing place references preserved.");
} finally { await pool.end(); }
