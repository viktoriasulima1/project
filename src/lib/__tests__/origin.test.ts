import { describe,expect,it } from 'vitest';
import { isTrustedMutationOrigin } from '../origin';
describe('pilot mutation origins',()=>{
  it('accepts configured pilot origin',()=>expect(isTrustedMutationOrigin(new Request('https://pilot.example.nl/api/offline/sync',{headers:{origin:'https://pilot.example.nl','sec-fetch-site':'same-origin'}}),'https://pilot.example.nl')).toBe(true));
  it('rejects a cross-origin mutation',()=>expect(isTrustedMutationOrigin(new Request('https://pilot.example.nl/api/offline/sync',{headers:{origin:'https://evil.example','sec-fetch-site':'cross-site'}}),'https://pilot.example.nl')).toBe(false));
});
