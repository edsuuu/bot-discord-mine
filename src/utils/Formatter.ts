import type { ServerState } from "@/services/PterodactylService";

export function formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
}

export function formatUptime(ms: number): string {
    if (!ms) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
}

const EMOJI_MAP: Record<ServerState, string> = {
    running: "🟢",
    starting: "🟡",
    stopping: "🟠",
    offline: "🔴",
};

const LABEL_MAP: Record<ServerState, string> = {
    running: "Online",
    starting: "Iniciando",
    stopping: "Parando",
    offline: "Offline",
};

export function statusEmoji(state: ServerState): string {
    return EMOJI_MAP[state] ?? "⚪";
}

export function statusLabel(state: ServerState): string {
    return LABEL_MAP[state] ?? "Desconhecido";
}
