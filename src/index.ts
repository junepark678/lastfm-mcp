import { createMcpHandler } from "agents/mcp";
import { codeMcpServer } from "@cloudflare/codemode/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createUserSchema, createUsernameSchema } from "./schemas";
import { loadConfig, type EnvLike } from "./config";
import { LastfmApiError, LastfmClient } from "./lastfm";
import { resolvePagination } from "./models";
import { QuickJsWasmExecutor } from "./quickjs-wasm-executor";
import * as Sentry from "@sentry/cloudflare";

type Env = EnvLike;

const READ_ONLY_TOOL_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
} as const;

const PUBLIC_READ_ONLY_TOOL_HINTS = {
  ...READ_ONLY_TOOL_HINTS,
  openWorldHint: true,
} as const;

function createServer(env: Env, usernameFromQuery?: string) {
  const config = loadConfig(env);
  const server = new McpServer({ name: "lastfm-public-mcp", version: "0.3.0" });
  Sentry.wrapMcpServerWithSentry(
    server as unknown as object,
    { recordInputs: false, recordOutputs: false },
  );
  const client = new LastfmClient(config);
  const usernameSchema = createUsernameSchema(usernameFromQuery);
  const userSchema = createUserSchema(usernameFromQuery);

  server.tool("artist_search", "Search public artists by name.", {
    artist: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ artist, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("artist.search", { artist, ...pagination });
  }));

  server.tool("artist_get_info", "Get public info for an artist.", {
    artist: z.string().min(1),
    username: usernameSchema,
    autocorrect: z.number().int().min(0).max(1).default(1),
    lang: z.string().optional(),
  }, READ_ONLY_TOOL_HINTS, async ({ artist, username, autocorrect, lang }) => safeToolCall(async () =>
    client.call("artist.getInfo", { artist, username: username ?? usernameFromQuery, autocorrect, lang })));

  server.tool("track_search", "Search public tracks by name.", {
    track: z.string().min(1),
    artist: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ track, artist, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("track.search", { track, artist, ...pagination });
  }));

  server.tool("track_get_info", "Get public info for a track.", {
    track: z.string().min(1),
    artist: z.string().min(1),
    username: usernameSchema,
    autocorrect: z.number().int().min(0).max(1).default(1),
  }, READ_ONLY_TOOL_HINTS, async ({ track, artist, username, autocorrect }) => safeToolCall(async () =>
    client.call("track.getInfo", { track, artist, username: username ?? usernameFromQuery, autocorrect })));

  server.tool("album_get_info", "Get public info for an album.", {
    artist: z.string().min(1),
    album: z.string().min(1),
    username: usernameSchema,
    autocorrect: z.number().int().min(0).max(1).default(1),
    lang: z.string().optional(),
  }, READ_ONLY_TOOL_HINTS, async ({ artist, album, username, autocorrect, lang }) => safeToolCall(async () =>
    client.call("album.getInfo", { artist, album, username: username ?? usernameFromQuery, autocorrect, lang })));

  server.tool("chart_get_top_artists", "Get top artists from Last.fm public charts.", {
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("chart.getTopArtists", pagination);
  }));

  server.tool("tag_get_top_tracks", "Get top tracks by public tag.", {
    tag: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ tag, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("tag.getTopTracks", { tag, ...pagination });
  }));

  server.tool("geo_get_top_artists", "Get top artists for a country.", {
    country: z.string().min(1),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ country, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("geo.getTopArtists", { country, ...pagination });
  }));

  server.tool("user_get_info", "Get public profile info for a user.", {
    user: userSchema,
  }, READ_ONLY_TOOL_HINTS, async ({ user }) => safeToolCall(async () =>
    client.call("user.getInfo", { user: user ?? usernameFromQuery })));

  server.tool("user_get_recent_tracks", "Get a user's recent tracks.", {
    user: userSchema,
    from: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
    extended: z.number().int().min(0).max(1).default(0),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, from, to, extended, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getRecentTracks", { user: user ?? usernameFromQuery, from, to, extended, ...pagination });
  }));

  server.tool("user_get_top_albums", "Get a user's top albums.", {
    user: userSchema,
    period: z.enum(["overall", "7day", "1month", "3month", "6month", "12month"]).default("overall"),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, period, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getTopAlbums", { user: user ?? usernameFromQuery, period, ...pagination });
  }));

  server.tool("user_get_top_artists", "Get a user's top artists.", {
    user: userSchema,
    period: z.enum(["overall", "7day", "1month", "3month", "6month", "12month"]).default("overall"),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, period, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getTopArtists", { user: user ?? usernameFromQuery, period, ...pagination });
  }));

  server.tool("user_get_top_tracks", "Get a user's top tracks.", {
    user: userSchema,
    period: z.enum(["overall", "7day", "1month", "3month", "6month", "12month"]).default("overall"),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, period, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getTopTracks", { user: user ?? usernameFromQuery, period, ...pagination });
  }));

  server.tool("user_get_loved_tracks", "Get a user's loved tracks.", {
    user: userSchema,
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getLovedTracks", { user: user ?? usernameFromQuery, ...pagination });
  }));

  server.tool("user_get_friends", "Get a user's friends.", {
    user: userSchema,
    recenttracks: z.number().int().min(0).max(1).default(0),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(config.defaultPageSize),
  }, READ_ONLY_TOOL_HINTS, async ({ user, recenttracks, page, limit }) => safeToolCall(async () => {
    const pagination = resolvePagination({ page, limit }, config);
    return client.call("user.getFriends", { user: user ?? usernameFromQuery, recenttracks, ...pagination });
  }));

  server.tool("user_get_weekly_album_chart", "Get a user's weekly album chart.", {
    user: userSchema,
    from: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
  }, READ_ONLY_TOOL_HINTS, async ({ user, from, to }) => safeToolCall(async () =>
    client.call("user.getWeeklyAlbumChart", { user: user ?? usernameFromQuery, from, to })));

  server.tool("user_get_weekly_artist_chart", "Get a user's weekly artist chart.", {
    user: userSchema,
    from: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
  }, READ_ONLY_TOOL_HINTS, async ({ user, from, to }) => safeToolCall(async () =>
    client.call("user.getWeeklyArtistChart", { user: user ?? usernameFromQuery, from, to })));

  server.tool("user_get_weekly_track_chart", "Get a user's weekly track chart.", {
    user: userSchema,
    from: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
  }, READ_ONLY_TOOL_HINTS, async ({ user, from, to }) => safeToolCall(async () =>
    client.call("user.getWeeklyTrackChart", { user: user ?? usernameFromQuery, from, to })));

  server.tool("user_get_weekly_chart_list", "Get available weekly chart ranges for a user.", {
    user: userSchema,
  }, READ_ONLY_TOOL_HINTS, async ({ user }) => safeToolCall(async () =>
    client.call("user.getWeeklyChartList", { user: user ?? usernameFromQuery })));

  return server;
}

