import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const sql = neon(process.env.DATABASE_URL!);
sql("SELECT * FROM agent_state").then(rows => {
  console.log("agent_state rows:", rows.length);
  if (rows.length > 0) console.log(rows[0]);
}).catch(console.error);
