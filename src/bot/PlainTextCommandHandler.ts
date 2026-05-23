import { EmbedBuilder, Events } from 'discord.js';
import type { Client, Message } from 'discord.js';

import { DiscordWebhookService } from '../services/DiscordWebhookService.js';
import { PterodactylService } from '../services/PterodactylService.js';
import { formatBytes, formatUptime, statusEmoji, statusLabel } from '../utils/formatter.js';
import { logger } from '../utils/logger.js';

const COLOR_MAP = {
    running: 0x22c55e,
    starting: 0xeab308,
    stopping: 0xf97316,
    offline: 0xef4444,
} as const;

export class PlainTextCommandHandler {
    private readonly service = new PterodactylService();
    private readonly webhook = new DiscordWebhookService();

    public register(client: Client): void {
        client.on(Events.MessageCreate, async message => {
            if (message.author.bot) return;

            const command = message.content.trim().toLowerCase();
            if (!command.startsWith('/')) return;

            try {
                await this.handle(message, command);
            } catch (error) {
                logger.error(`[PlainTextCommandHandler] Error in ${command}:`, error);
                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xef4444)
                            .setTitle('Command failed')
                            .setDescription(`\`${error instanceof Error ? error.message : 'Unknown error'}\``),
                    ],
                });
            }
        });
    }

    private async handle(message: Message, command: string): Promise<void> {
        if (command === '/status') {
            await message.reply({ embeds: [await this.createStatusEmbed()] });
            return;
        }

        if (command === '/players') {
            await message.reply({ embeds: [await this.createPlayersEmbed()] });
            return;
        }

        if (command === '/start') {
            await this.service.start();
            await this.webhook.sendAction('Server starting', `Start signal sent by ${message.author.tag}.`, 0x22c55e);
            await message.reply({ embeds: [this.createActionEmbed('Server starting', 'The **start** signal was sent successfully.', 0x22c55e)] });
            return;
        }

        if (command === '/restart') {
            await this.service.restart();
            await this.webhook.sendAction('Server restarting', `Restart signal sent by ${message.author.tag}.`, 0xeab308);
            await message.reply({ embeds: [this.createActionEmbed('Server restarting', 'The **restart** signal was sent successfully.', 0xeab308)] });
            return;
        }

        if (command === '/stop') {
            await this.service.stop();
            await this.webhook.sendAction('Server stopping', `Stop requested by ${message.author.tag}.`, 0xf97316);
            await message.reply({ embeds: [this.createActionEmbed('Server stopping', 'The **stop** signal was sent successfully.', 0xf97316)] });
        }
    }

    private async createStatusEmbed(): Promise<EmbedBuilder> {
        const [resources, info] = await Promise.all([
            this.service.getResources(),
            this.service.getServerInfo(),
        ]);
        const state = resources.current_state;
        const res = resources.resources;
        const embed = new EmbedBuilder()
            .setColor(COLOR_MAP[state] ?? 0x71717a)
            .setTitle(`${statusEmoji(state)} ${info.name} - ${statusLabel(state)}`)
            .setDescription(info.description || 'EnxadaHost server')
            .setTimestamp();

        if (state !== 'running') {
            return embed.addFields({ name: 'Information', value: 'Server offline. Resources unavailable.' });
        }

        const memLimit = info.limits.memory > 0 ? `${info.limits.memory} MB` : 'Unlimited';
        return embed.addFields(
            { name: 'Uptime', value: formatUptime(res.uptime), inline: true },
            { name: 'CPU', value: `${res.cpu_absolute.toFixed(1)}%`, inline: true },
            { name: 'RAM', value: `${formatBytes(res.memory_bytes)} / ${memLimit}`, inline: true },
            { name: 'Disk', value: formatBytes(res.disk_bytes), inline: true },
            { name: 'Network In', value: formatBytes(res.network_rx_bytes), inline: true },
            { name: 'Network Out', value: formatBytes(res.network_tx_bytes), inline: true },
        );
    }

    private async createPlayersEmbed(): Promise<EmbedBuilder> {
        const resources = await this.service.getResources();
        if (resources.current_state !== 'running') {
            return new EmbedBuilder()
                .setColor(0xef4444)
                .setTitle('Server offline')
                .setDescription('The server must be online to query players.');
        }

        const lines = await this.service.sendConsoleCommand('list', 8_000);
        const playerLine = this.findPlayerLine(lines);

        if (playerLine) {
            return new EmbedBuilder()
                .setColor(0x22c55e)
                .setTitle('Online players')
                .setDescription(playerLine);
        }

        const rawOutput = lines.length > 0
            ? lines.slice(-10).join('\n')
            : '*(nenhuma linha capturada)*';

        return new EmbedBuilder()
            .setColor(0xeab308)
            .setTitle('⚠️ Output bruto do console')
            .setDescription(`\`\`\`\n${rawOutput.slice(0, 1800)}\n\`\`\``)
            .setFooter({ text: 'Padrão não reconhecido — use para ajustar o parser' });
    }

    private createActionEmbed(title: string, description: string, color: number): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
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
