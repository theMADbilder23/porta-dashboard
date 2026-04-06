const BASE_URL = "https://qubicswap.com/api/v1/markets/QCAP/candles";

type CandleRequestConfig = {
  interval: string;
  days: number;
  limit: number;
};

type RawCandle = {
  openTime?: number | string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  volume?: number | string;
};

const TIMEFRAME_MAP: Record<string, CandleRequestConfig> = {
  "30m": { interval: "30m", days: 14, limit: 700 },
  "1h": { interval: "1h", days: 30, limit: 720 },
  "2h": { interval: "2h", days: 60, limit: 720 },
  "4h": { interval: "4h", days: 120, limit: 720 },
  "8h": { interval: "8h", days: 240, limit: 720 },
  "1d": { interval: "1d", days: 365, limit: 500 },
};

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCandle(candle: RawCandle) {
  const openTime = Number(candle?.openTime);
  const open = toNumber(candle?.open);
  const high = toNumber(candle?.high);
  const low = toNumber(candle?.low);
  const close = toNumber(candle?.close);
  const volume = toNumber(candle?.volume);

  if (
    !Number.isFinite(openTime) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    return null;
  }

  return {
    time: Math.floor(openTime / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}

function extractCandles(payload: any): RawCandle[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchUpstream(url: string, signal: AbortSignal) {
  const attempts: Array<() => Promise<Response>> = [
    () =>
      fetch(url, {
        method: "GET",
        cache: "no-store",
        signal,
      }),
    () =>
      fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 PortaDashboard/1.0",
        },
        cache: "no-store",
        signal,
      }),
    () =>
      fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 PortaDashboard/1.0",
          Referer: "https://qubicswap.com/",
          Origin: "https://qubicswap.com",
        },
        cache: "no-store",
        signal,
      }),
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All upstream fetch attempts failed");
}

export async function GET(request: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get("timeframe") || "1d").toLowerCase();
    const config = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["1d"];

    const upstreamUrl =
      `${BASE_URL}?interval=${encodeURIComponent(config.interval)}` +
      `&days=${config.days}&limit=${config.limit}`;

    const response = await fetchUpstream(upstreamUrl, controller.signal);
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (!response.ok) {
      return Response.json(
        {
          error: "Upstream fetch failed",
          status: response.status,
          contentType,
          preview: rawText.slice(0, 500),
          timeframe,
          upstreamUrl,
        },
        { status: 502 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return Response.json(
        {
          error: "Upstream returned non-JSON response",
          contentType,
          preview: rawText.slice(0, 500),
          timeframe,
          upstreamUrl,
        },
        { status: 502 }
      );
    }

    const rawCandles = extractCandles(parsed);
    const candles = rawCandles.map(normalizeCandle).filter(Boolean);

    if (!candles.length) {
      return Response.json(
        {
          error: "No valid candles returned after normalization",
          rawCount: Array.isArray(rawCandles) ? rawCandles.length : 0,
          sample: Array.isArray(rawCandles) ? rawCandles.slice(0, 3) : [],
          timeframe,
          upstreamUrl,
        },
        { status: 502 }
      );
    }

    return Response.json({
      timeframe,
      interval: config.interval,
      days: config.days,
      candles,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return Response.json(
      {
        error: "Internal route failure",
        message,
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}