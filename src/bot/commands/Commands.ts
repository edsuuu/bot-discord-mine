import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import {
    BaseCommand,
    type CommandDefinition,
} from "@/bot/commands/BaseCommand";
import { env } from "@/config/Env";
import { DiscordWebhookService } from "@/services/DiscordWebhookService";
import { groundCleanupScheduler } from "@/services/GroundCleanupScheduler";
import { PterodactylService } from "@/services/PterodactylService";
import {
    formatBytes,
    formatUptime,
    statusEmoji,
    statusLabel,
} from "@/utils/Formatter";

const COLOR_MAP = {
    running: 0x22c55e,
    starting: 0xeab308,
    stopping: 0xf97316,
    offline: 0xef4444,
} as const;

const MAX_WAIT_MS = 5 * 60 * 1_000;
const POLL_INTERVAL = 5_000;
const DONE_TIMEOUT = 2 * 60 * 1_000;

export class Commands extends BaseCommand {
    public getDefinitions(): CommandDefinition[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("start")
                    .setDescription(
                        "Liga o servidor e avisa quando estiver pronto para entrar",
                    ),
                execute: (i) => this.start(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("stop")
                    .setDescription("Para o servidor de jogo")
                    .addBooleanOption((opt) =>
                        opt
                            .setName("force")
                            .setDescription(
                                "Forçar parada imediata (kill) sem salvar",
                            )
                            .setRequired(false),
                    ),
                execute: (i) => this.stop(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("restart")
                    .setDescription(
                        "Reinicia o servidor e avisa quando estiver pronto para entrar",
                    ),
                execute: (i) => this.restart(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("status")
                    .setDescription(
                        "Exibe o status e consumo de recursos do servidor",
                    ),
                execute: (i) => this.status(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("players")
                    .setDescription(
                        "Lista os jogadores online via console do servidor",
                    ),
                execute: (i) => this.players(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("limpar-chao")
                    .setDescription(
                        "Agenda uma limpeza de itens do chão no servidor",
                    )
                    .addIntegerOption((opt) =>
                        opt
                            .setName("delay")
                            .setDescription(
                                "Segundos antes de iniciar a limpeza (padrão: 5)",
                            )
                            .setMinValue(0)
                            .setMaxValue(600),
                    ),
                execute: (i) => this.limparChao(i),
            },
            {
                data: new SlashCommandBuilder()
                    .setName("cancelar-limpeza")
                    .setDescription(
                        "Cancela a limpeza do chão que está agendada",
                    ),
                execute: (i) => this.cancelarLimpeza(i),
            },
        ];
    }

    private async start(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply();
        const service = new PterodactylService();

        try {
            const resources = await service.getResources();

            if (resources.current_state === "running") {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle("🟢 Servidor Já Está Online")
                            .setDescription(
                                "O servidor já está em funcionamento.",
                            )
                            .setTimestamp(),
                    ],
                });
                return;
            }

            if (resources.current_state === "starting") {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xeab308)
                            .setTitle("🟡 Servidor Já Está Iniciando")
                            .setDescription(
                                "O servidor já está sendo iniciado. Aguardando ficar online...",
                            )
                            .setFooter({
                                text: "EnxadaHost · Pterodactyl — verificando a cada 5s",
                            })
                            .setTimestamp(),
                    ],
                });
                await this.waitForOnline(interaction, service);
                return;
            }

            await service.start();
            await new DiscordWebhookService().sendAction(
                "Servidor Ligando",
                `Sinal de inicialização enviado por ${interaction.user.tag}.`,
                0x22c55e,
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle("▶️ Servidor Ligando...")
                        .setDescription(
                            "Aguardando o servidor ficar online. Você será avisado aqui.",
                        )
                        .addFields(
                            {
                                name: "Solicitado por",
                                value: interaction.user.toString(),
                                inline: true,
                            },
                            {
                                name: "Timeout",
                                value: "5 minutos",
                                inline: true,
                            },
                        )
                        .setFooter({
                            text: "EnxadaHost · Pterodactyl — verificando a cada 5s",
                        })
                        .setTimestamp(),
                ],
            });

            await this.waitForOnline(interaction, service);
        } catch (error) {
            await this.replyError(
                interaction,
                "❌ Erro ao Ligar o Servidor",
                error,
            );
        }
    }

    private async stop(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const force = interaction.options.getBoolean("force") ?? false;

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_stop")
                .setLabel(force ? "⚡ Confirmar Kill" : "🛑 Confirmar Parada")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("cancel_stop")
                .setLabel("Cancelar")
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf97316)
                    .setTitle(
                        force
                            ? "⚡ Forçar parada?"
                            : "🛑 Confirmar desligamento?",
                    )
                    .setDescription(
                        force
                            ? "Isso vai **matar o processo** imediatamente, sem salvar dados."
                            : "Isso vai **parar o servidor** de forma segura. Confirma?",
                    )
                    .setFooter({ text: "Responda em 30 segundos" }),
            ],
            components: [confirmRow],
            fetchReply: true,
        });

        try {
            const confirmation = await reply.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id,
                componentType: ComponentType.Button,
                time: 30_000,
            });

            if (confirmation.customId === "cancel_stop") {
                await confirmation.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x71717a)
                            .setTitle("Cancelado")
                            .setDescription("Ação de desligamento cancelada."),
                    ],
                    components: [],
                });
                return;
            }

            await confirmation.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xf97316)
                        .setTitle("⏳ Processando...")
                        .setDescription("Enviando sinal de parada..."),
                ],
                components: [],
            });

            const service = new PterodactylService();
            await (force ? service.kill() : service.stop());
            await new DiscordWebhookService().sendAction(
                force ? "Servidor Finalizado (Kill)" : "Servidor Parando",
                `${force ? "Kill" : "Parada"} solicitado por ${interaction.user.tag}.`,
                force ? 0xef4444 : 0xf97316,
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle(
                            force
                                ? "⚡ Servidor Finalizado (Kill)"
                                : "🛑 Servidor Parando",
                        )
                        .setDescription(
                            force
                                ? "O processo foi **encerrado forçadamente**."
                                : "Sinal de **parada** enviado com sucesso.",
                        )
                        .addFields({
                            name: "Solicitado por",
                            value: interaction.user.toString(),
                            inline: true,
                        })
                        .setFooter({ text: "EnxadaHost · Pterodactyl" })
                        .setTimestamp(),
                ],
                components: [],
            });
        } catch (error) {
            const isTimeout =
                error instanceof Error && error.message.includes("time");
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x71717a)
                        .setTitle(isTimeout ? "⏱️ Tempo Esgotado" : "❌ Erro")
                        .setDescription(
                            isTimeout
                                ? "Nenhuma confirmação recebida. Ação cancelada."
                                : `\`${error instanceof Error ? error.message : "Erro desconhecido"}\``,
                        ),
                ],
                components: [],
            });
        }
    }

    private async restart(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply();
        const service = new PterodactylService();

        try {
            const resources = await service.getResources();

            if (resources.current_state === "offline") {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xef4444)
                            .setTitle("🔴 Servidor Offline")
                            .setDescription(
                                "Não é possível reiniciar um servidor offline.\nUse `/start` primeiro.",
                            )
                            .setTimestamp(),
                    ],
                });
                return;
            }

            await service.restart();
            await new DiscordWebhookService().sendAction(
                "Servidor Reiniciando",
                `Sinal de reinicialização enviado por ${interaction.user.tag}.`,
                0xeab308,
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle("🔄 Servidor Reiniciando...")
                        .setDescription(
                            "Aguardando o servidor voltar online. Você será avisado aqui.",
                        )
                        .addFields(
                            {
                                name: "Solicitado por",
                                value: interaction.user.toString(),
                                inline: true,
                            },
                            {
                                name: "Timeout",
                                value: "5 minutos",
                                inline: true,
                            },
                        )
                        .setFooter({
                            text: "EnxadaHost · Pterodactyl — verificando a cada 5s",
                        })
                        .setTimestamp(),
                ],
            });

            await this.waitForOnline(interaction, service);
        } catch (error) {
            await this.replyError(
                interaction,
                "❌ Erro ao Reiniciar o Servidor",
                error,
            );
        }
    }

    private async status(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply();
        const service = new PterodactylService();

        try {
            const [resources, info] = await Promise.all([
                service.getResources(),
                service.getServerInfo(),
            ]);

            const state = resources.current_state;
            const res = resources.resources;
            const isRunning = state === "running";
            const color = COLOR_MAP[state] ?? 0x71717a;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(
                    `${statusEmoji(state)} ${info.name} — ${statusLabel(state)}`,
                )
                .setDescription(info.description || "Servidor EnxadaHost")
                .setFooter({
                    text: `EnxadaHost · ID: ${env.PTERODACTYL_SERVER_ID}`,
                })
                .setTimestamp();

            if (isRunning) {
                const memLimit =
                    info.limits.memory > 0
                        ? `${info.limits.memory} MB`
                        : "Ilimitado";

                embed.addFields(
                    {
                        name: "⏱️ Uptime",
                        value: formatUptime(res.uptime),
                        inline: true,
                    },
                    {
                        name: "🖥️ CPU",
                        value: `${res.cpu_absolute.toFixed(1)}%`,
                        inline: true,
                    },
                    { name: "​", value: "​", inline: true },
                    {
                        name: "🧠 RAM",
                        value: `${formatBytes(res.memory_bytes)} / ${memLimit}`,
                        inline: true,
                    },
                    {
                        name: "💾 Disco",
                        value: formatBytes(res.disk_bytes),
                        inline: true,
                    },
                    { name: "​", value: "​", inline: true },
                    {
                        name: "📡 Rede ↓",
                        value: formatBytes(res.network_rx_bytes),
                        inline: true,
                    },
                    {
                        name: "📡 Rede ↑",
                        value: formatBytes(res.network_tx_bytes),
                        inline: true,
                    },
                );
            } else {
                embed.addFields({
                    name: "Informação",
                    value: "Servidor offline. Recursos indisponíveis.",
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.replyError(
                interaction,
                "❌ Erro ao Buscar Status",
                error,
            );
        }
    }

    private async players(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply();
        const service = new PterodactylService();

        try {
            const resources = await service.getResources();

            if (resources.current_state !== "running") {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xef4444)
                            .setTitle("🔴 Servidor Offline")
                            .setDescription(
                                "O servidor precisa estar online para buscar jogadores.",
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
                        .setTitle("🔍 Buscando jogadores...")
                        .setDescription(
                            "Enviando `list` ao console do servidor.",
                        ),
                ],
            });

            const lines = await service.sendConsoleCommand("list", 8_000);
            const playerLine = this.findPlayerLine(lines);

            if (playerLine) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle("👥 Jogadores Online")
                            .setDescription(playerLine)
                            .setTimestamp(),
                    ],
                });
                return;
            }

            const rawOutput =
                lines.length > 0
                    ? lines.slice(-10).join("\n")
                    : "*(nenhuma linha capturada — verifique se o WebSocket está funcionando)*";

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle("⚠️ Padrão não reconhecido — output bruto")
                        .setDescription(
                            `\`\`\`\n${rawOutput.slice(0, 1800)}\n\`\`\``,
                        )
                        .setFooter({
                            text: "Cole este output para ajustar o padrão de busca",
                        })
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            await this.replyError(
                interaction,
                "❌ Erro ao Buscar Jogadores",
                error,
            );
        }
    }

    private async limparChao(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply();
        const delaySeconds = interaction.options.getInteger("delay") ?? 5;

        try {
            await groundCleanupScheduler.schedule(interaction, delaySeconds);
        } catch (error) {
            await this.replyError(
                interaction,
                "❌ Erro na Limpeza do Chão",
                error,
            );
        }
    }

    private async cancelarLimpeza(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const cancelled = await groundCleanupScheduler.cancel();

        if (cancelled) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle("Limpeza Cancelada")
                        .setDescription(
                            "A limpeza agendada foi cancelada com sucesso.",
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x64748b)
                    .setTitle("Nenhuma Limpeza Agendada")
                    .setDescription(
                        "Não há nenhuma limpeza ativa para cancelar.",
                    )
                    .setTimestamp(),
            ],
        });
    }

    private async waitForOnline(
        interaction: ChatInputCommandInteraction,
        service: PterodactylService,
    ): Promise<void> {
        const startedAt = Date.now();

        while (Date.now() - startedAt < MAX_WAIT_MS) {
            await this.sleep(POLL_INTERVAL);

            try {
                const current = await service.getResources();

                if (current.current_state === "running") {
                    const elapsedSec = Math.round(
                        (Date.now() - startedAt) / 1_000,
                    );

                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xeab308)
                                .setTitle(
                                    "🟡 Processo Iniciado — Carregando Mundo...",
                                )
                                .setDescription(
                                    `Servidor iniciou em **${elapsedSec}s**. Aguardando o mundo terminar de carregar...`,
                                )
                                .setFooter({
                                    text: 'EnxadaHost · Pterodactyl — aguardando "Done"',
                                })
                                .setTimestamp(),
                        ],
                    });

                    const ready = await service.waitForConsolePattern(
                        /done \(\d+(?:\.\d+)?s\)!/i,
                        DONE_TIMEOUT,
                    );

                    const totalSec = Math.round(
                        (Date.now() - startedAt) / 1_000,
                    );

                    let cpuStr = "—";
                    try {
                        const fresh = await service.getResources();
                        cpuStr = `${fresh.resources.cpu_absolute.toFixed(1)}%`;
                    } catch {}

                    await new DiscordWebhookService().sendAction(
                        ready ? "🟢 Servidor Pronto" : "🟢 Servidor Online",
                        ready
                            ? `Servidor pronto para entrar após ${totalSec}s.`
                            : `Servidor online após ${totalSec}s (timeout aguardando "Done").`,
                        0x22c55e,
                    );

                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x22c55e)
                                .setTitle(
                                    ready
                                        ? "🟢 Servidor Pronto para Entrar!"
                                        : "🟢 Servidor Online!",
                                )
                                .setDescription(
                                    ready
                                        ? `Mundo carregado! Você já pode entrar. Tempo total: **${totalSec}s**.`
                                        : `O servidor está online após **${totalSec}s**. Tente entrar — o mundo pode já estar carregado.`,
                                )
                                .addFields(
                                    {
                                        name: "Tempo total",
                                        value: `${totalSec}s`,
                                        inline: true,
                                    },
                                    {
                                        name: "CPU",
                                        value: cpuStr,
                                        inline: true,
                                    },
                                )
                                .setFooter({ text: "EnxadaHost · Pterodactyl" })
                                .setTimestamp(),
                        ],
                    });

                    await interaction.followUp({
                        content: ready
                            ? `${interaction.user.toString()} ✅ Servidor pronto para entrar! (**${totalSec}s**)`
                            : `${interaction.user.toString()} ✅ Servidor online! (**${totalSec}s**)`,
                    });

                    return;
                }
            } catch {}
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("⏱️ Timeout — Servidor não ficou online")
                    .setDescription(
                        "O servidor não ficou online em **5 minutos**.\nVerifique o painel manualmente.",
                    )
                    .setFooter({ text: "EnxadaHost · Pterodactyl" })
                    .setTimestamp(),
            ],
        });
    }

    private findPlayerLine(lines: string[]): string | null {
        return (
            lines
                .slice()
                .reverse()
                .find((line) => this.isPlayerListLine(line)) ?? null
        );
    }

    private isPlayerListLine(line: string): boolean {
        const l = line.toLowerCase();
        return (
            l.includes("players online") ||
            l.includes("online players") ||
            (l.includes("there are") && l.includes("player")) ||
            l.includes("jogadores online") ||
            (l.includes("há") && l.includes("jogador")) ||
            /\d+\s+of\s+a\s+max\s+of\s+\d+/.test(l) ||
            /\(\d+\/\d+\)/.test(l) ||
            l.includes("no players are online") ||
            l.includes("nenhum jogador")
        );
    }
}
