type AssetViewerPageProps = {
  params: {
    token: string;
  };
};

function decodeToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function AssetViewerPage({ params }: AssetViewerPageProps) {
  const token = decodeToken(params.token);

  return (
    <div className="min-h-screen p-6">
      <div className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
          Portfolio / Assets
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
          Asset Viewer
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
          Placeholder page for asset-level intelligence, charting, thresholds,
          reward tracking, and MMII insights.
        </p>

        <div className="mt-6 rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Asset Route Param
          </p>
          <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {token}
          </p>
        </div>
      </div>
    </div>
  );
}