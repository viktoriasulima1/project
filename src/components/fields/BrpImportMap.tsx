'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { NormalizedBrpParcel } from '@/integrations/pdok/types';
import styles from './BrpImportMap.module.css';

interface Props {
  centerLat: number;
  centerLon: number;
  parcels: NormalizedBrpParcel[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/**
 * A minimal, hand-rolled Leaflet wrapper (not react-leaflet — avoids an
 * extra abstraction layer of uncertain React 19 compatibility). Renders
 * BRP parcel polygons over an OSM basemap: pan/zoom, selected/unselected
 * styles, and a click handler — the "minimum map behavior" set in Sprint
 * 18 Part 13. Deliberately does NOT render NDVI, prescription maps,
 * satellite imagery, or risk layers — out of scope for this sprint.
 */
export function BrpImportMap({ centerLat, centerLon, parcels, selectedIndex, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView([centerLat, centerLon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    let cancelled = false;

    async function render() {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      layerGroupRef.current.clearLayers();

      parcels.forEach((parcel, i) => {
        const isSelected = i === selectedIndex;
        const layer = L.geoJSON(parcel.geometry as never, {
          style: {
            color: isSelected ? '#2563eb' : '#6b7280',
            weight: isSelected ? 3 : 1.5,
            fillOpacity: isSelected ? 0.35 : 0.1,
          },
        });
        // Built as real DOM nodes with textContent, never a raw HTML
        // string — `cropLabel` is externally-sourced text (Sprint 18 Part
        // 16: "sanitize all external text before rendering") and must
        // never be interpolated into an HTML template, even though it
        // comes from an official government source.
        const popupEl = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = parcel.cropLabel;
        popupEl.appendChild(strong);
        popupEl.appendChild(document.createElement('br'));
        popupEl.appendChild(document.createTextNode(`${parcel.areaHa.toFixed(2)} ha · ${parcel.datasetYear}`));
        popupEl.appendChild(document.createElement('br'));
        popupEl.appendChild(document.createTextNode('Source: PDOK BRP Gewaspercelen'));
        layer.bindPopup(popupEl);
        layer.on('click', () => onSelect(i));
        layer.addTo(layerGroupRef.current);
      });
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [parcels, selectedIndex, onSelect]);

  return <div ref={containerRef} className={styles.mapContainer} role="img" aria-label="Map of nearby BRP parcels" />;
}
