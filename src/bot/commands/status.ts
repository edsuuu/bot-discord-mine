import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { env } from '../../config/env.js';
import { PterodactylService } from '../../services/PterodactylService.js';
import { formatBytes, formatUptime, statusEmoji, statusLabel } from '../../utils/formatter.js';
import type { Command } from './Command.js';

const COLOR_MAP = {
    running: 0x22c55e,
    starting: 0xeab308,
    stopping: 0xf97316,
    offline: 0xef4444,
} as const;

class StatusCommand implements Command {
    public readonly data = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Exibe o status e consumo de recursos do servidor');

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const service = new PterodactylService();

        try {
            const [resources, info] = await Promise.all([
                service.getResources(),
                service.getServerInfo(),
            ]);

            const state = resources.current_state;
            const res = resources.resources;
            const isRunning = state === 'running';

            const color = COLOR_MAP[state] ?? 0x71717a;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${statusEmoji(state)} ${info.name} — ${statusLabel(state)}`)
                .setDescription(info.description || 'Servidor EnxadaHost')
                .setFooter({ text: `EnxadaHost · ID: ${env.PTERODACTYL_SERVER_ID}` })
                .setTimestamp();

            if (isRunning) {
                const memLimit = info.limits.memory > 0
                    ? `${info.limits.memory} MB`
                    : 'Ilimitado';

                embed.addFields(
                    { name: '⏱️ Uptime', value: formatUptime(res.uptime), inline: true },
                    { name: '🖥️ CPU', value: `${res.cpu_absolute.toFixed(1)}%`, inline: true },
                    { name: '​', value: '​', inline: true },
                    { name: '🧠 RAM', value: `${formatBytes(res.memory_bytes)} / ${memLimit}`, inline: true },
                    { name: '💾 Disco', value: formatBytes(res.disk_bytes), inline: true },
                    { name: '​', value: '​', inline: true },
                    { name: '📡 Rede ↓', value: formatBytes(res.network_rx_bytes), inline: true },
                    { name: '📡 Rede ↑', value: formatBytes(res.network_tx_bytes), inline: true },
                );
            } else {
                embed.addFields({
                    name: 'Informação',
                    value: 'Servidor offline. Recursos indisponíveis.',
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle('❌ Erro ao Buscar Status')
                        .setDescription(`\`${message}\``)
                        .setTimestamp(),
                ],
            });
        }
    }
}

export default new StatusCommand();
