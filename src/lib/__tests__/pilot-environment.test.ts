import { describe, expect, it } from 'vitest';
import { safeDatabaseTarget, validatePilotEnvironment } from '../pilot-environment';

const valid = { nodeEnv:'production',appUrl:'https://pilot.example.nl',publishableKey:'pk_live_abcdefghijklmnopqrstuvwxyz',secretKey:'sk_live_abcdefghijklmnopqrstuvwxyz',databaseUrl:'postgresql://u:p@db.example.nl/farmos_pilot' };
describe('pilot environment safety',()=>{
  it('rejects Clerk test keys',()=>expect(validatePilotEnvironment({...valid,publishableKey:'pk_test_abcdefghijklmnopqrstuvwxyz'})).toContain('Pilot requires a Clerk pk_live_ publishable key.'));
  it('rejects dev fallback and E2E flags',()=>expect(validatePilotEnvironment({...valid,e2eRun:'true',allowDevFallback:'true'})).toHaveLength(2));
  it('rejects localhost and temporary tunnels',()=>{expect(validatePilotEnvironment({...valid,appUrl:'http://localhost:3000'}).length).toBeGreaterThan(0);expect(validatePilotEnvironment({...valid,appUrl:'https://x.trycloudflare.com'}).length).toBeGreaterThan(0)});
  it('rejects E2E/default database names',()=>expect(validatePilotEnvironment({...valid,databaseUrl:'postgresql://u:p@db/farmos_e2e'}).length).toBeGreaterThan(0));
  it('rejects government mocks',()=>expect(validatePilotEnvironment({...valid,mockCtgb:'true'})).toContain('E2E government-data mocks cannot be enabled in pilot.'));
  it('accepts a separated production configuration',()=>expect(validatePilotEnvironment(valid)).toEqual([]));
  it('prints database target without credentials',()=>expect(safeDatabaseTarget(valid.databaseUrl)).toEqual({host:'db.example.nl',database:'farmos_pilot'}));
});
