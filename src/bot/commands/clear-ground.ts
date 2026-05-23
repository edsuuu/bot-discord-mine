import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { groundCleanupScheduler } from '../../services/GroundCleanupScheduler.js';
import type { Command } from './Command.js';

class ClearGroundCommand implements Command {
    private static readonly DEFAULT_DELAY_SECONDS = 5;

    public readonly data = new SlashCommandBuilder()
        .setName('limpar-chao')
        .setDescription('Agenda uma limpeza de itens do chão no servidor')
        .addIntegerOption(option =>
            option
                .setName('delay')
                .setDescription('Segundos antes de iniciar a limpeza')
                .setMinValue(0)
                .setMaxValue(600),
        );

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const delaySeconds = interaction.options.getInteger('delay') ?? ClearGroundCommand.DEFAULT_DELAY_SECONDS;

        try {
            await groundCleanupScheduler.schedule(interaction, delaySeconds);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle('❌ Erro na Limpeza do Chão')
                        .setDescription(`\`${message}\``)
                        .setTimestamp(),
                ],
            });
        }
    }
}

export default new ClearGroundCommand();
