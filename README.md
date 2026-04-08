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
- `user.getInfo`
- `user.getRecentTracks`
- `user.getTopAlbums`
- `user.getTopArtists`
- `user.getTopTracks`
- `user.getLovedTracks`
- `user.getFriends`
- `user.getWeeklyAlbumChart`
- `user.getWeeklyArtistChart`
- `user.getWeeklyTrackChart`
- `user.getWeeklyChartList`

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
- `user_get_info`
- `user_get_recent_tracks`
- `user_get_top_albums`
- `user_get_top_artists`
- `user_get_top_tracks`
- `user_get_loved_tracks`
- `user_get_friends`
- `user_get_weekly_album_chart`
- `user_get_weekly_artist_chart`
- `user_get_weekly_track_chart`
- `user_get_weekly_chart_list`

List/search/chart tools support bounded pagination:
- `page >= 1`
- `limit >= 1`
- effective `limit` is clamped to `MAX_PAGE_SIZE` (default `100`)

### Username behavior for info tools

Applies to: `artist_get_info`, `track_get_info`, `album_get_info`.

- If the incoming MCP HTTP request URI contains `?username=<value>`, the tool `username` field is **optional**.
- If the request URI does **not** contain a `username` query parameter, the tool `username` field is **required**.
- If both are provided, the tool input `username` value takes precedence over the query-string value.

All exposed tools are annotated as read-only and non-destructive (`readOnlyHint: true`, `destructiveHint: false`).

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
