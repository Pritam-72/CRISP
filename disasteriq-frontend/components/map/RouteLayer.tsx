'use client';
import { useEffect } from 'react';

interface Route {
    id: string | number;
    polyline: string; // GeoJSON LineString as JSON string
    resource_type: string;
    quantity: number;
    color?: string;
}

interface Props {
    map: any; // mapboxgl.Map
    routes: Route[];
}

const TYPE_COLORS: Record<string, string> = {
    truck: '#00d4ff',
    boat: '#a78bfa',
    medical: '#00e676',
    food: '#ffaa00',
};

export default function RouteLayer({ map, routes }: Props) {
    useEffect(() => {
        if (!map || !routes.length) return;

        const layerIds: string[] = [];
        const sourceIds: string[] = [];

        routes.forEach((route, idx) => {
            const sourceId = `crisp-route-source-${idx}`;
            const lineId = `crisp-route-line-${idx}`;
            const arrowId = `crisp-route-arrow-${idx}`;
            sourceIds.push(sourceId);
            layerIds.push(lineId, arrowId);

            let geom: any;
            try {
                geom = typeof route.polyline === 'string' ? JSON.parse(route.polyline) : route.polyline;
            } catch {
                return; // Skip malformed polyline
            }

            const color = route.color || TYPE_COLORS[route.resource_type] || '#00d4ff';

            const geojson = {
                type: 'FeatureCollection' as const,
                features: [{
                    type: 'Feature' as const,
                    properties: { type: route.resource_type, quantity: route.quantity },
                    geometry: geom,
                }],
            };

            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, { type: 'geojson', data: geojson });
            }

            if (!map.getLayer(lineId)) {
                map.addLayer({
                    id: lineId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': color,
                        'line-width': 2.5,
                        'line-opacity': 0.85,
                        'line-dasharray': [4, 2],
                    },
                });
            }

            // Animated pulse via line-dasharray offset (simulated movement)
            if (!map.getLayer(arrowId)) {
                map.addLayer({
                    id: arrowId,
                    type: 'symbol',
                    source: sourceId,
                    layout: {
                        'symbol-placement': 'line',
                        'symbol-spacing': 80,
                        'icon-image': 'arrow-right',
                        'icon-size': 0.5,
                        'icon-rotate': 90,
                        'icon-rotation-alignment': 'map',
                    },
                    paint: { 'icon-color': color, 'icon-opacity': 0.7 },
                });
            }
        });

        return () => {
            layerIds.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
            sourceIds.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
        };
    }, [map, routes]);

    return null;
}
