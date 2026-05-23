import { Client, Events, GatewayIntentBits } from "discord.js";

import { CommandHandler } from "@/bot/CommandHandler";
import { Commands } from "@/bot/commands/Commands";
import { env } from "@/config/Env";
import { logger } from "@/utils/Logger";

export class DiscordBot {
    private readonly client: Client;
    private readonly commandHandler: CommandHandler;
    private keepAliveTimer?: NodeJS.Timeout;

    public constructor() {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds],
        });

        const commands = new Commands();
        this.commandHandler = new CommandHandler(commands.getDefinitions());
    }

    public async bootstrap(): Promise<void> {
        this.registerEvents();
        await this.client.login(env.DISCORD_TOKEN);
        this.keepProcessAlive();
    }

    private registerEvents(): void {
        this.client.once(Events.ClientReady, (readyClient) => {
            logger.info(`[DiscordBot] Online como: ${readyClient.user.tag}`);
            logger.info(
                `[DiscordBot] Guilds: ${readyClient.guilds.cache.size}`,
            );
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            logger.info(
                `[DiscordBot] Slash command recebido: /${interaction.commandName}`,
            );
            await this.commandHandler.execute(interaction);
        });

        this.client.on(Events.Error, (err) => {
            logger.error("[DiscordBot] Erro do client:", err);
        });
    }

    private keepProcessAlive(): void {
        this.keepAliveTimer ??= setInterval(() => undefined, 60_000);
    }
}
