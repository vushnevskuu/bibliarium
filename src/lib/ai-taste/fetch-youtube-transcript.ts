/**
 * Fetches YouTube video transcript via YouTube's internal caption API.
 * No API key required — uses the same mechanism as youtube.com itself.
 */

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: YT_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();

  // Extract ytInitialPlayerResponse JSON from inline script
  const match = /ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});(?:var|const|let|\s*<\/script>)/.exec(html);
  if (!match?.[1]) return [];

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return [];
  }

  const captions = (data as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: CaptionTrack[];
      };
    };
  }).captions?.playerCaptionsTracklistRenderer?.captionTracks;

  return Array.isArray(captions) ? captions : [];
}

function chooseBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  // Prefer: manual en → auto en → any manual → any auto → first
  return (
    tracks.find((t) => t.languageCode.startsWith("en") && !t.kind) ||
    tracks.find((t) => t.languageCode.startsWith("en") && t.kind === "asr") ||
    tracks.find((t) => !t.kind) ||
    tracks.find((t) => t.kind === "asr") ||
    tracks[0] ||
    null
  );
}

async function fetchTranscriptText(track: CaptionTrack): Promise<string> {
  const url = `${track.baseUrl}&fmt=json3`;
  const res = await fetch(url, {
    headers: YT_HEADERS,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return "";

  const data = (await res.json()) as {
    events?: { segs?: { utf8?: string }[] }[];
  };

  const lines: string[] = [];
  for (const event of data.events ?? []) {
    const text = (event.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (text && text !== "\n") lines.push(text);
  }

  return lines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Returns the full transcript text for a YouTube video, or null if unavailable.
 * Caps at maxChars to control DB size and token usage.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  maxChars = 12_000
): Promise<string | null> {
  try {
    const tracks = await getCaptionTracks(videoId);
    const track = chooseBestTrack(tracks);
    if (!track) return null;

    const text = await fetchTranscriptText(track);
    if (!text) return null;

    return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
  } catch {
    return null;
  }
}
