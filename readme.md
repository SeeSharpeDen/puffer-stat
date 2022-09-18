# Installation

## Requirements
 - [Deno](https://deno.land/manual@v1.25.3/getting_started/installation).
 - An Internet connection.
 - A [discord bot Token](https://discord.com/developers/applications/).

## Usage
- Rename `config/examples.servers.json` to `config/servers.json` and edit the file accordingly.
- Set the `BOT_TOKEN` environment variable with your bot token.
- Run deno with `deno run --allow-read --allow-write --allow-env --allow-net mod.ts`