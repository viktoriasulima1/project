import { spawnSync } from 'node:child_process';
import { safeDatabaseTarget, validatePilotEnvironment } from '../src/lib/pilot-environment';

const action = process.argv[2];
if (action !== 'status' && action !== 'migrate') throw new Error('Expected status or migrate.');
const databaseUrl = process.env.PILOT_DATABASE_URL;
const errors = validatePilotEnvironment({
  nodeEnv: process.env.NODE_ENV, appUrl: process.env.NEXT_PUBLIC_APP_URL,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, secretKey: process.env.CLERK_SECRET_KEY,
  databaseUrl, e2eRun: process.env.E2E_RUN, allowDevFallback: process.env.ALLOW_DEV_FARM_FALLBACK,
  mockCtgb: process.env.E2E_MOCK_CTGB, mockPdok: process.env.E2E_MOCK_PDOK,
});
if (errors.length) throw new Error(`Unsafe pilot environment:\n- ${errors.join('\n- ')}`);
if (action === 'migrate' && process.env.PILOT_MIGRATION_CONFIRM !== 'true') throw new Error('Set PILOT_MIGRATION_CONFIRM=true to deploy pilot migrations.');
const target = safeDatabaseTarget(databaseUrl!);
console.log(`[pilot-db] target host=${target.host} database=${target.database}`);
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', action === 'status' ? 'status' : 'deploy'], { stdio:'inherit', env:{...process.env,DATABASE_URL:databaseUrl!} });
process.exit(result.status ?? 1);
