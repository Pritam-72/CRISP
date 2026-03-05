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

export type SidebarTab = 'risk' | 'relief' | 'alerts' | 'reports' | 'stats' | 'chat' | 'compare';

interface AppState {
    // Auth
    token: string | null;
    role: string | null;
    email: string | null;
    setAuth: (token: string, role: string, email?: string) => void;
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
    sidebarTab: SidebarTab;
    setSidebarTab: (t: SidebarTab) => void;
}

export const useStore = create<AppState>((set) => ({
    token: typeof window !== 'undefined' ? localStorage.getItem('disasteriq_token') : null,
    role: typeof window !== 'undefined' ? localStorage.getItem('disasteriq_role') : null,
    email: typeof window !== 'undefined' ? localStorage.getItem('disasteriq_email') : null,

    setAuth: (token, role, email) => {
        localStorage.setItem('disasteriq_token', token);
        localStorage.setItem('disasteriq_role', role);
        if (email) localStorage.setItem('disasteriq_email', email);
        set({ token, role, email: email || null });
    },
    logout: () => {
        localStorage.removeItem('disasteriq_token');
        localStorage.removeItem('disasteriq_role');
        localStorage.removeItem('disasteriq_email');
        set({ token: null, role: null, email: null });
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
