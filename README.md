# lastfm-mcp (Cloudflare Workers)

A public-only Last.fm MCP server designed to run on Cloudflare Workers over Streamable HTTP.

## Public-only scope

This server exposes only Last.fm methods that do **not** require user auth/session signatures.

Allowed Last.fm methods:
- `artist.search`
- `artist.getInfo`
- `album.getInfo`
- `track.search`
- `track.getInfo`
- `tag.getTopTracks`
- `chart.getTopArtists`
- `geo.getTopArtists`

Any method outside this allowlist is rejected.

## MCP tools

- `artist_search`
- `artist_get_info`
- `track_search`
- `track_get_info`
- `album_get_info`
- `chart_get_top_artists`
- `tag_get_top_tracks`
- `geo_get_top_artists`

List/search/chart tools support bounded pagination:
- `page >= 1`
- `limit >= 1`
- effective `limit` is clamped to `MAX_PAGE_SIZE` (default `100`)

## Environment variables

Required:
- `LASTFM_API_KEY`

Optional:
- `LASTFM_API_BASE_URL` (default `https://ws.audioscrobbler.com/2.0/`)
- `LASTFM_USER_AGENT` (default `lastfm-mcp-worker/0.1.0`)
- `DEFAULT_PAGE_SIZE` (default `10`)
- `MAX_PAGE_SIZE` (default `100`)

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env vars:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
3. Set `LASTFM_API_KEY` in `.dev.vars`.
4. Run worker:
   ```bash
   npm run dev
   ```

## Deploy

```bash
npm run deploy
```

## Testing

```bash
npm test
```
