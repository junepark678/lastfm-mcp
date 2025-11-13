import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/";

interface LastFmParams {
  [key: string]: string | undefined;
}

interface Env {
  LASTFM_API_KEY: string;
}

// Last.fm API helper
async function callLastFmApi(
  apiKey: string,
  method: string,
  params: LastFmParams = {}
): Promise<any> {
  const urlParams = new URLSearchParams({
    method,
    api_key: apiKey,
    format: "json",
    ...Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)),
  });

  const response = await fetch(`${LASTFM_API_BASE}?${urlParams}`);
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "lastfm_chart_top_artists",
    description: "Get the top artists chart from Last.fm",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50, max: 500)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
    },
  },
  {
    name: "lastfm_chart_top_tracks",
    description: "Get the top tracks chart from Last.fm",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50, max: 500)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
    },
  },
  {
    name: "lastfm_chart_top_tags",
    description: "Get the top tags chart from Last.fm",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50, max: 500)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
    },
  },
  {
    name: "lastfm_geo_top_artists",
    description: "Get the top artists for a country",
    inputSchema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "Country name (e.g., 'United States', 'United Kingdom')",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["country"],
    },
  },
  {
    name: "lastfm_geo_top_tracks",
    description: "Get the top tracks for a country",
    inputSchema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "Country name (e.g., 'United States', 'United Kingdom')",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["country"],
    },
  },
  {
    name: "lastfm_tag_top_artists",
    description: "Get the top artists for a tag",
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Tag name (e.g., 'rock', 'electronic', 'jazz')",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["tag"],
    },
  },
  {
    name: "lastfm_tag_top_tracks",
    description: "Get the top tracks for a tag",
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Tag name (e.g., 'rock', 'electronic', 'jazz')",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["tag"],
    },
  },
  {
    name: "lastfm_tag_top_albums",
    description: "Get the top albums for a tag",
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Tag name (e.g., 'rock', 'electronic', 'jazz')",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["tag"],
    },
  },
  {
    name: "lastfm_artist_info",
    description: "Get information about an artist",
    inputSchema: {
      type: "object",
      properties: {
        artist: {
          type: "string",
          description: "Artist name",
        },
        mbid: {
          type: "string",
          description: "MusicBrainz ID (optional, use instead of artist name)",
        },
        lang: {
          type: "string",
          description: "Language for the biography (default: en)",
        },
        autocorrect: {
          type: "string",
          description: "Transform misspelled artist names into correct ones (0 or 1)",
        },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_artist_top_tracks",
    description: "Get the top tracks by an artist",
    inputSchema: {
      type: "object",
      properties: {
        artist: {
          type: "string",
          description: "Artist name",
        },
        mbid: {
          type: "string",
          description: "MusicBrainz ID (optional, use instead of artist name)",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
        autocorrect: {
          type: "string",
          description: "Transform misspelled artist names into correct ones (0 or 1)",
        },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_artist_top_albums",
    description: "Get the top albums by an artist",
    inputSchema: {
      type: "object",
      properties: {
        artist: {
          type: "string",
          description: "Artist name",
        },
        mbid: {
          type: "string",
          description: "MusicBrainz ID (optional, use instead of artist name)",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
        autocorrect: {
          type: "string",
          description: "Transform misspelled artist names into correct ones (0 or 1)",
        },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_album_info",
    description: "Get information about an album",
    inputSchema: {
      type: "object",
      properties: {
        artist: {
          type: "string",
          description: "Artist name",
        },
        album: {
          type: "string",
          description: "Album name",
        },
        mbid: {
          type: "string",
          description: "MusicBrainz ID (optional, use instead of artist/album)",
        },
        lang: {
          type: "string",
          description: "Language for the wiki (default: en)",
        },
        autocorrect: {
          type: "string",
          description: "Transform misspelled names into correct ones (0 or 1)",
        },
      },
      required: ["artist", "album"],
    },
  },
  {
    name: "lastfm_track_info",
    description: "Get information about a track",
    inputSchema: {
      type: "object",
      properties: {
        artist: {
          type: "string",
          description: "Artist name",
        },
        track: {
          type: "string",
          description: "Track name",
        },
        mbid: {
          type: "string",
          description: "MusicBrainz ID (optional, use instead of artist/track)",
        },
        autocorrect: {
          type: "string",
          description: "Transform misspelled names into correct ones (0 or 1)",
        },
      },
      required: ["artist", "track"],
    },
  },
  {
    name: "lastfm_user_recent_tracks",
    description: "Get a list of the recent tracks listened to by a user",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "string",
          description: "Last.fm username",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50, max: 200)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
        from: {
          type: "string",
          description: "Unix timestamp to start from",
        },
        to: {
          type: "string",
          description: "Unix timestamp to end at",
        },
        extended: {
          type: "string",
          description: "Include extended data (0 or 1)",
        },
      },
      required: ["user"],
    },
  },
  {
    name: "lastfm_user_top_artists",
    description: "Get the top artists listened to by a user",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "string",
          description: "Last.fm username",
        },
        period: {
          type: "string",
          description: "Time period: overall, 7day, 1month, 3month, 6month, 12month (default: overall)",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["user"],
    },
  },
  {
    name: "lastfm_user_top_tracks",
    description: "Get the top tracks listened to by a user",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "string",
          description: "Last.fm username",
        },
        period: {
          type: "string",
          description: "Time period: overall, 7day, 1month, 3month, 6month, 12month (default: overall)",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["user"],
    },
  },
  {
    name: "lastfm_user_top_albums",
    description: "Get the top albums listened to by a user",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "string",
          description: "Last.fm username",
        },
        period: {
          type: "string",
          description: "Time period: overall, 7day, 1month, 3month, 6month, 12month (default: overall)",
        },
        limit: {
          type: "string",
          description: "Number of results to fetch (default: 50)",
        },
        page: {
          type: "string",
          description: "Page number to fetch (default: 1)",
        },
      },
      required: ["user"],
    },
  },
  {
    name: "lastfm_user_info",
    description: "Get information about a Last.fm user profile",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "string",
          description: "Last.fm username",
        },
      },
      required: ["user"],
    },
  },
];

