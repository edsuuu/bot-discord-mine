import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { PterodactylService } from '../../services/PterodactylService.js';
import type { Command } from './Command.js';

class PlayersCommand implements Command {
    public readonly data = new SlashCommandBuilder()
        .setName('players')
        .setDescription('Lista os jogadores online via console do servidor');

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const service = new PterodactylService();

        try {
            const resources = await service.getResources();

            if (resources.current_state !== 'running') {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xef4444)
                            .setTitle('🔴 Servidor Offline')
                            .setDescription('O servidor precisa estar online para buscar jogadores.')
                            .setTimestamp(),
                    ],
                });
                return;
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle('🔍 Buscando jogadores...')
                        .setDescription('Enviando `list` ao console do servidor.'),
                ],
            });

            const lines = await service.sendConsoleCommand('list', 8_000);
            const playerLine = this.findPlayerLine(lines);

            if (playerLine) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle('👥 Jogadores Online')
                            .setDescription(playerLine)
                            .setTimestamp(),
                    ],
                });
                return;
            }

            const rawOutput = lines.length > 0
                ? lines.slice(-10).join('\n')
                : '*(nenhuma linha capturada — verifique se o WebSocket está funcionando)*';

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xeab308)
                        .setTitle('⚠️ Padrão não reconhecido — output bruto')
                        .setDescription(`\`\`\`\n${rawOutput.slice(0, 1800)}\n\`\`\``)
                        .setFooter({ text: 'Cole este output para ajustar o padrão de busca' })
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xef4444)
                        .setTitle('❌ Erro ao Buscar Jogadores')
                        .setDescription(`\`${message}\``)
                        .setTimestamp(),
                ],
            });
        }
    }

    private findPlayerLine(lines: string[]): string | null {
        return lines
            .slice()
            .reverse()
            .find(line => this.isPlayerListLine(line)) ?? null;
    }

    private isPlayerListLine(line: string): boolean {
        const l = line.toLowerCase();
        return (
            l.includes('players online')
            || l.includes('online players')
            || (l.includes('there are') && l.includes('player'))
            || l.includes('jogadores online')
            || (l.includes('há') && l.includes('jogador'))
            || /\d+\s+of\s+a\s+max\s+of\s+\d+/.test(l)
            || /\(\d+\/\d+\)/.test(l)
            || l.includes('no players are online')
            || l.includes('nenhum jogador')
        );
    }
}

export default new PlayersCommand();
