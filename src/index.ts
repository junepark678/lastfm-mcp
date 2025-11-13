import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/";

interface LastFmParams {
  [key: string]: string | undefined;
}

// Last.fm API helper
async function callLastFmApi(method: string, params: LastFmParams = {}): Promise<any> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY environment variable is required");
  }

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

// Create MCP server
const server = new Server(
  {
    name: "lastfm-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "lastfm_chart_top_artists":
        result = await callLastFmApi("chart.gettopartists", args as LastFmParams);
        break;
      case "lastfm_chart_top_tracks":
        result = await callLastFmApi("chart.gettoptracks", args as LastFmParams);
        break;
      case "lastfm_chart_top_tags":
        result = await callLastFmApi("chart.gettoptags", args as LastFmParams);
        break;
      case "lastfm_geo_top_artists":
        result = await callLastFmApi("geo.gettopartists", args as LastFmParams);
        break;
      case "lastfm_geo_top_tracks":
        result = await callLastFmApi("geo.gettoptracks", args as LastFmParams);
        break;
      case "lastfm_tag_top_artists":
        result = await callLastFmApi("tag.gettopartists", args as LastFmParams);
        break;
      case "lastfm_tag_top_tracks":
        result = await callLastFmApi("tag.gettoptracks", args as LastFmParams);
        break;
      case "lastfm_tag_top_albums":
        result = await callLastFmApi("tag.gettopalbums", args as LastFmParams);
        break;
      case "lastfm_artist_info":
        result = await callLastFmApi("artist.getinfo", args as LastFmParams);
        break;
      case "lastfm_artist_top_tracks":
        result = await callLastFmApi("artist.gettoptracks", args as LastFmParams);
        break;
      case "lastfm_artist_top_albums":
        result = await callLastFmApi("artist.gettopalbums", args as LastFmParams);
        break;
      case "lastfm_album_info":
        result = await callLastFmApi("album.getinfo", args as LastFmParams);
        break;
      case "lastfm_track_info":
        result = await callLastFmApi("track.getinfo", args as LastFmParams);
        break;
      case "lastfm_user_recent_tracks":
        result = await callLastFmApi("user.getrecenttracks", args as LastFmParams);
        break;
      case "lastfm_user_top_artists":
        result = await callLastFmApi("user.gettopartists", args as LastFmParams);
        break;
      case "lastfm_user_top_tracks":
        result = await callLastFmApi("user.gettoptracks", args as LastFmParams);
        break;
      case "lastfm_user_top_albums":
        result = await callLastFmApi("user.gettopalbums", args as LastFmParams);
        break;
      case "lastfm_user_info":
        result = await callLastFmApi("user.getinfo", args as LastFmParams);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Last.fm MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