async function safeToolCall(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return toolResult(data);
  } catch (error: unknown) {
    if (error instanceof LastfmApiError) {
      captureLastfmFailure(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, details: error.details }, null, 2) }],
        structuredContent: { error: error.message, details: error.details },
      };
    }

    Sentry.captureException(asError(error));
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

export default Sentry.withSentry(
  (env: Env) => {
    const dsn = env.SENTRY_DSN?.trim();
    if (!dsn) {
      return undefined;
    }

    return {
      dsn,
      environment: env.SENTRY_ENVIRONMENT?.trim(),
      release: env.SENTRY_RELEASE?.trim(),
      tracesSampleRate: parseSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
      enableLogs: true,
      sendDefaultPii: parseBoolean(env.SENTRY_SEND_DEFAULT_PII),
      integrations: [
        Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
      ],
    };
  }, {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestUrl = (() => {
      try {
        return new URL(request.url);
      } catch {
        return new URL(request.url, "http://localhost");
      }
    })();
    const usernameFromQuery = requestUrl.searchParams.get("username") ?? undefined;
    Sentry.setTags({
      component: "lastfm-mcp-worker",
      mcp_transport: "streamable_http",
      request_path: requestUrl.pathname,
      has_username_query: String(Boolean(usernameFromQuery)),
    });
    Sentry.setContext("mcp_request", {
      method: request.method,
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      has_username_query: Boolean(usernameFromQuery),
    });

    return Sentry.startSpan({ name: "mcp.request", op: "mcp.server" }, async () => {
      const upstreamServer = createServer(env, usernameFromQuery);
      const executor = new QuickJsWasmExecutor();
      const server = await codeMcpServer({ server: upstreamServer, executor });
      const registeredCodeTool = (server as unknown as { _registeredTools?: Record<string, { annotations?: Record<string, boolean> }> })
        ._registeredTools?.code;
      if (registeredCodeTool) {
        registeredCodeTool.annotations = {
          ...registeredCodeTool.annotations,
          ...PUBLIC_READ_ONLY_TOOL_HINTS,
        };
      }
      return createMcpHandler(server as never)(request, env, ctx);
    });
  },
});

function captureLastfmFailure(error: LastfmApiError): void {
  if (!error.details.retriable && (error.details.status ?? 0) < 500) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(error.details.retriable ? "warning" : "error");
    scope.setFingerprint([
      "lastfm-api-error",
      error.details.method,
      String(error.details.status ?? "unknown"),
      String(error.details.lastfmErrorCode ?? "none"),
    ]);
    scope.setContext("lastfm_error", {
      method: error.details.method,
      status: error.details.status,
      lastfm_error_code: error.details.lastfmErrorCode,
      retriable: error.details.retriable,
    });
    Sentry.captureException(error);
  });
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unexpected non-Error thrown");
}

function parseSampleRate(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
