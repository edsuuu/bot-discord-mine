import { DiscordBot } from "@/bot/DiscordBot";

const bot = new DiscordBot();

bot.bootstrap().catch((err: unknown) => {
    console.error("[main] Failed to start bot:", err);
    process.exit(1);
});
