import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LastfmClient, LastfmApiError } from "../src/lastfm";
import { createUsernameSchema } from "../src/schemas";
import { resolvePagination } from "../src/models";
import { loadConfig } from "../src/config";

describe("LastfmClient allowlist", () => {
  const client = new LastfmClient({
    apiKey: "abc",
    apiBaseUrl: "https://ws.audioscrobbler.com/2.0/",
    userAgent: "test-agent",
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  it("allows public methods", () => {
    expect(client.isMethodAllowed("artist.search")).toBe(true);
    expect(client.isMethodAllowed("track.getInfo")).toBe(true);
    expect(client.isMethodAllowed("user.getRecentTracks")).toBe(true);
    expect(client.isMethodAllowed("user.getWeeklyChartList")).toBe(true);
  });

  it("rejects auth methods", async () => {
    await expect(client.call("track.scrobble", {})).rejects.toBeInstanceOf(LastfmApiError);
  });
});

describe("LastfmClient error mapping", () => {
  const client = new LastfmClient({
    apiKey: "abc",
    apiBaseUrl: "https://ws.audioscrobbler.com/2.0/",
    userAgent: "test-agent",
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps API-level Last.fm errors", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 6, message: "Artist not found" }), { status: 200 }));

    await expect(client.call("artist.getInfo", { artist: "missing" })).rejects.toMatchObject({
      details: { method: "artist.getInfo", lastfmErrorCode: 6 },
    });
  });

  it("includes username in request URI when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await client.call("artist.getInfo", { artist: "Cher", username: "alice" });

    const requestUrl = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(typeof requestUrl).toBe("string");
    expect(new URL(requestUrl as string).searchParams.get("username")).toBe("alice");
  });

  it("omits username from request URI when omitted", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await client.call("artist.getInfo", { artist: "Cher", username: undefined });

    const requestUrl = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(typeof requestUrl).toBe("string");
    expect(new URL(requestUrl as string).searchParams.has("username")).toBe(false);
  });
});

describe("configuration and pagination", () => {
  it("loads config and clamps default page size to max", () => {
    const config = loadConfig({ LASTFM_API_KEY: "k", DEFAULT_PAGE_SIZE: "300", MAX_PAGE_SIZE: "50" });
    expect(config.defaultPageSize).toBe(50);
    expect(config.maxPageSize).toBe(50);
  });

  it("resolves pagination with upper bounds", () => {
    const result = resolvePagination({ page: 2, limit: 999 }, { defaultPageSize: 10, maxPageSize: 100 });
    expect(result).toEqual({ page: 2, limit: 100 });
  });
});

describe("username MCP schema behavior", () => {
  it("requires username when request query string has no username", () => {
    const schema = createUsernameSchema(undefined);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it("makes username optional when request query string has username", () => {
    const schema = createUsernameSchema("alice");
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});
