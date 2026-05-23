import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { PterodactylService } from "@/services/PterodactylService";

interface CleanupResult {
    discordMessage: string;
    sayMessage: string;
}

class GroundCleanupScheduler {
    private activeJob: NodeJS.Timeout | null = null;

    public async schedule(
        interaction: ChatInputCommandInteraction,
        delaySeconds: number,
    ): Promise<void> {
        if (this.activeJob) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle("Limpeza já Agendada")
                        .setDescription(
                            "Aguarde a limpeza atual terminar antes de agendar outra.",
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        const service = new PterodactylService();
        const resources = await service.getResources();

        if (resources.current_state !== "running") {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle("Servidor Offline")
                        .setDescription(
                            "O servidor precisa estar online para limpar itens do chão.",
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xeab308)
                    .setTitle("🧹 Limpeza do Chão Agendada")
                    .setDescription(
                        `Os itens do chão serão limpos em **${delaySeconds} segundos**.`,
                    )
                    .setTimestamp(),
            ],
        });

        this.activeJob = setTimeout(() => {
            this.run(service, interaction).catch(async (error) => {
                await this.fail(interaction, error);
            });
        }, delaySeconds * 1_000);

        try {
            await this.runCountdown(service, delaySeconds);
        } catch (error) {
            if (this.activeJob) {
                clearTimeout(this.activeJob);
            }

            this.reset();
            throw error;
        }
    }

    private async run(
        service: PterodactylService,
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        try {
            const output = await service.sendConsoleCommand(
                "kill @e[type=item]",
                8_000,
            );
            const result = this.findCleanupResult(output);

            await this.sleep(500);
            await this.sendSay(service, result.sayMessage);

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle("🧹 Limpeza Concluída")
                        .setDescription(result.discordMessage)
                        .setTimestamp(),
                ],
            });
        } finally {
            this.reset();
        }
    }

    private async runCountdown(
        service: PterodactylService,
        delaySeconds: number,
    ): Promise<void> {
        await this.sendSay(
            service,
            `O chao sera limpo em ${this.formatDelay(delaySeconds)}.`,
        );

        const checkpoints = [60, 30, 10, 5, 3, 2, 1].filter(
            (s) => s < delaySeconds,
        );
        const startedAt = Date.now();

        for (const checkpoint of checkpoints) {
            const targetMs = (delaySeconds - checkpoint) * 1_000;
            const waitMs = targetMs - (Date.now() - startedAt);

            if (waitMs > 0) {
                await this.sleep(waitMs);
            }

            if (!this.activeJob) return;

            if (checkpoint > 5) {
                await this.sendSay(
                    service,
                    `O chao sera limpo em ${this.formatDelay(checkpoint)}.`,
                );
            } else if (checkpoint === 5) {
                await this.sendSay(service, "O chao sera limpo em 5 segundos.");
            } else {
                await this.sendSay(service, String(checkpoint));
            }
        }
    }

    private async sendSay(
        service: PterodactylService,
        message: string,
    ): Promise<void> {
        await service.sendCommand(`say ${message}`);
    }

    private async fail(
        interaction: ChatInputCommandInteraction,
        error: unknown,
    ): Promise<void> {
        const message =
            error instanceof Error ? error.message : "Unknown error";
        this.reset();

        await interaction
            .editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle("Erro na Limpeza do Chão")
                        .setDescription(`\`${message}\``)
                        .setTimestamp(),
                ],
            })
            .catch(() => undefined);
    }

    private findCleanupResult(lines: string[]): CleanupResult {
        const resultLine = lines
            .slice()
            .reverse()
            .find((line) => line.toLowerCase().includes("killed"));

        const amount = resultLine?.match(/killed\s+(\d+)/i)?.[1];

        if (amount) {
            return {
                discordMessage: `**${amount}** entidades de item foram removidas do chão.`,
                sayMessage: `${amount} itens removidos do chao.`,
            };
        }

        return {
            discordMessage: "Comando de limpeza enviado ao servidor.",
            sayMessage: "Chao limpo.",
        };
    }

    private formatDelay(seconds: number): string {
        if (seconds >= 60 && seconds % 60 === 0) {
            const minutes = seconds / 60;
            return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
        }

        return `${seconds} segundos`;
    }

    private reset(): void {
        this.activeJob = null;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

export const groundCleanupScheduler = new GroundCleanupScheduler();
