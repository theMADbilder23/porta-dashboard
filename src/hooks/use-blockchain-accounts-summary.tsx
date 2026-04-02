"use client";

import { useEffect, useState } from "react";
import type { BlockchainAccountsSummaryResponse } from "@/types/types";

type UseBlockchainAccountsSummaryResult = {
  data: BlockchainAccountsSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
};

export function useBlockchainAccountsSummary(): UseBlockchainAccountsSummaryResult {
  const [data, setData] = useState<BlockchainAccountsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSummary() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/blockchain-accounts-summary");

        if (!response.ok) {
          throw new Error(
            `Failed to fetch blockchain accounts summary: ${response.status}`
          );
        }

        const json =
          (await response.json()) as BlockchainAccountsSummaryResponse;

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

    fetchSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, isLoading, error };
}