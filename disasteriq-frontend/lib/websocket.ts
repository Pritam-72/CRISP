/**
 * WebSocket client for real-time risk score updates.
 * Connects to WS /ws/risk-updates on the FastAPI backend.
 * Dispatches events to a callback on each message.
 *
 * Usage:
 *   import { createRiskSocket } from '@/lib/websocket';
 *   const ws = createRiskSocket((data) => store.setDistricts(data));
 *   // When done:
 *   ws.close();
 */

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const WS_ENDPOINT = `${WS_BASE}/ws/risk-updates`;
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface RiskUpdate {
    type: 'risk_update' | 'ping' | 'error';
    districts?: any[];
    message?: string;
    timestamp?: string;
}

export class RiskWebSocket {
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private closed = false;
    private onMessage: (data: RiskUpdate) => void;
    private onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;

    constructor(
        onMessage: (data: RiskUpdate) => void,
        onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void,
    ) {
        this.onMessage = onMessage;
        this.onStatusChange = onStatusChange;
        this.connect();
    }

    private connect() {
        if (this.closed) return;
        if (typeof window === 'undefined') return; // SSR guard

        try {
            this.ws = new WebSocket(WS_ENDPOINT);

            this.ws.onopen = () => {
                console.log('[CRISP WS] Connected to risk-updates stream');
                this.reconnectAttempts = 0;
                this.onStatusChange?.('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data: RiskUpdate = JSON.parse(event.data);
                    this.onMessage(data);
                } catch {
                    console.warn('[CRISP WS] Failed to parse message:', event.data);
                }
            };

            this.ws.onclose = () => {
                if (this.closed) return;
                console.warn('[CRISP WS] Connection closed, scheduling reconnect...');
                this.onStatusChange?.('disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.error('[CRISP WS] Error:', err);
                this.ws?.close();
            };
        } catch (err) {
            console.error('[CRISP WS] Failed to create WebSocket:', err);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.closed || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[CRISP WS] Max reconnect attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectAttempts, 5);
        this.onStatusChange?.('reconnecting');
        this.reconnectTimer = setTimeout(() => { this.connect(); }, delay);
    }

    /** Gracefully close the connection and stop reconnect attempts. */
    close() {
        this.closed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }

    /** Check if the socket is currently open. */
    get isOpen(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

/**
 * Convenience factory. Returns a RiskWebSocket instance.
 * Remember to call .close() on component unmount.
 */
export function createRiskSocket(
    onMessage: (data: RiskUpdate) => void,
    onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void,
): RiskWebSocket {
    return new RiskWebSocket(onMessage, onStatusChange);
}
