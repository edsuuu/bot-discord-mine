import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
    DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
    PTERODACTYL_URL: z.string().min(1, 'PTERODACTYL_URL is required'),
    PTERODACTYL_TOKEN: z.string().min(1, 'PTERODACTYL_TOKEN is required'),
    PTERODACTYL_SERVER_ID: z.string().min(1, 'PTERODACTYL_SERVER_ID is required'),
    DISCORD_WEBHOOK_URL: z.string().url('DISCORD_WEBHOOK_URL must be a valid URL').optional().or(z.literal('')),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:');
    for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

export const env = parsed.data;
