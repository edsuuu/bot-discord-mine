# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Bot do Discord que controla um servidor de Minecraft hospedado em um painel Pterodactyl da EnxadaHost. Os slash commands (`/start`, `/stop`, `/restart`, `/status`, `/players`, `/limpar-chao`, `/cancelar-limpeza`) acionam a API client do Pterodactyl e o console WebSocket do painel. **Todas as mensagens visíveis ao usuário são em PT-BR** — mantenha qualquer texto novo (embeds, descrições de comandos, erros) também em PT-BR.

## Comandos

Gerenciador de pacotes é **pnpm** (ver `.npmrc`). Todos os scripts Node usam `--env-file=.env`, então um `.env` preenchido (ver `.env.example`) é obrigatório.

- `pnpm dev` — roda direto do source com `nodemon` + `tsx` em modo watch
- `pnpm build` — empacota em `dist/` com `tsup` (ESM, node20)
- `pnpm start` — executa o bundle gerado (`dist/Main.js`)
- `pnpm lint` — ESLint no repositório
- `npx tsc --noEmit` — só checagem de tipos (sem alias no `scripts`)
- `node --env-file=.env --import jiti/register src/bot/DeployCommands.ts` — re-registra os slash commands no Discord (rode depois de adicionar/alterar um comando em `src/bot/commands/Commands.ts`)

## Arquitetura

Entry point `src/Main.ts` instancia `DiscordBot`, que:

1. Cria um `Commands` novo (`src/bot/commands/Commands.ts`) e passa o array de `getDefinitions()` para o `CommandHandler`.
2. Loga no Discord com **apenas** `GatewayIntentBits.Guilds` — não há handler de message content; toda interação é via slash commands.
3. Mantém o processo vivo com um timer periódico (workaround para ambientes que finalizam o processo quando ocioso).

`CommandHandler` é só uma `Collection<nome, CommandDefinition>` com dispatch e helper de erro — ele **não** lê arquivos de disco. A fonte única dos comandos é `Commands.getDefinitions()`. Para adicionar um comando: insira uma entrada nesse array e rode o passo de deploy acima. `DeployCommands.ts` lê o mesmo array, então as definições nunca divergem entre runtime e registro no Discord.

`BaseCommand` (em `src/bot/commands/BaseCommand.ts`) expõe helpers compartilhados (`sleep`, `replyError`) e define a interface `CommandDefinition`. `Commands` herda dela; cada comando é um método privado, plugado no array de definições por arrow callback.

`PterodactylService` encapsula dois transportes contra a API client do Pterodactyl:

- REST (`/api/client`) para sinais de power, resources, info do servidor e `sendCommand` fire-and-forget.
- WebSocket do console para `sendConsoleCommand(cmd, timeout)` (envia um comando e coleta saída até o timeout) e `waitForConsolePattern(regex, timeout)` (listen-only, resolve quando uma linha do console bate com o regex — usado para detectar a linha `Done (Xs)!` do Minecraft).

Códigos de escape ANSI são removidos da saída do console em `cleanConsoleLine`. O `origin` do WebSocket precisa ser igual à raiz do painel (o código deriva isso removendo `/api/client` de `PTERODACTYL_URL`).

`GroundCleanupScheduler` é um **singleton de módulo** (`groundCleanupScheduler`) que guarda no máximo um `setTimeout` pendente e a `ChatInputCommandInteraction` que o agendou. `/limpar-chao` e `/cancelar-limpeza` leem/escrevem nesse singleton — não instancie a classe em outro lugar ou quebra o invariante de "um job ativo". A fase de countdown manda mensagens `say` no jogo em checkpoints fixos (60/30/10/5/3/2/1s) usando `sendCommand` via REST (e **não** o WebSocket) pra manter o timing preciso.

`Logger.ts` posta **apenas logs de erro** em `LOG_WEBHOOK_URL` (opcional). Não há webhook separado para anúncios de ações visíveis ao usuário.

`src/config/Env.ts` valida as variáveis de ambiente com Zod no startup e chama `process.exit(1)` em caso de falha. Importe `env` daqui; não leia `process.env` direto em outros lugares (a leitura de `LOG_WEBHOOK_URL` no logger é a única exceção deliberada, para evitar import circular).

## Convenções

- **Alias de path**: `@/*` → `src/*` (configurado em `tsconfig.json` e no `eslint-plugin-import`). Use em vez de caminhos relativos entre diretórios top-level.
- **Sistema de módulos**: ESM com `moduleResolution: "bundler"`. Imports **não** usam extensão `.js` (o tsup cuida do bundling); não adicione.
- **Nomes de arquivo**: PascalCase em todos os `.ts` dentro de `src/`, inclusive utilitários (`Formatter.ts`, `Logger.ts`).
- **ESLint**: indentação 4 espaços, aspas simples, `explicit member accessibility` em classes, imports alfabetizados com `@/*` no grupo `internal`. Rode `pnpm lint` antes de commitar.
- **Build**: `tsup` empacota `src/Main.ts` e `src/bot/DeployCommands.ts` como entries separadas. Não adicione um build com `tsc` — `pnpm build` usa só o tsup.
- **Idioma do produto**: PT-BR em embeds, descrições de comandos e mensagens de erro. Logs internos e código (variáveis, comentários técnicos) podem ficar em inglês.
