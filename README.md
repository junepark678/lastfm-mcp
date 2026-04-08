# lastfm-mcp (Cloudflare Agents SDK + Codemode)

A public-only Last.fm MCP server designed for the Cloudflare Agents SDK.

This deployment wraps the Last.fm MCP toolset in Cloudflare Codemode and exposes only a single `code` tool to MCP clients, executed via a custom QuickJS-ng WASM executor.

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

This server exposes only one external MCP tool:
- `code`
  - Annotated as public read-only and non-destructive (`readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: true`)

Internally, the `code` tool can call the Last.fm public tools listed below as typed `codemode.*` methods:
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

Applies to: `artist_get_info`, `track_get_info`, `album_get_info` (used internally by `code`).

- If the incoming MCP HTTP request URI contains `?username=<value>`, the tool `username` field is **optional**.
- If the request URI does **not** contain a `username` query parameter, the tool `username` field is **required**.
- If both are provided, the tool input `username` value takes precedence over the query-string value.

All internal Last.fm tools are annotated as read-only and non-destructive (`readOnlyHint: true`, `destructiveHint: false`).

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
2. Copy QuickJS Cloudflare Worker wasm assets:
   ```bash
   npm run copy:quickjs-wasm
   ```
   (This also runs automatically on `npm install` via `postinstall`.)
3. Copy env vars:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
4. Set `LASTFM_API_KEY` in `.dev.vars`.
5. Run worker:
   ```bash
   npm run dev
   ```

When `quickjs-emscripten` is updated, run `npm run copy:quickjs-wasm` again to refresh `src/RELEASE_SYNC.wasm` and `src/RELEASE_SYNC.emscripten.browser.mjs`.

## Deploy

```bash
npm run deploy
```

## Testing

```bash
npm test
```
