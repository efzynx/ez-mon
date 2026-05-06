import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "../../.env" });

const sql = neon(process.env.DATABASE_URL!);
sql`SELECT bucket_start, cpu_cores_avg FROM metric_buckets ORDER BY bucket_start DESC LIMIT 3`
  .then((res) => {
    console.log("DB RESULT:", JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
