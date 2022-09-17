import { Embed } from "../deps.ts";

export class Token {
    access_token: string = "";
    token_type: string = "";
    expires_in: number = NaN;
    scope: string = "";
}

export class Server {
    url: string = "";
    client: string = "";
    secret: string = "";

    // These are inferred from the url.
    id: string = "";
    api: string = "";

    constructor(json: any) {
        this.url = json.url;
        this.client = json.client;
        this.secret = json.secret;

        // Get the root url and server ID from the provided url.
        let match = json.url.match(/(https?:\/\/.*)\/server\/([0-9a-f]{8})/i);
        if (match.length == 3) {
            this.id = match[2];
            this.api = match[1];
        } else {
            throw new Error(`Invalid Server URL '${json.url}'`);
        }
    }
}

export class GameServer {
    server: Server;
    token?: Token;
    command?: string;
    regex: Record<string, string>;
    embed: string;

    constructor(json: any) {
        this.server = new Server(json.server);
        this.command = json.command;
        this.regex = json.regex;
        this.embed = json.embed;
    }
}

interface Source {
    self: any;
    regex: Record<string, string>;
    server?: any;
    settings?: any;
}

export async function do_embed(gs: GameServer): Promise<Embed> {
    var embed_template = await Deno.readTextFile(`./config/embeds/${gs.embed}`);

    // Get all strings starting with '${' and ending with '} (${name})';
    const matches = Array.from(embed_template.matchAll(/\${([^}]*)}/g));

    // Figure out what requests we need to make to pufferpanel.
    var need_settings, need_server, need_command = false;

    for (const key in matches) {
        let value = matches[key][1];
        if (!need_settings && value.startsWith("settings.")) {
            need_settings = true;
        } else if (!need_server && value.startsWith("server.")) {
            need_server = true;
        } else if (!need_command && value.startsWith("regex.")) {
            need_command = true;
        }
    }

    // TODO: Remove secret & token from source so embeds cant leak oauth access.
    const source: Source = {
        self: gs,
        regex: {},
    };

    // TODO Make each of these concurrent (all 3 at the same time)
    if (need_settings) {
        source.settings = (await get_server_data(gs)).data;
    }
    if (need_server) {
        source.server = (await get_server(gs)).server;
    }
    if (need_command) {
        if (gs.command == null) {
            throw new Error("Server Config doesn't have a command but embed requires it.");
        }

        const log = await send_command(gs, gs.command);

        for (const key in gs.regex) {
            const rg = new RegExp(gs.regex[key], "g");
            for (const match of log.matchAll(rg)) {
                source.regex[key] = match[1];
            }
        }
    }

    for (const match in matches) {
        let key = matches[match][1];
        let pattern = matches[match][0];

        // @ts-ignore: This is some JS magic that converts a string into variables.
        let value: string = key.split(".").reduce((p, c) => p && p[c] || null, source);

        embed_template = embed_template.replaceAll(pattern, value);

        if (value != null) {
            embed_template = embed_template.replaceAll(pattern, value);
        }
    }

    return JSON.parse(embed_template) as Embed;
}

async function puffer_request(gs: GameServer, url: string, method?: string, body?: string): Promise<Response> {
    console.log(url);

    if (gs.token == null) {
        // No token, get a new one.
        gs.token = await get_token(gs);
    }

    let result = await fetch(url, {
        body: body,
        method: method,
        headers: { "Authorization": `${gs.token?.token_type} ${gs.token?.access_token}` },
    }).then(async function (res: Response) {
        // If the request is 403... get a new token.
        if (res.status == 403) {
            let json = await res.json();
            let error = json.error;
            console.log(error);
            console.warn(`Forbidden: ${error.code}: ${error.msg} ${error.metadata.scope}`);
        }
        return res;
    }).then(error);

    return result;
}

// Get the server's details from puffer panel.
export async function get_server(gs: GameServer): Promise<any> {
    return await puffer_request(gs, `${gs.server.api}/api/servers/${gs.server.id}`).then(json);
}

// Get the server's settings/data.
export async function get_server_data(gs: GameServer): Promise<any> {
    return await puffer_request(gs, `${gs.server.api}/daemon/server/${gs.server.id}/data`).then(json);
}

// Send a command to the server.
export async function post_command(gs: GameServer, command: string) {
    await puffer_request(gs, `${gs.server.api}/daemon/server/${gs.server.id}/console`, "POST", command);
}

// Get the logs from the server.
export async function get_server_log(gs: GameServer, epoc: Number): Promise<string> {
    const log = await puffer_request(gs, `${gs.server.api}/daemon/server/${gs.server.id}/console?time=${epoc}`).then(
        json,
    );
    return log.logs;
}

// Send a command to the server and get recent logs from the console..
export async function send_command(gs: GameServer, command: string) {
    // TODO: Find out if we can get closer to now (1 second atm 🤯)
    const epoc = Math.floor(Date.now() / 1000) - 1;

    // Send the command to the console and wait.
    await puffer_request(gs, `${gs.server.api}/daemon/server/${gs.server.id}/console`, "POST", command);

    // Get and wait for the last 1 seconds from the console then return the results.
    const log = await puffer_request(gs, `${gs.server.api}/daemon/server/${gs.server.id}/console?time=${epoc}`).then(
        json,
    );
    return log.logs;
}

/// pufferpanel json.
async function error(res: Response): Promise<Response> {
    if (!res.ok) {
        var error = new Error("Http Response Error");
        let text = await res.text();
        try {
            let json = JSON.parse(text);
            let error = json.error;
            console.log(error);
            error = new Error(error);
        } catch {
            error = new Error(`${res.status}: ${res.statusText}. ${text}`);
        }

        throw error;
    }
    return res;
}

/// fetch json.
async function json(res: Response): Promise<any> {
    return res.json();
}

/// Get's an access token for a game server.
async function get_token(gs: GameServer): Promise<Token> {
    let response = await fetch(`${gs.server.api}/oauth2/token`, {
        method: "POST",
        body: `grant_type=client_credentials&client_id=${gs.server.client}&client_secret=${gs.server.secret}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(function (resp) {
        return resp.json();
    });

    if (response.error) {
        throw new Error(`Token Error: ${response.error}`);
    }

    console.log(`New Token for ${gs.server.url}`);

    return response as Token;
}

/// Get all the game servers.
export let game_servers = load_game_servers(JSON.parse(Deno.readTextFileSync("./config/servers.json")));
function load_game_servers(json: any): GameServer[] {
    let servers = new Array<GameServer>();
    json.forEach((server: any) => {
        servers.push(new GameServer(server));
    });

    return servers;
}
