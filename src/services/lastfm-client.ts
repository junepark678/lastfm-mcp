// Last.fm API Client
const LASTFM_API_BASE_URL = "https://ws.audioscrobbler.com/2.0/";

export class LastFmError extends Error {
  constructor(
    message: string,
    public code?: number,
    public statusCode?: number
  ) {
    super(message);
    this.name = "LastFmError";
  }
}

/**
 * Make a request to the Last.fm API
 */
export async function makeLastFmRequest(
  params: Record<string, string>
): Promise<any> {
  const apiKey = (globalThis as any).LASTFM_API_KEY;
  
  if (!apiKey) {
    throw new LastFmError("Last.fm API key not configured", undefined, 500);
  }

  const url = new URL(LASTFM_API_BASE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  // Add all provided parameters
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "lastfm-mcp-server/1.0.0",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new LastFmError(
          "Rate limit exceeded. Please try again later.",
          29,
          429
        );
      }
      throw new LastFmError(
        `HTTP error ${response.status}: ${response.statusText}`,
        undefined,
        response.status
      );
    }

    const data: any = await response.json();

    // Check for API-level errors
    if (data && typeof data === "object" && "error" in data) {
      const errorMessages: Record<number, string> = {
        2: "Invalid service - This service does not exist",
        3: "Invalid Method - No method with that name",
        4: "Authentication Failed - Invalid authentication token",
        5: "Invalid format - This service doesn't exist in that format",
        6: "Invalid parameters - Required parameter is missing",
        7: "Invalid resource specified",
        8: "Operation failed - Something went wrong",
        9: "Invalid session key - Please re-authenticate",
        10: "Invalid API key - You must use a valid API key",
        11: "Service Offline - This service is temporarily offline",
        13: "Invalid method signature supplied",
        16: "Temporarily unavailable - Service is temporarily unavailable",
        26: "Suspended API key - Access for your account has been suspended",
        29: "Rate limit exceeded - Your IP has made too many requests",
      };

      const errorMessage =
        errorMessages[(data as any).error] || (data as any).message || "Unknown error";
      throw new LastFmError(errorMessage, (data as any).error);
    }

    return data;
  } catch (error) {
    if (error instanceof LastFmError) {
      throw error;
    }
    throw new LastFmError(
      `Failed to fetch from Last.fm API: ${(error as Error).message}`
    );
  }
}

/**
 * Format data as a markdown list
 */
export function formatMarkdownList<T>(
  items: T[],
  formatter: (item: T) => string
): string {
  return items.map((item, index) => `${index + 1}. ${formatter(item)}`).join("\n\n");
}

/**
 * Format response as JSON with consistent structure
 */
export function formatJsonResponse(data: any): any {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Parse Last.fm date to ISO string
 */
export function parseLastFmDate(unixTimestamp: string | number): string {
  const timestamp = typeof unixTimestamp === "string" 
    ? parseInt(unixTimestamp) 
    : unixTimestamp;
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format duration in milliseconds to MM:SS
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
