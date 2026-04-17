/**
 * Future home for WebSocket/WebRTC session helpers (audio frames, reconnection).
 * Called from hooks/useRealtimeSession.ts once transport is implemented.
 */

export type RealtimeTransport = "websocket" | "webrtc" | "sse";
