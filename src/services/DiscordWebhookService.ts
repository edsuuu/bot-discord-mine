import { env } from "@/config/Env";
import { logger } from "@/utils/Logger";

interface WebhookPayload {
    content?: string;
    embeds?: Array<{
        title?: string;
        description?: string;
        color?: number;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
        timestamp?: string;
    }>;
}

export class DiscordWebhookService {
    private readonly url = env.DISCORD_WEBHOOK_URL || "";

    public get enabled(): boolean {
        return this.url.length > 0;
    }

    public async sendAction(
        title: string,
        description: string,
        color: number,
    ): Promise<void> {
        await this.send({
            embeds: [
                {
                    title,
                    description,
                    color,
                    timestamp: new Date().toISOString(),
                },
            ],
        });
    }

    public async send(payload: WebhookPayload): Promise<void> {
        if (!this.enabled) return;

        const response = await fetch(this.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            logger.warn(
                `[DiscordWebhook] Failed to send webhook: HTTP ${response.status}`,
            );
        }
    }
}
