export interface LastfmConfig {
  apiKey: string;
  apiBaseUrl: string;
  userAgent: string;
  defaultPageSize: number;
  maxPageSize: number;
}

export interface EnvLike {
  LASTFM_API_KEY?: string;
  LASTFM_API_BASE_URL?: string;
  LASTFM_USER_AGENT?: string;
  DEFAULT_PAGE_SIZE?: string;
  MAX_PAGE_SIZE?: string;
}

const DEFAULT_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const DEFAULT_USER_AGENT = "lastfm-mcp-worker/0.1.0";
const FALLBACK_DEFAULT_PAGE_SIZE = 10;
const FALLBACK_MAX_PAGE_SIZE = 100;

export function loadConfig(env: EnvLike): LastfmConfig {
  const apiKey = env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY is required");
  }

  const defaultPageSize = coercePositiveInt(env.DEFAULT_PAGE_SIZE, FALLBACK_DEFAULT_PAGE_SIZE);
  const maxPageSize = coercePositiveInt(env.MAX_PAGE_SIZE, FALLBACK_MAX_PAGE_SIZE);

  const apiBaseUrl = env.LASTFM_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  validateUrl(apiBaseUrl, "LASTFM_API_BASE_URL");

  return {
    apiKey,
    apiBaseUrl,
    userAgent: env.LASTFM_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
    defaultPageSize: Math.min(defaultPageSize, maxPageSize),
    maxPageSize,
  };
}

function validateUrl(value: string, envKey: string): void {
  try {
    const parsed = new URL(value);
    if (!parsed.protocol || !parsed.hostname) {
      throw new Error("missing URL components");
    }
  } catch {
    throw new Error(`${envKey} must be a valid absolute URL`);
  }
}

function coercePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
