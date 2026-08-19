export interface PilotEnvironment {
  nodeEnv?: string;
  appUrl?: string;
  publishableKey?: string;
  secretKey?: string;
  databaseUrl?: string;
  e2eRun?: string;
  allowDevFallback?: string;
  mockCtgb?: string;
  mockPdok?: string;
}

export function validatePilotEnvironment(env: PilotEnvironment): string[] {
  const errors: string[] = [];
  if (env.nodeEnv !== 'production') errors.push('NODE_ENV must be production.');
  let app: URL | null = null;
  try { app = env.appUrl ? new URL(env.appUrl) : null; } catch { errors.push('NEXT_PUBLIC_APP_URL must be a valid URL.'); }
  if (!app) errors.push('NEXT_PUBLIC_APP_URL is required.');
  else {
    if (app.protocol !== 'https:') errors.push('NEXT_PUBLIC_APP_URL must use HTTPS.');
    if (['localhost', '127.0.0.1'].includes(app.hostname) || app.hostname.endsWith('.loca.lt') || app.hostname.endsWith('.trycloudflare.com')) errors.push('NEXT_PUBLIC_APP_URL must use a stable non-local hostname.');
  }
  if (!env.publishableKey?.startsWith('pk_live_')) errors.push('Pilot requires a Clerk pk_live_ publishable key.');
  if (!env.secretKey?.startsWith('sk_live_')) errors.push('Pilot requires a Clerk sk_live_ secret key.');
  if (!env.databaseUrl) errors.push('PILOT_DATABASE_URL is required.');
  else {
    try { const name = new URL(env.databaseUrl).pathname.replace(/^\//, ''); if (/^(farmos|farmos_e2e|postgres)$/i.test(name) || /e2e|test/i.test(name)) errors.push('Pilot database must be isolated from dev/E2E/default databases.'); }
    catch { errors.push('PILOT_DATABASE_URL must be a valid connection URL.'); }
  }
  if (env.e2eRun === 'true') errors.push('E2E_RUN cannot be enabled in pilot.');
  if (env.allowDevFallback === 'true') errors.push('ALLOW_DEV_FARM_FALLBACK cannot be enabled in pilot.');
  if (env.mockCtgb === 'true' || env.mockPdok === 'true') errors.push('E2E government-data mocks cannot be enabled in pilot.');
  return errors;
}

export function safeDatabaseTarget(value: string): { host: string; database: string } {
  const url = new URL(value);
  return { host: url.hostname, database: url.pathname.replace(/^\//, '') };
}
