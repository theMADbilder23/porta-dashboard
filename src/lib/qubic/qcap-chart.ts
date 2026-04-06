export type QubicCandle = {
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
  openTime: number;
};

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CandleRouteResponse = {
  timeframe: string;
  interval: string;
  days: number;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

function toNumber(value: string | number): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function transformQubicCandles(data: QubicCandle[]): ChartCandle[] {
  return data
    .map((c) => {
      const time = Math.floor(Number(c.openTime) / 1000);
      const open = toNumber(c.open);
      const high = toNumber(c.high);
      const low = toNumber(c.low);
      const close = toNumber(c.close);
      const volume = toNumber(c.volume);

      if (
        !Number.isFinite(time) ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        volume === null
      ) {
        return null;
      }

      return {
        time,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((candle): candle is ChartCandle => candle !== null);
}

export async function fetchQubicCandles(
  timeframe: string = "1d"
): Promise<ChartCandle[]> {
  const res = await fetch(`/api/qubic/qcap-candles?timeframe=${timeframe}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch QCAP candles: ${res.status}`);
  }

  const parsed = (await res.json()) as CandleRouteResponse;

  if (!parsed || !Array.isArray(parsed.candles)) {
    return [];
  }

  return parsed.candles
    .map((c) => {
      const time = Number(c?.time);
      const open = toNumber(c?.open);
      const high = toNumber(c?.high);
      const low = toNumber(c?.low);
      const close = toNumber(c?.close);
      const volume = toNumber(c?.volume);

      if (
        !Number.isFinite(time) ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        volume === null
      ) {
        return null;
      }

      return {
        time,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((candle): candle is ChartCandle => candle !== null);
}