import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8');
const globals = read('src/app/globals.css');
const shell = read('src/components/layout/AppShell.module.css');
const sidebarCss = read('src/components/layout/Sidebar.module.css');
const opsCss = read('src/components/operations/Operations.module.css');
const fabCss = read('src/components/activities/QuickLogButton.module.css');
const sidebarTsx = read('src/components/layout/Sidebar.tsx');
const mapTsx = read('src/components/operations/FieldOperationsMap.tsx');

function zToken(name: string): number {
  const m = globals.match(new RegExp(`--${name}:\\s*(\\d+)`));
  if (!m) throw new Error(`token --${name} not found`);
  return Number(m[1]);
}

// 1/2 — desktop push layout reserves the sidebar and gives main min-width:0
describe('desktop push layout', () => {
  it('1 — AppShell is a flex row with a min-width:0 main content column', () => {
    expect(shell).toMatch(/\.shell\s*\{[^}]*display:\s*flex/);
    expect(shell).toMatch(/\.content\s*\{[^}]*min-width:\s*0/);
  });
  it('3 — the map never uses 100vw (it fills the content column, not the viewport)', () => {
    expect(opsCss).not.toMatch(/100vw/);
    expect(opsCss).toMatch(/\.map\s*\{[^}]*(min-height|height)/);
  });
});

// 2/5 — the map is isolated into its own stacking context
it('5 — .mapPanel isolates the Leaflet stacking context', () => {
  expect(opsCss).toMatch(/\.mapPanel\s*\{[^}]*isolation:\s*isolate/);
});

// 4/5/7 — layer scale keeps sidebar above backdrop above FAB above the map
describe('layer scale ordering', () => {
  it('sidebar > backdrop > fab, and the map panel is isolated at z:0', () => {
    expect(zToken('z-sidebar')).toBeGreaterThan(zToken('z-map-backdrop'));
    expect(zToken('z-map-backdrop')).toBeGreaterThan(zToken('z-fab'));
    expect(sidebarCss).toMatch(/\.sidebar\s*\{[^}]*z-index:\s*var\(--z-sidebar\)/);
    expect(sidebarCss).toMatch(/z-index:\s*var\(--z-map-backdrop\)/); // backdrop
    expect(fabCss).toMatch(/z-index:\s*var\(--z-fab\)/);
  });
  it('4 — the mobile drawer backdrop is opaque enough to hide the map', () => {
    const m = sidebarCss.match(/\.backdrop[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.5);
  });
});

// 6/8/9 — pointer blocking is via the backdrop; Escape + focus return
describe('drawer interaction + a11y', () => {
  it('6 — the backdrop covers the viewport and intercepts clicks while open', () => {
    expect(sidebarCss).toMatch(/\.backdrop\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/);
    expect(sidebarTsx).toMatch(/className=\{styles\.backdrop\} onClick=\{closeDrawer\}/);
  });
  it('8/9 — Escape closes the drawer and focus returns to the toggle', () => {
    expect(sidebarTsx).toMatch(/e\.key === 'Escape'/);
    expect(sidebarTsx).toMatch(/toggleRef\.current\?\.focus\(\)/);
    expect(sidebarTsx).toMatch(/ref=\{toggleRef\}/);
  });
});

// 10/11/12 — invalidateSize on real size change; bounded; observer cleaned up
describe('bounded map resize', () => {
  it('10/11 — invalidateSize runs only on a real size change, throttled by rAF', () => {
    expect(mapTsx).toMatch(/new ResizeObserver/);
    expect(mapTsx).toMatch(/if \(w === last\.w && h === last\.h\) return/); // idempotent guard
    expect(mapTsx).toMatch(/requestAnimationFrame\(\(\) => map\.current\?\.invalidateSize\(\)\)/);
  });
  it('12 — the observer + rAF are cleaned up', () => {
    expect(mapTsx).toMatch(/observer\.disconnect\(\)/);
    expect(mapTsx).toMatch(/cancelAnimationFrame\(raf\)/);
  });
});
