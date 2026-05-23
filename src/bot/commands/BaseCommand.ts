import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export interface CommandDefinition {
    readonly data: { readonly name: string; toJSON(): object };

    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export abstract class BaseCommand {
    protected sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    protected async replyError(
        interaction: ChatInputCommandInteraction,
        title: string,
        error: unknown,
    ): Promise<void> {
        const message =
            error instanceof Error ? error.message : "Erro desconhecido";
        const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(title)
            .setDescription(`\`${message}\``)
            .setTimestamp();

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
}
