'use client';
import 'leaflet/dist/leaflet.css';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStore, District } from '@/lib/store';
import { riskApi } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/* ── Risk helpers ─────────────────────────────────────────── */
function riskColor(risk: number): string {
    if (risk > 0.8) return '#ff3b3b';
    if (risk > 0.6) return '#ff6b00';
    if (risk > 0.4) return '#ffaa00';
    if (risk > 0.2) return '#00d4ff';
    return '#00e676';
}

function riskLabel(risk: number): string {
    if (risk > 0.8) return 'CRITICAL';
    if (risk > 0.6) return 'HIGH';
    if (risk > 0.4) return 'MEDIUM';
    if (risk > 0.2) return 'LOW';
    return 'MINIMAL';
}

const LEGEND = [
    { label: 'CRITICAL', color: '#ff3b3b' },
    { label: 'HIGH', color: '#ff6b00' },
    { label: 'MEDIUM', color: '#ffaa00' },
    { label: 'LOW', color: '#00d4ff' },
    { label: 'MINIMAL', color: '#00e676' },
];
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

/* ── Leaflet India Map (no Mapbox token needed) ────────────── */
function LeafletMap({ districts, onSelect }: {
    districts: District[];
    onSelect: (d: District) => void;
}) {
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const circlesRef = useRef<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Init Leaflet once
    useEffect(() => {
        if (mapRef.current || !containerRef.current) return;
        // Guard against React Strict Mode double-invoke: container already has a Leaflet map
        if ((containerRef.current as any)._leaflet_id) return;

        let isMounted = true;

        // Dynamic import to avoid SSR
        import('leaflet').then(async (L) => {
            // Bail if component unmounted or map already created or container re-used
            if (!isMounted || !containerRef.current || mapRef.current) return;
            if ((containerRef.current as any)._leaflet_id) return;

            leafletRef.current = L.default ?? L;
            const Lf = leafletRef.current;

            // Fix default marker icon path issue with webpack
            delete (Lf.Icon.Default.prototype as any)._getIconUrl;
            Lf.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

            const map = Lf.map(containerRef.current!, {
                center: [22.5, 82.5],
                zoom: 5,
                zoomControl: false,
                attributionControl: false,
            });

            // CartoDB Dark Matter tiles — free, no API key
            Lf.tileLayer(
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                { subdomains: 'abcd', maxZoom: 19 }
            ).addTo(map);

            // Custom zoom control top-right
            Lf.control.zoom({ position: 'topright' }).addTo(map);

            // Attribution bottom-right, minimal
            Lf.control.attribution({ position: 'bottomright', prefix: '' })
                .addAttribution('<span style="font-size:8px;color:#333;font-family:monospace">© CartoDB · OpenStreetMap</span>')
                .addTo(map);

            mapRef.current = map;

            // Critical: force Leaflet to recalculate size after DOM settles
            setTimeout(() => { map.invalidateSize(); }, 100);

            // After map initializes, add markers
            addMarkers(Lf, map);
        });

        return () => {
            isMounted = false;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Update markers when districts change
    useEffect(() => {
        if (!mapRef.current || !leafletRef.current || districts.length === 0) return;
        addMarkers(leafletRef.current, mapRef.current);
    }, [districts]);

    const addMarkers = (Lf: any, map: any) => {
        // Remove old
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        circlesRef.current.forEach(c => c.remove());
        circlesRef.current = [];

        districts.forEach((d) => {
            const color = riskColor(d.composite_risk);
            const radius = d.composite_risk > 0.8 ? 9000
                : d.composite_risk > 0.6 ? 7000
                    : d.composite_risk > 0.3 ? 5000
                        : 3500;

            // Glowing outer ring for critical
            if (d.composite_risk > 0.6) {
                const ring = Lf.circle([d.lat, d.lng], {
                    radius: radius * 2.5,
                    color,
                    weight: 0.7,
                    fillColor: color,
                    fillOpacity: 0.04,
                    opacity: 0.25,
                }).addTo(map);
                circlesRef.current.push(ring);
            }

            // Core circle marker
            const circle = Lf.circle([d.lat, d.lng], {
                radius,
                color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.75,
            }).addTo(map);

            // Click
            circle.on('click', () => onSelect(d));

            // Hover popup
            const pct = Math.round(d.composite_risk * 100);
            circle.bindPopup(
                `<div style="background:#0a0a0a;border:1px solid ${color}44;border-top:1px solid ${color};padding:10px 14px;font-family:'JetBrains Mono',monospace;min-width:160px;">
                    <div style="font-size:13px;font-weight:700;color:#f0f0f0;margin-bottom:2px;">${d.name}</div>
                    <div style="font-size:9px;color:#444;letter-spacing:0.12em;margin-bottom:8px;">${d.state.toUpperCase()}</div>
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};display:inline-block;"></span>
                        <span style="font-size:10px;color:${color};font-weight:700;letter-spacing:0.06em;">${riskLabel(d.composite_risk)} · ${pct}%</span>
                    </div>
                    <div style="font-size:9px;color:#444;">${(d.people_at_risk || 0).toLocaleString()} AT RISK</div>
                </div>`,
                {
                    className: 'crisp-popup',
                    closeButton: false,
                    maxWidth: 240,
                }
            );

            markersRef.current.push(circle);
        });
    };

    const critCount = districts.filter(d => d.composite_risk > 0.8).length;
    const highCount = districts.filter(d => d.composite_risk > 0.6 && d.composite_risk <= 0.8).length;
    const medCount = districts.filter(d => d.composite_risk > 0.4 && d.composite_risk <= 0.6).length;

    return (
        <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
            {/* Leaflet map div — must be absolutely positioned with explicit dimensions */}
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

            {/* Global Leaflet dark popup style */}
            <style>{`
                .leaflet-popup-content-wrapper,
                .leaflet-popup-tip-container { display: none !important; }
                .leaflet-popup-content-wrapper {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                    display: block !important;
                }
                .leaflet-popup-content { margin: 0 !important; }
                .crisp-popup .leaflet-popup-content-wrapper {
                    display: block !important;
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                }
                .leaflet-tile { filter: brightness(0.92) saturate(0.8); }
                .leaflet-control-zoom a {
                    background: #0a0a0a !important;
                    color: #00d4ff !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    border-radius: 0 !important;
                    font-family: 'JetBrains Mono', monospace !important;
                }
                .leaflet-control-zoom a:hover {
                    background: rgba(0,212,255,0.1) !important;
                }
                .leaflet-control-attribution {
                    background: rgba(0,0,0,0.7) !important;
                    border-radius: 0 !important;
                }
            `}</style>

            {/* ── Header ── */}
            <div style={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(0,212,255,0.2)',
                padding: '5px 18px', zIndex: 1000, whiteSpace: 'nowrap', textAlign: 'center',
                pointerEvents: 'none',
            }}>
                <div style={{ ...MONO, fontSize: 10, color: '#00d4ff', letterSpacing: '0.2em' }}>
                    INDIA — DISASTER RISK COMMAND VIEW
                </div>
                <div style={{ ...MONO, fontSize: 8, color: '#2a2a2a', letterSpacing: '0.1em', marginTop: 1 }}>
                    {districts.length} DISTRICTS · LIVE AI RISK SCORING · CLICK DISTRICT FOR ANALYSIS
                </div>
            </div>

            {/* ── Live stats top-right (above zoom control) ── */}
            <div style={{
                position: 'absolute', top: 12, left: 16, zIndex: 1000,
                display: 'flex', flexDirection: 'column', gap: 3,
            }}>
                {critCount > 0 && <StatBadge label="CRITICAL" count={critCount} color="#ff3b3b" />}
                {highCount > 0 && <StatBadge label="HIGH" count={highCount} color="#ff6b00" />}
                {medCount > 0 && <StatBadge label="MEDIUM" count={medCount} color="#ffaa00" />}
            </div>

            {/* ── Legend bottom-left ── */}
            <div style={{
                position: 'absolute', bottom: 24, left: 16,
                background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.06)',
                padding: '10px 14px', zIndex: 1000, pointerEvents: 'none',
            }}>
                <div style={{ ...MONO, fontSize: 8, color: '#333', letterSpacing: '0.15em', marginBottom: 8 }}>RISK LEVEL</div>
                {LEGEND.map(({ label, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                        <span style={{ ...MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Districts count bottom-right ── */}
            <div style={{
                position: 'absolute', bottom: 24, right: 16,
                background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.04)',
                padding: '6px 12px', zIndex: 1000, pointerEvents: 'none',
            }}>
                <div style={{ ...MONO, fontSize: 8, color: '#2a2a2a', letterSpacing: '0.1em' }}>
                    {districts.length} DISTRICTS MONITORED
                </div>
            </div>
        </div>
    );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div style={{
            background: 'rgba(0,0,0,0.9)', border: `1px solid ${color}30`,
            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 7,
        }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, letterSpacing: '0.08em' }}>
                {count} {label}
            </span>
        </div>
    );
}

/* ── Main DisasterMap ─────────────────────────────────────── */
export default function DisasterMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const { districts } = useStore();
    const [noToken, setNoToken] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        if (!mapContainer.current) return;
        if (!MAPBOX_TOKEN) { setNoToken(true); return; }

        mapboxgl.accessToken = MAPBOX_TOKEN;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [82.5, 22.5],
            zoom: 4.5,
            projection: 'mercator',
        });
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
        map.current.on('load', () => setMapLoaded(true));

        return () => {
            markersRef.current.forEach(m => m.remove());
            map.current?.remove();
        };
    }, []);

    useEffect(() => {
        if (!map.current || !mapLoaded || noToken || districts.length === 0) return;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        districts.forEach((d) => {
            const size = d.composite_risk > 0.6 ? 18 : d.composite_risk > 0.3 ? 12 : 8;
            const color = riskColor(d.composite_risk);
            const el = document.createElement('div');
            el.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;border:1px solid rgba(255,255,255,0.2);cursor:pointer;box-shadow:0 0 ${size * 1.5}px ${color}88;transition:transform 0.15s;`;
            if (d.composite_risk > 0.8) el.style.animation = 'pulse 1s infinite';
            el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)'; });
            el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
            el.addEventListener('click', () => loadDistrictDetail(d));

            const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
                .setHTML(`<div style="padding:10px 12px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);font-family:'JetBrains Mono',monospace;"><div style="font-size:12px;font-weight:700;color:#f0f0f0;margin-bottom:2px;">${d.name}</div><div style="font-size:9px;color:#444;letter-spacing:0.1em;margin-bottom:8px;">${d.state.toUpperCase()}</div><div style="display:flex;align-items:center;gap:6px;"><span style="width:7px;height:7px;background:${color};border-radius:50%;box-shadow:0 0 6px ${color};"></span><span style="font-size:10px;color:${color};font-weight:700;">${riskLabel(d.composite_risk)} · ${Math.round(d.composite_risk * 100)}%</span></div><div style="font-size:9px;color:#444;margin-top:4px;">${(d.people_at_risk || 0).toLocaleString()} AT RISK</div></div>`);

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([d.lng, d.lat]).setPopup(popup).addTo(map.current!);
            markersRef.current.push(marker);
        });
    }, [districts, mapLoaded, noToken]);

    const loadDistrictDetail = useCallback(async (d: District) => {
        const { setSelectedDistrict, setSidebarTab } = useStore.getState();
        setSidebarTab('risk');
        try {
            const detail = await riskApi.getDistrict(d.district_id);
            setSelectedDistrict(detail);
        } catch (err) { console.error(err); }
    }, []);

    if (noToken) {
        return <LeafletMap districts={districts} onSelect={loadDistrictDetail} />;
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

            <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', zIndex: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#333', letterSpacing: '0.15em', marginBottom: 8 }}>RISK LEVEL</div>
                {LEGEND.map(({ label, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>{label}</span>
                    </div>
                ))}
            </div>

            {!mapLoaded && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 32, height: 32, margin: '0 auto 12px', border: '2px solid rgba(0,212,255,0.2)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#444', letterSpacing: '0.12em' }}>INITIALIZING MAP...</div>
                    </div>
                </div>
            )}
        </div>
    );
}
