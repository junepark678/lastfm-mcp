import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { loadConfig, type EnvLike } from "./config";
import { LastfmApiError, LastfmClient } from "./lastfm";
import { resolvePagination } from "./models";

interface Env extends EnvLike {}

function createServer(env: Env) {
  const config = loadConfig(env);
  const server = new McpServer({ name: "lastfm-public-mcp", version: "0.2.0" });
  const client = new LastfmClient(config);

  server.tool("artist_search", "Search public artists by name.", {
    artist: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, async ({ artist, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("artist.search", { artist, ...pagination });
  }));

  server.tool("artist_get_info", "Get public info for an artist.", {
    artist: z.string().min(1),
    autocorrect: z.number().int().min(0).max(1).default(1),
    lang: z.string().optional(),
  }, async ({ artist, autocorrect, lang }) => safeToolCall(async () =>
    client.call("artist.getInfo", { artist, autocorrect, lang })));

  server.tool("track_search", "Search public tracks by name.", {
    track: z.string().min(1),
    artist: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, async ({ track, artist, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("track.search", { track, artist, ...pagination });
  }));

  server.tool("track_get_info", "Get public info for a track.", {
    track: z.string().min(1),
    artist: z.string().min(1),
    autocorrect: z.number().int().min(0).max(1).default(1),
  }, async ({ track, artist, autocorrect }) => safeToolCall(async () =>
    client.call("track.getInfo", { track, artist, autocorrect })));

  server.tool("album_get_info", "Get public info for an album.", {
    artist: z.string().min(1),
    album: z.string().min(1),
    autocorrect: z.number().int().min(0).max(1).default(1),
    lang: z.string().optional(),
  }, async ({ artist, album, autocorrect, lang }) => safeToolCall(async () =>
    client.call("album.getInfo", { artist, album, autocorrect, lang })));

  server.tool("chart_get_top_artists", "Get top artists from Last.fm public charts.", {
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, async ({ page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("chart.getTopArtists", pagination);
  }));

  server.tool("tag_get_top_tracks", "Get top tracks by public tag.", {
    tag: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, async ({ tag, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("tag.getTopTracks", { tag, ...pagination });
  }));

  server.tool("geo_get_top_artists", "Get top artists for a country.", {
    country: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, async ({ country, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("geo.getTopArtists", { country, ...pagination });
  }));

  return server;
}

async function safeToolCall(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return toolResult(data);
  } catch (error: unknown) {
    if (error instanceof LastfmApiError) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, details: error.details }, null, 2) }],
        structuredContent: { error: error.message, details: error.details },
      };
    }

    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ error: "Unexpected server error" }, null, 2) }],
      structuredContent: { error: "Unexpected server error" },
    };
  }
}

function toolResult(data: unknown) {
  const structuredContent = (typeof data === "object" && data !== null ? data : { value: data }) as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const server = createServer(env);
    await server.connect(transport);

    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  },
};
