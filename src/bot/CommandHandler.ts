import type { ChatInputCommandInteraction } from "discord.js";
import { Collection } from "discord.js";

import type { CommandDefinition } from "@/bot/commands/BaseCommand";
import { logger } from "@/utils/Logger";

export class CommandHandler {
    private readonly commands: Collection<string, CommandDefinition>;

    public constructor(definitions: CommandDefinition[]) {
        this.commands = new Collection(
            definitions.map((d) => [d.data.name, d]),
        );

        const names = [...this.commands.keys()].map((n) => `/${n}`).join(", ");
        logger.info(
            `[CommandHandler] ${this.commands.size} comandos registrados: ${names}`,
        );
    }

    public async execute(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(
                `[CommandHandler] Comando desconhecido: /${interaction.commandName}`,
            );
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error(
                `[CommandHandler] Erro em /${interaction.commandName}:`,
                error,
            );

            const errorMessage =
                error instanceof Error ? error.message : "Erro desconhecido";
            const msg = { content: `Comando falhou: \`${errorMessage}\`` };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => undefined);
            } else {
                await interaction.reply(msg).catch(() => undefined);
            }
        }
    }

    public getAll(): Collection<string, CommandDefinition> {
        return this.commands;
    }
}
