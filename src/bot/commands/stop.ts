import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { DiscordWebhookService } from '../../services/DiscordWebhookService.js';
import { PterodactylService } from '../../services/PterodactylService.js';
import type { Command } from './Command.js';

class StopCommand implements Command {
    public readonly data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Para o servidor de jogo')
        .addBooleanOption(opt =>
            opt
                .setName('force')
                .setDescription('Forçar parada imediata (kill) sem salvar')
                .setRequired(false),
        );

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const force = interaction.options.getBoolean('force') ?? false;

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_stop')
                .setLabel(force ? '⚡ Confirmar Kill' : '🛑 Confirmar Parada')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_stop')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf97316)
                    .setTitle(force ? '⚡ Forçar parada?' : '🛑 Confirmar desligamento?')
                    .setDescription(
                        force
                            ? 'Isso vai **matar o processo** imediatamente, sem salvar dados.'
                            : 'Isso vai **parar o servidor** de forma segura. Confirma?',
                    )
                    .setFooter({ text: 'Responda em 30 segundos' }),
            ],
            components: [confirmRow],
            fetchReply: true,
        });

        try {
            const confirmation = await reply.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                componentType: ComponentType.Button,
                time: 30_000,
            });

            if (confirmation.customId === 'cancel_stop') {
                await confirmation.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x71717a)
                            .setTitle('Cancelado')
                            .setDescription('Ação de desligamento cancelada.'),
                    ],
                    components: [],
                });
                return;
            }

            await confirmation.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xf97316)
                        .setTitle('⏳ Processando...')
                        .setDescription('Enviando sinal de parada...'),
                ],
                components: [],
            });

            const service = new PterodactylService();
            await (force ? service.kill() : service.stop());
            await new DiscordWebhookService().sendAction(
                force ? 'Servidor Finalizado (Kill)' : 'Servidor Parando',
                `${force ? 'Kill' : 'Parada'} solicitado por ${interaction.user.tag}.`,
                force ? 0xef4444 : 0xf97316,
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle(force ? '⚡ Servidor Finalizado (Kill)' : '🛑 Servidor Parando')
                        .setDescription(
                            force
                                ? 'O processo foi **encerrado forçadamente**.'
                                : 'Sinal de **parada** enviado com sucesso.',
                        )
                        .addFields({ name: 'Solicitado por', value: interaction.user.toString(), inline: true })
                        .setFooter({ text: 'EnxadaHost · Pterodactyl' })
                        .setTimestamp(),
                ],
                components: [],
            });
        } catch (error) {
            const isTimeout = error instanceof Error && error.message.includes('time');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x71717a)
                        .setTitle(isTimeout ? '⏱️ Tempo Esgotado' : '❌ Erro')
                        .setDescription(
                            isTimeout
                                ? 'Nenhuma confirmação recebida. Ação cancelada.'
                                : `\`${error instanceof Error ? error.message : 'Erro desconhecido'}\``,
                        ),
                ],
                components: [],
            });
        }
    }
}

export default new StopCommand();
