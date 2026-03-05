import { create } from 'zustand';

export interface District {
    district_id: number;
    name: string;
    state: string;
    lat: number;
    lng: number;
    population: number;
    composite_risk: number;
    flood_risk: number;
    heatwave_risk: number;
    cyclone_risk: number;
    people_at_risk: number;
    confidence: number;
    updated_at: string | null;
}

export interface DistrictDetail {
    district: {
        id: number;
        name: string;
        state: string;
        population: number;
        lat: number;
        lng: number;
        coastal_district: boolean;
    };
    current_risk: {
        flood_risk: number;
        heatwave_risk: number;
        cyclone_risk: number;
        composite_risk: number;
        people_at_risk: number;
        confidence: number;
        updated_at: string | null;
    };
    shap_explanation: Record<string, number>;
    history_72h: Array<{
        time: string;
        flood_risk: number;
        heatwave_risk: number;
        cyclone_risk: number;
        composite_risk: number;
    }>;
}

export interface Allocation {
    from_district: string;
    to_district: string;
    resource_type: string;
    quantity: number;
    arrival_mins: number;
    distance_km: number;
    composite_risk: number;
}

interface AppState {
    // Auth
    token: string | null;
    role: string | null;
    setAuth: (token: string, role: string) => void;
    logout: () => void;

    // Districts
    districts: District[];
    setDistricts: (d: District[]) => void;

    // Selected district
    selectedDistrict: DistrictDetail | null;
    setSelectedDistrict: (d: DistrictDetail | null) => void;

    // Loading
    isLoading: boolean;
    setLoading: (v: boolean) => void;

    // Allocations
    lastOptimization: any;
    setLastOptimization: (v: any) => void;

    // Sidebar
    sidebarTab: 'risk' | 'relief' | 'alerts' | 'reports';
    setSidebarTab: (t: 'risk' | 'relief' | 'alerts' | 'reports') => void;
}

export const useStore = create<AppState>((set) => ({
    token: typeof window !== 'undefined' ? localStorage.getItem('disasteriq_token') : null,
    role: typeof window !== 'undefined' ? localStorage.getItem('disasteriq_role') : null,
    setAuth: (token, role) => {
        localStorage.setItem('disasteriq_token', token);
        localStorage.setItem('disasteriq_role', role);
        set({ token, role });
    },
    logout: () => {
        localStorage.removeItem('disasteriq_token');
        localStorage.removeItem('disasteriq_role');
        set({ token: null, role: null });
    },

    districts: [],
    setDistricts: (districts) => set({ districts }),

    selectedDistrict: null,
    setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),

    isLoading: false,
    setLoading: (isLoading) => set({ isLoading }),

    lastOptimization: null,
    setLastOptimization: (lastOptimization) => set({ lastOptimization }),

    sidebarTab: 'risk',
    setSidebarTab: (sidebarTab) => set({ sidebarTab }),
}));
