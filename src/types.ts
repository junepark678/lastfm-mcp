// Response format types
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Last.fm API types
export interface LastFmArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: LastFmImage[];
  listeners?: string;
  playcount?: string;
}

export interface LastFmTrack {
  name: string;
  artist: string | { name: string; mbid?: string; url?: string };
  album?: string | { title: string; mbid?: string };
  mbid?: string;
  url: string;
  duration?: string;
  playcount?: string;
  listeners?: string;
}

export interface LastFmAlbum {
  name: string;
  artist: string;
  mbid?: string;
  url: string;
  image?: LastFmImage[];
  playcount?: string;
  listeners?: string;
}

export interface LastFmImage {
  "#text": string;
  size: "small" | "medium" | "large" | "extralarge" | "mega";
}

export interface LastFmUser {
  name: string;
  realname?: string;
  url: string;
  country?: string;
  playcount: string;
  artist_count?: string;
  track_count?: string;
  album_count?: string;
  registered?: {
    unixtime: string;
    "#text": number;
  };
}

export interface LastFmTag {
  name: string;
  url: string;
  count?: number;
}

// Tool response types
export interface ToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  structuredContent?: any;
}