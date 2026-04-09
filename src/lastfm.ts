import type { LastfmConfig } from "./config";
import * as Sentry from "@sentry/cloudflare";

export class LastfmApiError extends Error {
  constructor(
    message: string,
    readonly details: {
      method: string;
      status?: number;
      lastfmErrorCode?: number;
      retriable: boolean;
    },
  ) {
    super(message);
    this.name = "LastfmApiError";
  }
}

const PUBLIC_METHOD_ALLOWLIST = new Set([
  "artist.search",
  "artist.getInfo",
  "album.getInfo",
  "track.search",
  "track.getInfo",
  "tag.getTopTracks",
  "chart.getTopArtists",
  "geo.getTopArtists",
  "user.getInfo",
  "user.getRecentTracks",
  "user.getTopAlbums",
  "user.getTopArtists",
  "user.getTopTracks",
  "user.getLovedTracks",
  "user.getFriends",
  "user.getWeeklyAlbumChart",
  "user.getWeeklyArtistChart",
  "user.getWeeklyTrackChart",
  "user.getWeeklyChartList",
]);

export class LastfmClient {
  constructor(private readonly config: LastfmConfig) {}

  isMethodAllowed(method: string): boolean {
    return PUBLIC_METHOD_ALLOWLIST.has(method);
  }

  async call(method: string, params: Record<string, string | number | undefined>) {
    if (!this.isMethodAllowed(method)) {
      throw new LastfmApiError(`Method not allowed for public-only server: ${method}`, {
        method,
        retriable: false,
      });
    }

    const url = new URL(this.config.apiBaseUrl);

    url.searchParams.set("method", method);
    url.searchParams.set("api_key", this.config.apiKey);
    url.searchParams.set("format", "json");

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    return Sentry.startSpan(
      {
        name: `lastfm.${method}`,
        op: "http.client",
        attributes: {
          "lastfm.method": method,
          "http.request.method": "GET",
          "server.address": url.hostname,
          "url.full": redactLastfmUrl(url),
        },
      },
      async (span) => {
        const response = await fetch(url.toString(), {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        });

        span?.setAttribute("http.response.status_code", response.status);

        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw new LastfmApiError("Last.fm returned non-JSON response", {
            method,
            status: response.status,
            retriable: response.status >= 500,
          });
        }

        if (!response.ok) {
          throw new LastfmApiError(`HTTP error from Last.fm: ${response.status}`, {
            method,
            status: response.status,
            retriable: response.status >= 500 || response.status === 429,
          });
        }

        if (isLastfmError(data)) {
          throw new LastfmApiError(data.message, {
            method,
            status: response.status,
            lastfmErrorCode: data.error,
            retriable: response.status >= 500 || data.error === 11 || data.error === 16,
          });
        }

        return data;
      },
    );
  }
}

function isLastfmError(value: unknown): value is { error: number; message: string } {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Record<string, unknown>;
  return typeof maybe.error === "number" && typeof maybe.message === "string";
}

function redactLastfmUrl(url: URL): string {
  const sanitized = new URL(url.toString());
  sanitized.searchParams.delete("api_key");
  return sanitized.toString();
}
