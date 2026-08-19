'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { FIELD_STATUS_LABELS, type FieldOperationalStatus } from '@/lib/field-operations';
import { type FieldHealthStatus } from '@/lib/scouting/field-health';
import { classifyGpsAccuracy } from '@/lib/scouting/gps-accuracy';
import { useTranslations } from '@/i18n/LocaleProvider';
import styles from './Operations.module.css';

type MapField = { id: string; name: string; hectares: number; crop: string | null; geometry: unknown; status: FieldOperationalStatus; nextWork: string | null; healthStatus: FieldHealthStatus; latestScoutingDate: string | null; unresolvedCount: number; currentStage: string | null; };
type LocationState = 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'insecure' | 'unsupported';
const colors: Record<FieldOperationalStatus, string> = { critical: '#b91c1c', blocked: '#7c3aed', overdue: '#ea580c', due_soon: '#eab308', in_progress: '#2563eb', planned: '#0891b2', completed: '#15803d', unplanned: '#6b7280', no_active_season: '#9ca3af' };

export function FieldOperationsMap({ fields, center }: { fields: MapField[]; center: [number, number] }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const layers = useRef<import('leaflet').LayerGroup | null>(null);
  const locationLayers = useRef<import('leaflet').LayerGroup | null>(null);
  const latestLocation = useRef<[number, number] | null>(null);
  const followLocation = useRef(true);
  const [selected, setSelected] = useState(fields[0]?.id ?? null);
  const [mapReady, setMapReady] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('requesting');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const t = useTranslations('fields');
  const healthLabel = (s: FieldHealthStatus) => t(`health.status.${s}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapNode.current || map.current) return;
      map.current = L.map(mapNode.current).setView(center, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map.current);
      layers.current = L.layerGroup().addTo(map.current);
      locationLayers.current = L.layerGroup().addTo(map.current);
      setMapReady(true);
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [center]);

  // Keep Leaflet's internal size in sync when the available container changes
  // (sidebar open/close, desktop breakpoint, orientation). Bounded + idempotent:
  // it only acts on a REAL width/height change, throttles via one rAF, and never
  // mutates the container, so it can't drive a ResizeObserver / call-stack loop
  // (the class of defect the physical-iPhone fix guarded against).
  useEffect(() => {
    if (!mapReady || !mapNode.current || !map.current) return;
    const node = mapNode.current;
    let raf = 0;
    let last = { w: node.clientWidth, h: node.clientHeight };
    const observer = new ResizeObserver(() => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === last.w && h === last.h) return; // no real change → no-op
      last = { w, h };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.current?.invalidateSize());
    });
    observer.observe(node);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current || !layers.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !layers.current) return;
      layers.current.clearLayers();
      const bounds: import('leaflet').LatLngBoundsExpression[] = [];
      fields.forEach(field => {
        if (!field.geometry) return;
        try {
          const layer = L.geoJSON(field.geometry as never, { style: { color: colors[field.status], weight: selected === field.id ? 4 : 2, fillColor: colors[field.status], fillOpacity: .32 } }).on('click', () => setSelected(field.id)).bindTooltip(`${field.name}: ${FIELD_STATUS_LABELS[field.status]}`).addTo(layers.current!);
          bounds.push(layer.getBounds() as never);
        } catch { /* Keep malformed legacy geometry in the accessible list. */ }
      });
      if (bounds.length && !latestLocation.current) map.current?.fitBounds(L.latLngBounds(bounds.flat() as never), { padding: [20, 20] });
    })();
    return () => { cancelled = true; };
  }, [fields, selected, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    if (!window.isSecureContext) { setLocationState('insecure'); return; }
    if (!('geolocation' in navigator)) { setLocationState('unsupported'); return; }
    setLocationState('requesting');
    const watchId = navigator.geolocation.watchPosition(async position => {
      const point: [number, number] = [position.coords.latitude, position.coords.longitude];
      latestLocation.current = point;
      setAccuracy(position.coords.accuracy);
      setLocationState('tracking');
      const L = (await import('leaflet')).default;
      if (!map.current || !locationLayers.current) return;
      locationLayers.current.clearLayers();
      L.circle(point, { radius: position.coords.accuracy, color: '#2563eb', weight: 1, fillColor: '#60a5fa', fillOpacity: .14 }).addTo(locationLayers.current);
      L.circleMarker(point, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Your live location').addTo(locationLayers.current);
      if (followLocation.current) map.current.setView(point, Math.max(map.current.getZoom(), 17));
    }, error => {
      setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapReady]);

  const toggleFollowing = () => {
    const next = !followLocation.current;
    followLocation.current = next;
    setFollowing(next);
    if (next && latestLocation.current) map.current?.setView(latestLocation.current, Math.max(map.current.getZoom(), 17));
  };
  // Accuracy is classified, not just displayed: a coarse fix (the physical test
  // saw ±5632 m) is labelled too low to identify a field rather than presented
  // as ordinary "live location" evidence.
  const gps = locationState === 'tracking' ? classifyGpsAccuracy(accuracy) : null;
  const locationText = locationState === 'tracking' ? (gps!.usableForFieldSuggestion ? `Live location · accuracy ${Math.round(accuracy ?? 0)} m` : gps!.message) : locationState === 'requesting' ? 'Requesting location permission…' : locationState === 'denied' ? 'Location permission denied. Allow Location for this site in browser settings.' : locationState === 'insecure' ? 'Live location requires HTTPS on a phone.' : locationState === 'unsupported' ? 'This browser does not support location.' : 'Current location is temporarily unavailable.';
  const detail = fields.find(x => x.id === selected);

  return <div className={styles.mapLayout}><div className={styles.mapPanel}><div ref={mapNode} className={styles.map} aria-label="Operational field map" role="img"/><div className={styles.locationBar} role="status"><span>{locationText}</span>{locationState === 'tracking' && <button type="button" onClick={toggleFollowing}>{following ? 'Stop following' : 'Follow me'}</button>}</div></div><aside className={styles.card}><h2>Fields · Crop health</h2><ul className={styles.list}>{fields.map(field => <li key={field.id}><button className={styles.fieldButton} onClick={() => setSelected(field.id)} aria-pressed={selected === field.id}><strong>{field.name}</strong><br/><span className={styles.muted}>{FIELD_STATUS_LABELS[field.status]} · {healthLabel(field.healthStatus)} · {field.hectares.toFixed(1)} ha</span></button></li>)}</ul>{detail && <div><h3>{detail.name}</h3><p>{detail.crop ?? 'No active crop'} · {detail.hectares.toFixed(1)} ha</p><p><span className={styles.badge}>{healthLabel(detail.healthStatus)}</span></p><p className={styles.muted}>{detail.unresolvedCount} unresolved · stage {detail.currentStage ?? 'not recorded'} · last visit {detail.latestScoutingDate ? new Date(detail.latestScoutingDate).toLocaleDateString() : 'none'}</p><p className={styles.muted}>{detail.nextWork ? `Next: ${detail.nextWork}` : 'No upcoming work order'}</p><a className={styles.button} href={`/scouting?field=${detail.id}`}>Start scouting</a> <a className={styles.button} href={`/fields/${detail.id}`}>Field detail</a></div>}</aside></div>;
}
