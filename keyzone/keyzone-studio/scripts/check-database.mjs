import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM niches LIMIT 1");
    console.log("KeyZone database ready");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("KeyZone database unavailable:", error.message);
  process.exitCode = 1;
});
