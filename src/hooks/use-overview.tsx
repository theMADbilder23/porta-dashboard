"use client";

import { useEffect, useState } from "react";
import type { OverviewResponse } from "@/types/types";

type UseOverviewResult = {
  data: OverviewResponse | null;
  isLoading: boolean;
  error: string | null;
};

export function useOverview(timeframe = "daily"): UseOverviewResult {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchOverview() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/overview?timeframe=${timeframe}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch overview: ${response.status}`);
        }

        const json = (await response.json()) as OverviewResponse;

        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOverview();

    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  return { data, isLoading, error };
}