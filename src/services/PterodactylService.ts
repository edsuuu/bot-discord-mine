import WebSocket from "ws";

import { env } from "@/config/Env";
import { logger } from "@/utils/Logger";

export type PowerSignal = "start" | "stop" | "restart" | "kill";
export type ServerState = "running" | "starting" | "stopping" | "offline";

export interface ServerResources {
    current_state: ServerState;
    is_suspended: boolean;
    resources: {
        memory_bytes: number;
        cpu_absolute: number;
        disk_bytes: number;
        network_rx_bytes: number;
        network_tx_bytes: number;
        uptime: number;
    };
}

export interface ServerInfo {
    name: string;
    identifier: string;
    description: string;
    limits: {
        memory: number;
        swap: number;
        disk: number;
        io: number;
        cpu: number;
    };
    is_suspended: boolean;
    is_installing: boolean;
}

interface WebsocketDetails {
    data: {
        token: string;
        socket: string;
    };
}

interface SocketPayload {
    event?: string;
    args?: string[];
}

export class PterodactylService {
    private readonly baseUrl: string;
    private readonly token: string;
    private readonly serverId: string;

    public constructor() {
        this.baseUrl = env.PTERODACTYL_URL.replace(/\/$/, "");
        this.token = env.PTERODACTYL_TOKEN;
        this.serverId = env.PTERODACTYL_SERVER_ID;
    }

    public async getResources(): Promise<ServerResources> {
        const data = await this.get<{ attributes: ServerResources }>(
            `/servers/${this.serverId}/resources`,
        );
        return data.attributes;
    }

    public async getServerInfo(): Promise<ServerInfo> {
        const data = await this.get<{ attributes: ServerInfo }>(
            `/servers/${this.serverId}`,
        );
        return data.attributes;
    }

    public async start(): Promise<void> {
        await this.power("start");
    }

    public async stop(): Promise<void> {
        await this.power("stop");
    }

    public async restart(): Promise<void> {
        await this.power("restart");
    }

    public async kill(): Promise<void> {
        await this.power("kill");
    }

    public async sendCommand(command: string): Promise<void> {
        await this.post(`/servers/${this.serverId}/command`, { command });
    }

    public async waitForConsolePattern(
        pattern: RegExp,
        timeoutMs = 2 * 60_000,
    ): Promise<boolean> {
        const details = await this.get<WebsocketDetails>(
            `/servers/${this.serverId}/websocket`,
        );

        return new Promise((resolve) => {
            let settled = false;

            const settle = (value: boolean) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            const ws = new WebSocket(details.data.socket, {
                origin: this.baseUrl.replace("/api/client", ""),
            });

            const timeout = setTimeout(() => {
                ws.close();
                settle(false);
            }, timeoutMs);

            ws.on("open", () => {
                ws.send(
                    JSON.stringify({
                        event: "auth",
                        args: [details.data.token],
                    }),
                );
            });

            ws.on("message", (raw) => {
                const payload = this.parseSocketPayload(raw.toString());
                if (!payload?.event) return;

                if (payload.event === "console output" && payload.args?.[0]) {
                    const line = this.cleanConsoleLine(payload.args[0]);
                    if (pattern.test(line)) {
                        clearTimeout(timeout);
                        ws.close();
                        settle(true);
                    }
                }
            });

            ws.on("error", () => {
                clearTimeout(timeout);
                settle(false);
            });

            ws.on("close", () => {
                clearTimeout(timeout);
                settle(false);
            });
        });
    }

    public async sendConsoleCommand(
        command: string,
        timeoutMs = 6_000,
    ): Promise<string[]> {
        const details = await this.get<WebsocketDetails>(
            `/servers/${this.serverId}/websocket`,
        );

        return new Promise((resolve, reject) => {
            const output: string[] = [];
            let authenticated = false;

            const ws = new WebSocket(details.data.socket, {
                origin: this.baseUrl.replace("/api/client", ""),
            });

            const timeout = setTimeout(() => {
                ws.close();
                resolve(output);
            }, timeoutMs);

            ws.on("open", () => {
                ws.send(
                    JSON.stringify({
                        event: "auth",
                        args: [details.data.token],
                    }),
                );
            });

            ws.on("message", (raw) => {
                const payload = this.parseSocketPayload(raw.toString());
                if (!payload?.event) return;

                if (payload.event === "auth success") {
                    authenticated = true;
                    ws.send(
                        JSON.stringify({
                            event: "send command",
                            args: [command],
                        }),
                    );
                    return;
                }

                if (payload.event === "console output" && payload.args?.[0]) {
                    output.push(this.cleanConsoleLine(payload.args[0]));
                }
            });

            ws.on("error", (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            ws.on("close", () => {
                clearTimeout(timeout);
                if (!authenticated) {
                    reject(
                        new Error(
                            "Could not authenticate with the Pterodactyl console.",
                        ),
                    );
                    return;
                }
                resolve(output);
            });
        });
    }

    private async power(signal: PowerSignal): Promise<void> {
        await this.post(`/servers/${this.serverId}/power`, { signal });
    }

    private async get<T>(path: string): Promise<T> {
        const response = await this.makeRequest("GET", path);
        return response.json() as Promise<T>;
    }

    private async post(path: string, body: unknown): Promise<void> {
        await this.makeRequest("POST", path, body);
    }

    private async makeRequest(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<Response> {
        const url = `${this.baseUrl}${path}`;

        logger.info(`[Pterodactyl] ${method} ${path}`);

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: "application/vnd.pterodactyl.v1+json",
                "Content-Type": "application/json",
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
                errors?: Array<{ detail: string }>;
            };
            const detail =
                errorData.errors?.[0]?.detail ?? `HTTP ${response.status}`;
            logger.error(`[Pterodactyl] Error: ${detail}`);
            throw new Error(detail);
        }

        return response;
    }

    private parseSocketPayload(raw: string): SocketPayload | null {
        try {
            return JSON.parse(raw) as SocketPayload;
        } catch {
            return null;
        }
    }

    private cleanConsoleLine(line: string): string {
        const esc = String.fromCharCode(27);
        const ansiPattern = new RegExp(`${esc}\\[[0-?]*[ -/]*[@-~]`, "g");
        return line
            .replace(ansiPattern, "")
            .replace(/\[[0-9;:]+m/g, "")
            .trim();
    }
}
