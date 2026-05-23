import { Client, Events, GatewayIntentBits } from 'discord.js';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { CommandHandler } from './CommandHandler.js';
import { PlainTextCommandHandler } from './PlainTextCommandHandler.js';

export class DiscordBot {
    private readonly client: Client;
    private readonly commandHandler: CommandHandler;
    private readonly plainTextCommandHandler: PlainTextCommandHandler;
    private keepAliveTimer?: NodeJS.Timeout;

    public constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });
        this.commandHandler = new CommandHandler();
        this.plainTextCommandHandler = new PlainTextCommandHandler();
    }

    public async bootstrap(): Promise<void> {
        await this.commandHandler.loadCommands();
        this.registerEvents();
        this.plainTextCommandHandler.register(this.client);
        await this.client.login(env.DISCORD_TOKEN);
        this.keepProcessAlive();
    }

    private registerEvents(): void {
        this.client.once(Events.ClientReady, readyClient => {
            logger.info(`[DiscordBot] Online as: ${readyClient.user.tag}`);
            logger.info(`[DiscordBot] Guilds: ${readyClient.guilds.cache.size}`);

            const names = [...this.commandHandler.getAll().keys()].map(n => `/${n}`).join(', ');
            logger.info(`[DiscordBot] Commands: ${names}`);
        });

        this.client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;

            logger.info(`[DiscordBot] Slash command received: /${interaction.commandName}`);
            await this.commandHandler.execute(interaction);
        });

        this.client.on(Events.Error, err => {
            logger.error('[DiscordBot] Client error:', err);
        });
    }

    private keepProcessAlive(): void {
        this.keepAliveTimer ??= setInterval(() => undefined, 60_000);
    }
}
