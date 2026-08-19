import {describe,expect,it} from'vitest';import{detectImageMime,normalizeAnnotation,sanitizePhotoName,validatePhoto}from'../photo-policy';
const jpeg=new Uint8Array([0xff,0xd8,0xff,0,1]);
describe('scouting photo policy',()=>{
 it('detects real MIME bytes',()=>expect(detectImageMime(jpeg)).toBe('image/jpeg'));
 it('rejects a claimed MIME mismatch',()=>expect(()=>validatePhoto(jpeg,'image/png')).toThrow(/does not match/));
 it('rejects invalid bytes',()=>expect(()=>validatePhoto(new Uint8Array([1,2,3]),'image/jpeg')).toThrow(/Unsupported/));
 it('sanitizes untrusted filenames',()=>expect(sanitizePhotoName('../../evil photo.jpg')).toBe('evil-photo.jpg'));
 it('normalizes point coordinates',()=>expect(normalizeAnnotation({id:'1',type:'point',x:2,y:-1,label:' spot '})).toMatchObject({x:1,y:0,label:'spot'}));
 it('bounds rectangles after resize-independent normalized coordinates',()=>{const a=normalizeAnnotation({id:'1',type:'rectangle',x:.9,y:.8,width:.8,height:.9,label:'patch'});expect(a.width).toBeCloseTo(.1);expect(a.height).toBeCloseTo(.2)});
 it('preserves the annotation type and text',()=>expect(normalizeAnnotation({id:'1',type:'text',x:.2,y:.3,label:'Brown leaf'})).toMatchObject({type:'text',label:'Brown leaf'}));
});