// Handle tool execution
async function handleToolCall(name: string, args: any, apiKey: string): Promise<any> {
  switch (name) {
    case "lastfm_chart_top_artists":
      return await callLastFmApi(apiKey, "chart.gettopartists", args as LastFmParams);
    case "lastfm_chart_top_tracks":
      return await callLastFmApi(apiKey, "chart.gettoptracks", args as LastFmParams);
    case "lastfm_chart_top_tags":
      return await callLastFmApi(apiKey, "chart.gettoptags", args as LastFmParams);
    case "lastfm_geo_top_artists":
      return await callLastFmApi(apiKey, "geo.gettopartists", args as LastFmParams);
    case "lastfm_geo_top_tracks":
      return await callLastFmApi(apiKey, "geo.gettoptracks", args as LastFmParams);
    case "lastfm_tag_top_artists":
      return await callLastFmApi(apiKey, "tag.gettopartists", args as LastFmParams);
    case "lastfm_tag_top_tracks":
      return await callLastFmApi(apiKey, "tag.gettoptracks", args as LastFmParams);
    case "lastfm_tag_top_albums":
      return await callLastFmApi(apiKey, "tag.gettopalbums", args as LastFmParams);
    case "lastfm_artist_info":
      return await callLastFmApi(apiKey, "artist.getinfo", args as LastFmParams);
    case "lastfm_artist_top_tracks":
      return await callLastFmApi(apiKey, "artist.gettoptracks", args as LastFmParams);
    case "lastfm_artist_top_albums":
      return await callLastFmApi(apiKey, "artist.gettopalbums", args as LastFmParams);
    case "lastfm_album_info":
      return await callLastFmApi(apiKey, "album.getinfo", args as LastFmParams);
    case "lastfm_track_info":
      return await callLastFmApi(apiKey, "track.getinfo", args as LastFmParams);
    case "lastfm_user_recent_tracks":
      return await callLastFmApi(apiKey, "user.getrecenttracks", args as LastFmParams);
    case "lastfm_user_top_artists":
      return await callLastFmApi(apiKey, "user.gettopartists", args as LastFmParams);
    case "lastfm_user_top_tracks":
      return await callLastFmApi(apiKey, "user.gettoptracks", args as LastFmParams);
    case "lastfm_user_top_albums":
      return await callLastFmApi(apiKey, "user.gettopalbums", args as LastFmParams);
    case "lastfm_user_info":
      return await callLastFmApi(apiKey, "user.getinfo", args as LastFmParams);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // List tools endpoint
      if (url.pathname === "/tools" && request.method === "GET") {
        return new Response(JSON.stringify({ tools: TOOLS }, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      // Call tool endpoint
      if (url.pathname === "/call" && request.method === "POST") {
        if (!env.LASTFM_API_KEY) {
          return new Response(
            JSON.stringify({ error: "LASTFM_API_KEY not configured" }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }

        const { name, arguments: args } = await request.json() as {
          name: string;
          arguments: any;
        };

        const result = await handleToolCall(name, args, env.LASTFM_API_KEY);

        return new Response(JSON.stringify(result, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      // Server info endpoint
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(
          JSON.stringify(
            {
              name: "lastfm-mcp-server",
              version: "1.0.0",
              description: "Last.fm MCP Server - provides access to Last.fm API",
              endpoints: {
                "/": "Server information",
                "/tools": "List available tools",
                "/call": "Call a tool (POST with {name, arguments})",
              },
            },
            null,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  },
};
