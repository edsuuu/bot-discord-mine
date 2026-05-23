import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { DiscordWebhookService } from '../../services/DiscordWebhookService.js';
import { PterodactylService } from '../../services/PterodactylService.js';
import type { Command } from './Command.js';

const MAX_WAIT_MS = 5 * 60 * 1_000; // 5 minutos
const POLL_INTERVAL_MS = 5_000;     // checar a cada 5s

class RestartCommand implements Command {
    public readonly data = new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Reinicia o servidor e avisa quando voltar online');

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const service = new PterodactylService();

        try {
            const resources = await service.getResources();

            if (resources.current_state === 'offline') {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xef4444)
                            .setTitle('🔴 Servidor Offline')
                            .setDescription('Não é possível reiniciar um servidor offline.\nUse `/start` primeiro.')
                            .setTimestamp(),
                    ],
                });
                return;
            }

            await service.restart();
            await new DiscordWebhookService().sendAction(
                'Servidor Reiniciando',
                `Sinal de reinicialização enviado por ${interaction.user.tag}.`,
                0xeab308,
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle('🔄 Servidor Reiniciando...')
                        .setDescription('Aguardando o servidor voltar online. Você será avisado aqui.')
                        .addFields(
                            { name: 'Solicitado por', value: interaction.user.toString(), inline: true },
                            { name: 'Timeout', value: '5 minutos', inline: true },
                        )
                        .setFooter({ text: 'EnxadaHost · Pterodactyl — verificando a cada 5s' })
                        .setTimestamp(),
                ],
            });

            await this.waitForOnline(interaction, service);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle('❌ Erro ao Reiniciar o Servidor')
                        .setDescription(`\`${message}\``)
                        .setTimestamp(),
                ],
            });
        }
    }

    private async waitForOnline(
        interaction: ChatInputCommandInteraction,
        service: PterodactylService,
    ): Promise<void> {
        const startedAt = Date.now();

        // ── Fase 1: aguarda o processo ficar "running" ──────────────────────
        while (Date.now() - startedAt < MAX_WAIT_MS) {
            await this.sleep(POLL_INTERVAL_MS);

            try {
                const current = await service.getResources();

                if (current.current_state === 'running') {
                    const elapsedSec = Math.round((Date.now() - startedAt) / 1_000);

                    // Avisa que o processo subiu, mas o mundo ainda pode estar carregando
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xeab308)
                                .setTitle('🟡 Processo Iniciado — Carregando Mundo...')
                                .setDescription(`Servidor iniciou em **${elapsedSec}s**. Aguardando o mundo terminar de carregar...`)
                                .setFooter({ text: 'EnxadaHost · Pterodactyl — aguardando "Done"' })
                                .setTimestamp(),
                        ],
                    });

                    // ── Fase 2: aguarda a linha "Done (Xs)!" no console ──────
                    const DONE_TIMEOUT_MS = 2 * 60_000; // 2 min adicionais
                    const ready = await service.waitForConsolePattern(
                        /done \(\d+(?:\.\d+)?s\)!/i,
                        DONE_TIMEOUT_MS,
                    );

                    const totalSec = Math.round((Date.now() - startedAt) / 1_000);

                    // Busca CPU atualizada para exibir no embed final
                    let cpuStr = '—';
                    try {
                        const fresh = await service.getResources();
                        cpuStr = `${fresh.resources.cpu_absolute.toFixed(1)}%`;
                    } catch { /* ignora */ }

                    await new DiscordWebhookService().sendAction(
                        ready ? '🟢 Servidor Pronto' : '🟢 Servidor Online',
                        ready
                            ? `Servidor pronto para entrar após ${totalSec}s.`
                            : `Servidor online após ${totalSec}s (timeout aguardando "Done").`,
                        0x22c55e,
                    );

                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x22c55e)
                                .setTitle(ready ? '🟢 Servidor Pronto para Entrar!' : '🟢 Servidor Online!')
                                .setDescription(
                                    ready
                                        ? `Mundo carregado! Você já pode entrar. Tempo total: **${totalSec}s**.`
                                        : `O servidor está online após **${totalSec}s**. Tente entrar — o mundo pode já estar carregado.`,
                                )
                                .addFields(
                                    { name: 'Tempo total', value: `${totalSec}s`, inline: true },
                                    { name: 'CPU', value: cpuStr, inline: true },
                                )
                                .setFooter({ text: 'EnxadaHost · Pterodactyl' })
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
            } catch {
                // erro de polling — ignora e tenta na próxima iteração
            }
        }

        // timeout sem servidor voltar
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle('⏱️ Timeout — Servidor não voltou')
                    .setDescription('O servidor não ficou online em **5 minutos**.\nVerifique o painel manualmente.')
                    .setFooter({ text: 'EnxadaHost · Pterodactyl' })
                    .setTimestamp(),
            ],
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => { setTimeout(resolve, ms); });
    }
}

export default new RestartCommand();
