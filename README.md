# Last.fm MCP Server

A Model Context Protocol (MCP) server that provides access to Last.fm's public API endpoints. This server can run locally via stdio or be deployed to Cloudflare Workers for HTTP access.

## Features

- 18 Last.fm API tools covering charts, artists, albums, tracks, tags, and user data
- No authentication required (uses public API endpoints)
- Two deployment modes:
  - **Local**: Standard MCP server via stdio
  - **Cloudflare Workers**: HTTP-accessible API

## Available Tools

### Chart Tools
- `lastfm_chart_top_artists` - Get top artists chart
- `lastfm_chart_top_tracks` - Get top tracks chart
- `lastfm_chart_top_tags` - Get top tags chart

### Geographic Tools
- `lastfm_geo_top_artists` - Get top artists by country
- `lastfm_geo_top_tracks` - Get top tracks by country

### Tag Tools
- `lastfm_tag_top_artists` - Get top artists for a tag
- `lastfm_tag_top_tracks` - Get top tracks for a tag
- `lastfm_tag_top_albums` - Get top albums for a tag

### Artist Tools
- `lastfm_artist_info` - Get artist information
- `lastfm_artist_top_tracks` - Get artist's top tracks
- `lastfm_artist_top_albums` - Get artist's top albums

### Album & Track Tools
- `lastfm_album_info` - Get album information
- `lastfm_track_info` - Get track information

### User Tools
- `lastfm_user_recent_tracks` - Get user's recent tracks
- `lastfm_user_top_artists` - Get user's top artists
- `lastfm_user_top_tracks` - Get user's top tracks
- `lastfm_user_top_albums` - Get user's top albums
- `lastfm_user_info` - Get user profile information

## Prerequisites

- Node.js 18+
- A Last.fm API key (get one at [https://www.last.fm/api/account/create](https://www.last.fm/api/account/create))
- For Cloudflare Workers deployment: Cloudflare account and Wrangler CLI

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lastfm-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Last.fm API key:
```bash
cp .env.example .env
# Edit .env and add your API key
```

4. Build the project:
```bash
npm run build
```

## Usage

### Local MCP Server (Stdio)

The stdio server is designed to be used with MCP-compatible clients like Claude Desktop.

1. Add to your MCP client configuration (e.g., `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "lastfm": {
      "command": "node",
      "args": ["/path/to/lastfm-mcp/dist/index.js"],
      "env": {
        "LASTFM_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

2. Restart your MCP client to load the server.

### Cloudflare Workers Deployment

#### Initial Setup

1. Install Wrangler CLI (if not already installed):
```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:
```bash
wrangler login
```

3. Set your Last.fm API key as a secret:
```bash
wrangler secret put LASTFM_API_KEY
# Enter your API key when prompted
```

#### Deploy

```bash
npm run deploy
```

This will deploy your worker to Cloudflare. You'll receive a URL like `https://lastfm-mcp-server.your-subdomain.workers.dev`

#### Local Development

Test the worker locally before deploying:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

### HTTP API Endpoints

When deployed to Cloudflare Workers, the following HTTP endpoints are available:

#### GET `/`
Returns server information

#### GET `/tools`
Lists all available tools with their schemas

#### POST `/call`
Calls a specific tool

Request body:
```json
{
  "name": "lastfm_artist_info",
  "arguments": {
    "artist": "Radiohead"
  }
}
```

### Example Usage

#### Get Artist Information
```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "lastfm_artist_info",
    "arguments": {
      "artist": "Radiohead"
    }
  }'
```

#### Get Top Tracks by Tag
```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "lastfm_tag_top_tracks",
    "arguments": {
      "tag": "rock",
      "limit": "10"
    }
  }'
```

#### Get User's Recent Tracks
```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "lastfm_user_recent_tracks",
    "arguments": {
      "user": "username",
      "limit": "5"
    }
  }'
```

## Development

### Project Structure

```
lastfm-mcp/
├── src/
│   ├── index.ts      # Stdio MCP server
│   └── worker.ts     # Cloudflare Workers handler
├── scripts/
│   └── bundle.js     # Build script
├── dist/             # Compiled output
├── package.json
├── tsconfig.json
└── wrangler.toml     # Cloudflare Workers config
```

### Type Checking

```bash
npm run type-check
```

### Build

```bash
npm run build
```

## Configuration

### Wrangler Configuration

Edit `wrangler.toml` to customize your Cloudflare Workers deployment:

```toml
name = "lastfm-mcp-server"
main = "dist/worker.js"
compatibility_date = "2024-11-01"

# Optional: Add custom routes
# routes = [
#   { pattern = "lastfm-mcp.example.com", zone_name = "example.com" }
# ]
```

### Environment Variables

- `LASTFM_API_KEY` (required): Your Last.fm API key

## API Rate Limits

Last.fm API has rate limits:
- Free tier: 5 requests per second per API key
- Authenticated endpoints are not included in this server

## License

AGPL-3.0 - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Resources

- [Last.fm API Documentation](https://www.last.fm/api)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
