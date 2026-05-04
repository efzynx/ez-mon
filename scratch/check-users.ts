import { db } from "./apps/web/src/lib/db";
import { users } from "./packages/db/src/schema";

async function checkUsers() {
  const allUsers = await db().select().from(users);
  console.log("Registered Users:");
  console.log(JSON.stringify(allUsers, null, 2));
  process.exit(0);
}

checkUsers().catch(console.error);
