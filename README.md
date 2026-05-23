# discord-enxada

Bot do Discord para controlar um servidor no painel da EnxadaHost/Pterodactyl.

## Comandos

- `/start` - liga o servidor.
- `/stop` - para o servidor.
- `/stop force:true` - força o desligamento do servidor.
- `/restart` - reinicia o servidor.
- `/status` - mostra status, uptime e uso de recursos.
- `/players` - lista jogadores online.
- `/limpar-chao` - agenda limpeza dos itens do chão.
- `/limpar-chao delay:60` - agenda limpeza com atraso em segundos.
- `/cancelar-limpeza` - cancela a limpeza agendada.

## Configuração

Crie o `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Preencha as variáveis do Discord e do painel da EnxadaHost/Pterodactyl.

## Instalação

```bash
pnpm install
```

## Desenvolvimento

```bash
pnpm dev
```

## Produção

```bash
pnpm build
pnpm start
```

## Registrar comandos no Discord

```bash
node --env-file=.env --import jiti/register src/bot/DeployCommands.ts
```
