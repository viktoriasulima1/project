import { config } from 'dotenv';
import path from 'node:path';
import { getClerkBackendClient } from '../e2e/setup/clerk-backend-client';

config({ path: path.resolve(process.cwd(), '.env.e2e') });
const fixedEmails = [process.env.E2E_USER_NEW_EMAIL, process.env.E2E_USER_READY_EMAIL, process.env.E2E_USER_OTHER_EMAIL, process.env.E2E_USER_PILOT_EMAIL].filter((value): value is string => Boolean(value));
async function main() {
  const clerk = getClerkBackendClient();
  let total = 0;
  let offset = 0;
  for (;;) {
    const page = await clerk.users.getUserList({ limit: 100, offset });
    total += page.data.length;
    if (page.data.length < 100) break;
    offset += 100;
  }
  let fixedPool = 0;
  for (const emailAddress of fixedEmails) {
    const result = await clerk.users.getUserList({ emailAddress: [emailAddress], limit: 1 });
    if (result.data.length === 1) fixedPool += 1;
  }
  console.log(JSON.stringify({ total, fixedPool, configuredFixedPool: fixedEmails.length }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
