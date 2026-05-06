const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/web/.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM agent_state').then(res => {
  console.log('agent_state rows:', res.rows.length);
  if (res.rows.length > 0) console.log(res.rows[0]);
}).catch(console.error).finally(() => pool.end());
