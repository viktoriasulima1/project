import type { PhotoAnnotation } from './photo-policy';
export type EditorState={annotations:PhotoAnnotation[];history:PhotoAnnotation[][]};
const MIN=.04,clamp=(n:number)=>Math.max(0,Math.min(1,n));
const commit=(s:EditorState,next:PhotoAnnotation[]):EditorState=>({annotations:next,history:[...s.history,s.annotations].slice(-30)});
export function createPoint(s:EditorState,x:number,y:number,label=''):EditorState{return commit(s,[...s.annotations,{id:crypto.randomUUID(),type:'point',x:clamp(x),y:clamp(y),label:label.slice(0,240)}]);}
export function createText(s:EditorState,x:number,y:number,label:string):EditorState{return commit(s,[...s.annotations,{id:crypto.randomUUID(),type:'text',x:clamp(x),y:clamp(y),label:label.trim().slice(0,240)}]);}
export function createRectangle(s:EditorState,x1:number,y1:number,x2:number,y2:number,label=''):EditorState{const x=clamp(Math.min(x1,x2)),y=clamp(Math.min(y1,y2)),width=Math.max(MIN,Math.min(1-x,Math.abs(x2-x1))),height=Math.max(MIN,Math.min(1-y,Math.abs(y2-y1)));return commit(s,[...s.annotations,{id:crypto.randomUUID(),type:'rectangle',x,y,width,height,label:label.trim().slice(0,240)}]);}
export function moveAnnotation(s:EditorState,id:string|undefined,dx:number,dy:number):EditorState{if(!id)return s;return commit(s,s.annotations.map(a=>{if(a.id!==id)return a;const maxX=1-(a.width??0),maxY=1-(a.height??0);return{...a,x:Math.max(0,Math.min(maxX,a.x+dx)),y:Math.max(0,Math.min(maxY,a.y+dy))}}));}
export function resizeRectangle(s:EditorState,id:string,width:number,height:number):EditorState{return commit(s,s.annotations.map(a=>a.id===id&&a.type==='rectangle'?{...a,width:Math.max(MIN,Math.min(1-a.x,width)),height:Math.max(MIN,Math.min(1-a.y,height))}:a));}
export function editLabel(s:EditorState,id:string,label:string):EditorState{return commit(s,s.annotations.map(a=>a.id===id?{...a,label:label.trim().slice(0,240)}:a));}
export function removeAnnotation(s:EditorState,id:string):EditorState{return commit(s,s.annotations.filter(a=>a.id!==id));}
export function undo(s:EditorState):EditorState{const previous=s.history.at(-1);return previous?{annotations:previous,history:s.history.slice(0,-1)}:s;}
