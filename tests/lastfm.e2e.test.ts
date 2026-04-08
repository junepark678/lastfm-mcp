import { describe, expect, it } from "vitest";
import { LastfmClient } from "../src/lastfm";

const apiKey = process.env.LASTFM_API_KEY;
const describeWhenApiKey = apiKey ? describe : describe.skip;

describeWhenApiKey("Last.fm live end-to-end", () => {
  const client = new LastfmClient({
    apiKey: apiKey as string,
    apiBaseUrl: "https://ws.audioscrobbler.com/2.0/",
    userAgent: "lastfm-mcp-worker/e2e-test",
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  it("fetches a public user profile from Last.fm", async () => {
    const result = await client.call("user.getInfo", { user: "RJ" }) as {
      user?: { name?: string; playcount?: string };
    };

    expect(result.user?.name).toBeTruthy();
    expect(result.user?.playcount).toBeTruthy();
  }, 30_000);

  it("fetches chart top artists with pagination", async () => {
    const result = await client.call("chart.getTopArtists", { page: 1, limit: 1 }) as {
      artists?: { artist?: Array<{ name?: string }> };
    };

    expect(Array.isArray(result.artists?.artist)).toBe(true);
    expect(result.artists?.artist?.length).toBeGreaterThan(0);
    expect(result.artists?.artist?.[0]?.name).toBeTruthy();
  }, 30_000);
});
