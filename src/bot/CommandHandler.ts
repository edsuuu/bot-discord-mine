import { Collection } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { logger } from '../utils/logger.js';
import type { Command } from './commands/Command.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class CommandHandler {
    private readonly commands: Collection<string, Command>;

    public constructor() {
        this.commands = new Collection();
    }

    public async loadCommands(): Promise<void> {
        const commandsDir = join(__dirname, 'commands');
        const files = readdirSync(commandsDir).filter(
            f =>
                (f.endsWith('.ts') || f.endsWith('.js'))
                && !f.endsWith('.d.ts')
                && !f.startsWith('Command'),
        );

        for (const file of files) {
            const filePath = join(commandsDir, file);
            const module = await import(pathToFileURL(filePath).href) as { default?: Command };

            if (module.default?.data) {
                const command = module.default;
                this.commands.set(command.data.name, command);
                logger.info(`[CommandHandler] /${command.data.name} loaded`);
            }
        }
    }

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`[CommandHandler] Unknown command: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error(`[CommandHandler] Error in /${interaction.commandName}:`, error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const msg = {
                content: `Command failed: \`${errorMessage}\``,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => undefined);
            } else {
                await interaction.reply(msg).catch(() => undefined);
            }
        }
    }

    public getAll(): Collection<string, Command> {
        return this.commands;
    }
}
