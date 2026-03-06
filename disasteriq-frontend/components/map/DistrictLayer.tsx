'use client';
import { useEffect } from 'react';

interface District {
    district_id: number;
    name: string;
    state: string;
    lat: number;
    lng: number;
    composite_risk: number;
    flood_risk: number;
    cyclone_risk: number;
}

interface Props {
    map: any; // mapboxgl.Map
    districts: District[];
    geojson: any | null; // GeoJSON FeatureCollection from india-districts.geojson
    onDistrictClick: (districtId: number) => void;
}

const SOURCE_ID = 'crisp-district-source';
const FILL_LAYER = 'crisp-district-fill';
const LINE_LAYER = 'crisp-district-line';

function riskToColor(risk: number): string {
    if (risk > 0.8) return '#ff3b3b';
    if (risk > 0.6) return '#ff6b00';
    if (risk > 0.3) return '#ffaa00';
    return '#00e676';
}

export default function DistrictLayer({ map, districts, geojson, onDistrictClick }: Props) {
    useEffect(() => {
        if (!map || !geojson) return;

        // Merge risk data into GeoJSON properties
        const riskMap = new Map(districts.map(d => [d.district_id, d]));
        const enriched = {
            ...geojson,
            features: geojson.features.map((feat: any) => {
                const id = feat.properties?.district_id || feat.properties?.ID_2;
                const riskData = riskMap.get(id);
                return {
                    ...feat,
                    properties: {
                        ...feat.properties,
                        composite_risk: riskData?.composite_risk ?? 0,
                        name: riskData?.name ?? feat.properties?.NAME_2 ?? 'Unknown',
                        state: riskData?.state ?? feat.properties?.NAME_1 ?? '',
                        risk_color: riskToColor(riskData?.composite_risk ?? 0),
                    },
                };
            }),
        };

        if (map.getSource(SOURCE_ID)) {
            (map.getSource(SOURCE_ID) as any).setData(enriched);
            return;
        }

        map.addSource(SOURCE_ID, { type: 'geojson', data: enriched });

        // Choropleth fill
        map.addLayer({
            id: FILL_LAYER,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
                'fill-color': ['get', 'risk_color'],
                'fill-opacity': ['interpolate', ['linear'], ['get', 'composite_risk'], 0, 0.05, 1, 0.35],
            },
        });

        // District border
        map.addLayer({
            id: LINE_LAYER,
            type: 'line',
            source: SOURCE_ID,
            paint: {
                'line-color': 'rgba(255,255,255,0.15)',
                'line-width': 0.6,
            },
        });

        // Click handler
        map.on('click', FILL_LAYER, (e: any) => {
            const id = e.features?.[0]?.properties?.district_id;
            if (id) onDistrictClick(id);
        });

        // Hover cursor
        map.on('mouseenter', FILL_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', FILL_LAYER, () => { map.getCanvas().style.cursor = ''; });

        return () => {
            if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
            if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
            if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        };
    }, [map, geojson, districts]);

    return null;
}
