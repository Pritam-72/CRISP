'use client';
import { useEffect, useRef } from 'react';

interface Props {
    map: any; // mapboxgl.Map
    data: Array<{
        lat: number;
        lng: number;
        composite_risk: number;
        district_id: number;
    }>;
}

const HEATMAP_LAYER_ID = 'crisp-heatmap-layer';
const HEATMAP_SOURCE_ID = 'crisp-heatmap-source';

export default function HeatmapLayer({ map, data }: Props) {
    const added = useRef(false);

    useEffect(() => {
        if (!map || !data.length) return;

        const geojson = {
            type: 'FeatureCollection' as const,
            features: data.map(d => ({
                type: 'Feature' as const,
                properties: { risk: d.composite_risk, district_id: d.district_id },
                geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
            })),
        };

        if (map.getSource(HEATMAP_SOURCE_ID)) {
            (map.getSource(HEATMAP_SOURCE_ID) as any).setData(geojson);
            return;
        }

        map.addSource(HEATMAP_SOURCE_ID, { type: 'geojson', data: geojson });

        map.addLayer({
            id: HEATMAP_LAYER_ID,
            type: 'heatmap',
            source: HEATMAP_SOURCE_ID,
            paint: {
                // Weight by composite_risk (0→1)
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'risk'], 0, 0, 1, 1],
                // Radius by zoom level
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 15, 9, 35],
                // Intensity
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 1.2],
                // Opacity
                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 10, 0.4],
                // Color ramp: green → yellow → orange → red
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,230,118,0)',
                    0.2, 'rgba(0,230,118,0.6)',
                    0.4, 'rgba(255,170,0,0.7)',
                    0.6, 'rgba(255,107,0,0.8)',
                    0.8, 'rgba(255,59,59,0.9)',
                    1.0, 'rgba(255,0,0,1)',
                ],
            },
        });

        added.current = true;

        return () => {
            if (map.getLayer(HEATMAP_LAYER_ID)) map.removeLayer(HEATMAP_LAYER_ID);
            if (map.getSource(HEATMAP_SOURCE_ID)) map.removeSource(HEATMAP_SOURCE_ID);
        };
    }, [map, data]);

    return null; // Pure map layer — no DOM output
}
