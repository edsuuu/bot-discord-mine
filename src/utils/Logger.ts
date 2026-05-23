const FMT = {
    reset: "\x1b[0m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
};

function ts(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function postToDiscord(message: string, stack?: string): Promise<void> {
    const url = process.env["LOG_WEBHOOK_URL"];
    if (!url) return;

    const description = stack
        ? `${message}\n\`\`\`\n${stack.slice(0, 1500)}\n\`\`\``
        : message;

    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [
                {
                    title: "❌ Erro na Aplicação",
                    description: description.slice(0, 4096),
                    color: 0xef4444,
                    timestamp: new Date().toISOString(),
                    footer: { text: "discord-enxada · logger" },
                },
            ],
        }),
    }).catch(() => undefined);
}

export const logger = {
    info(msg: string): void {
        console.log(
            `${FMT.gray}[${ts()}]${FMT.reset} ${FMT.cyan}info${FMT.reset}: ${msg}`,
        );
    },

    warn(msg: string): void {
        console.warn(
            `${FMT.gray}[${ts()}]${FMT.reset} ${FMT.yellow}warn${FMT.reset}: ${msg}`,
        );
    },

    error(msg: string, err?: unknown): void {
        const stack = err instanceof Error ? err.stack : undefined;
        console.error(
            `${FMT.gray}[${ts()}]${FMT.reset} ${FMT.red}error${FMT.reset}: ${msg}${stack ? "\n" + stack : ""}`,
        );
        void postToDiscord(msg, stack);
    },
};
