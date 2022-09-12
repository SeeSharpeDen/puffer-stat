import { DiscordEmbed, Embed, reset, TextStyles, transformEmbed } from "../deps.ts";

interface Token {
    access_token: String;
    token_type: String;
    expires_in: Number;
    scope: String;
}

export class Server {
    puffer: string;
    token?: Token;
    id: string;
    server_url: string;
    client_id: string;
    client_secret: string;
    command: string;
    regex: string[];
    embed_template: DiscordEmbed;

    constructor(json: any) {
        this.puffer = json.server_url.replace(/\/server\/[0-9a-f]*/i, "");
        {
            let match = json.server_url.match(/\/server\/([0-9a-f]*)/i);

            if (match != null && match.length > 1) {
                this.id = match[1];
            } else {
                throw new Error(`Server url '${json.server_url}' is invalid.`);
            }
        }
        this.server_url = json.server_url;
        this.client_id = json.client_id;
        this.client_secret = json.client_secret;
        this.command = json.command;
        this.regex = json.regex;
        this.embed_template = json.embed_template;
    }

    get authorization(): string {
        if (this.token != null) {
            return `${this.token.token_type} ${this.token.access_token}`;
        } else {
            return "";
        }
    }
}

export async function do_embed(server: Server): Promise<DiscordEmbed> {
    // Convert the embed to json text and search for our variable pattern.
    var embed_template = JSON.stringify(server.embed_template);
    const matches = Array.from(embed_template.matchAll(/\${([^}]*)}/g));

    var need_settings = false;
    var need_server = false;
    var need_command = false;

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

    const source: Source = {
        self: server,
    };

    // TODO Make each of these concurrent (all 3 at the same time)
    if (need_settings) {
        source.settings = (await get_server_data(server)).data;
    }
    if (need_server) {
        source.server = (await get_server(server)).server;
    }
    if (need_command) {
        const epoc = Math.floor(Date.now() / 1000) - 1;
        await post_command(server, server.command);
        const log = await get_server_log(server, epoc);

        source.regex = new Array<string>();

        for (let i = 0; i < server.regex.length; i++) {
            const regex = server.regex[i];
            const rg = new RegExp(regex, "g");
            for (const match of log.matchAll(rg)) {
                source.regex.push(match[1]);
            }
        }
    }

    for (const match in matches) {
        let key = matches[match][1];
        let pattern = matches[match][0];

        // @ts-ignore: This is some JS magic that converts a string into variables.
        let value: string = key.split(".").reduce((p, c) => p&&p[c]||null, source);

        if (value != null) {
            embed_template = embed_template.replaceAll(pattern, value);
        }
    }

    return JSON.parse(embed_template) as DiscordEmbed;
}

export function transform_embed(from: DiscordEmbed): Embed {
    return {
        title: from.title,
        type: from.type,
        description: from.description,
        url: from.url,
        timestamp: from.timestamp ? Date.parse(from.timestamp) : undefined,
        color: from.color,
        footer: from.footer
          ? {
            text: from.footer.text,
            iconUrl: from.footer.icon_url,
            proxyIconUrl: from.footer.proxy_icon_url,
          }
          : undefined,
        image: from.image
          ? {
            url: from.image.url,
            proxyUrl: from.image.proxy_url,
            height: from.image.height,
            width: from.image.width,
          }
          : undefined,
        thumbnail: from.thumbnail
          ? {
            url: from.thumbnail.url,
            proxyUrl: from.thumbnail.proxy_url,
            height: from.thumbnail.height,
            width: from.thumbnail.width,
          }
          : undefined,
        video: from.video
          ? {
            url: from.video.url,
            proxyUrl: from.video.proxy_url,
            height: from.video.height,
            width: from.video.width,
          }
          : undefined,
        provider: from.provider,
        author: from.author
          ? {
            name: from.author.name,
            url: from.author.url,
            iconUrl: from.author.icon_url,
            proxyIconUrl: from.author.proxy_icon_url,
          }
          : undefined,
        fields: from.fields,
      };
}


interface Source {
    self: any;
    regex?: Array<string>;
    server?: any;
    settings?: any;
}
// Get the server's details from puffer panel.
export async function get_server(server: Server): Promise<any> {
    if (server.token == null) {
        server.token = await get_token(server);
    }

    return await fetch(`${server.puffer}/api/servers/${server.id}`, {
        headers: { "Authorization": server.authorization },
    }).then(function (resp) {
        return resp.json();
    });
}

// Get the server's settings/data.
export async function get_server_data(server: Server): Promise<any> {
    if (server.token == null) {
        server.token = await get_token(server);
    }

    return await fetch(`${server.puffer}/daemon/server/${server.id}/data`, {
        headers: { "Authorization": server.authorization },
    }).then(auth).then(error).then(json);
}

// Send a command to the server.
export async function post_command(server: Server, command: string) {
    if (server.token == null) {
        server.token = await get_token(server);
    }

    let log = await fetch(`${server.puffer}/daemon/server/${server.id}/console`, {
        body: command,
        method: "POST",
        headers: { "Authorization": server.authorization },
    }).then(auth).then(error);
}

// Get the logs from the server.
export async function get_server_log(server: Server, epoc: Number): Promise<string> {
    if (server.token == null) {
        server.token = await get_token(server);
    }

    let log = await fetch(`${server.puffer}/daemon/server/${server.id}/console?time=${epoc}`, {
        headers: { "Authorization": server.authorization },
    }).then(auth).then(error).then(json);

    return log.logs;
}

async function auth(res: Response): Promise<Response> {
    if (res.status == 403) {
        let json = await res.json();
        let error = json.error;
        console.log(error);

        throw new Error(`Forbidden: ${error.code}: ${error.msg} ${error.metadata.scope}`);
    }
    return res;
}
async function error(res: Response): Promise<Response> {
    if (!res.ok) {
        let json = await res.json();
        let error = json.error;
        console.log(error);

        throw new Error(error);
    }
    return res;
}

async function json(res: Response): Promise<any> {
    return res.json();
}

async function get_token(server: Server): Promise<Token> {
    let response = await fetch(`${server.puffer}/oauth2/token`, {
        method: "POST",
        body: `grant_type=client_credentials&client_id=${server.client_id}&client_secret=${server.client_secret}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(function (resp) {
        return resp.json();
    });

    if (response.error) {
        throw new Error(`Token Error: ${response.error}`);
    }

    return response as Token;
}

export let servers = load_servers(JSON.parse(Deno.readTextFileSync("./servers.json")));

function load_servers(json: any): Server[] {
    let servers = new Array<Server>();
    json.forEach((server: any) => {
        servers.push(new Server(server));
    });

    return servers;
}
