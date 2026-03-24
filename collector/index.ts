const DEBANK_API_KEY = process.env.DEBANK_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

const DEBANK_BASE = "https://pro-openapi.debank.com/v1";

type DebankToken = {
  id?: string;
  chain?: string;
  name?: string;
  symbol?: string;
  amount?: number;
  price?: number;
  usd_value?: number;
  is_core?: boolean;
  is_wallet?: boolean;
  is_verified?: boolean;
  is_scam?: boolean;
  is_suspicious?: boolean;
};

type DebankProtocol = {
  id?: string;
  chain?: string;
  name?: string;
  logo_url?: string;
  stats?: {
    asset_usd_value?: number;
    debt_usd_value?: number;
    net_usd_value?: number;
  };
};

async function debankGet(path: string) {
  const res = await fetch(`${DEBANK_BASE}${path}`, {
    headers: {
      AccessKey: DEBANK_API_KEY || "",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeBank ${res.status}: ${text}`);
  }

  return res.json();
}

function isNativeGasCoin(token: DebankToken) {
  const symbol = (token.symbol || "").toUpperCase();
  return ["ETH", "BNB", "MATIC", "AVAX", "FTM", "MOVR", "GLMR"].includes(symbol);
}

function keepToken(token: DebankToken) {
  const usd = token.usd_value || 0;

  if (token.is_scam || token.is_suspicious) return false;
  if (isNativeGasCoin(token)) return true;
  if (token.is_verified && usd >= 25) return true;
  if (token.is_core && usd >= 25) return true;
  if (usd >= 100) return true;

  return false;
}

function keepProtocol(protocol: DebankProtocol) {
  const net =
    protocol.stats?.net_usd_value ??
    protocol.stats?.asset_usd_value ??
    0;

  return net >= 50;
}

async function runCollector() {
  try {
    console.log(`Running collector for ${WALLET_ADDRESS} ...`);

    const totalBalance = await debankGet(
      `/user/total_balance?id=${WALLET_ADDRESS}`
    );

    const usedChains = await debankGet(
      `/user/used_chain_list?id=${WALLET_ADDRESS}`
    );

    const allTokens: DebankToken[] = await debankGet(
      `/user/all_token_list?id=${WALLET_ADDRESS}&is_all=false`
    );

    const allProtocols: DebankProtocol[] = await debankGet(
      `/user/all_complex_protocol_list?id=${WALLET_ADDRESS}`
    );

    const keptTokens = allTokens
      .filter(keepToken)
      .sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0))
      .slice(0, 25);

    const keptProtocols = allProtocols
      .filter(keepProtocol)
      .sort((a, b) => {
        const aVal =
          a.stats?.net_usd_value ?? a.stats?.asset_usd_value ?? 0;
        const bVal =
          b.stats?.net_usd_value ?? b.stats?.asset_usd_value ?? 0;
        return bVal - aVal;
      })
      .slice(0, 15);

    console.log(
      JSON.stringify(
        {
          wallet: WALLET_ADDRESS,
          total_usd_value: totalBalance?.total_usd_value || 0,
          chain_count: Array.isArray(usedChains) ? usedChains.length : 0,
          kept_token_count: keptTokens.length,
          kept_protocol_count: keptProtocols.length,
          top_tokens: keptTokens.slice(0, 5).map((t) => ({
            symbol: t.symbol,
            chain: t.chain,
            usd_value: t.usd_value,
          })),
          top_protocols: keptProtocols.slice(0, 5).map((p) => ({
            name: p.name,
            chain: p.chain,
            net_usd_value:
              p.stats?.net_usd_value ?? p.stats?.asset_usd_value ?? 0,
          })),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Collector error:", err);
  }
}

runCollector();
setInterval(runCollector, 60_000);