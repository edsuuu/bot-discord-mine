import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { groundCleanupScheduler } from '../../services/GroundCleanupScheduler.js';
import type { Command } from './Command.js';

class CancelCleanupCommand implements Command {
    public readonly data = new SlashCommandBuilder()
        .setName('cancelar-limpeza')
        .setDescription('Cancela a limpeza do chão agendada antes de executar');

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const cancelled = await groundCleanupScheduler.cancel();

        if (cancelled) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle('Limpeza Cancelada')
                        .setDescription('A limpeza agendada foi cancelada com sucesso.')
                        .setTimestamp(),
                ],
            });
            return;
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x64748b)
                    .setTitle('Nenhuma Limpeza Agendada')
                    .setDescription('Não há nenhuma limpeza ativa para cancelar.')
                    .setTimestamp(),
            ],
        });
    }
}

export default new CancelCleanupCommand();
