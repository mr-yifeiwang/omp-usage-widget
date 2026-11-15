// Format Codex quota windows for the dashboard
export function formatUsage(data, now = Date.now()) {
  const report =
    data.reports?.find((report) => report.provider === "openai-codex") ??
    data.reports?.[0];
  const windows = ["5h", "7d"].map((id) => {
    const limit = report?.limits?.find((limit) => limit.scope?.windowId === id);
    if (!Number.isFinite(limit?.amount?.usedFraction))
      return `${id}: unavailable`;
    const percent = Math.round(limit.amount.usedFraction * 1000) / 10;
    let reset = "reset unknown";
    if (Number.isFinite(limit.window?.resetsAt)) {
      const minutes = Math.max(
        0,
        Math.ceil((limit.window.resetsAt - now) / 60_000),
      );
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      const mins = minutes % 60;
      reset = days
        ? `${days}d ${hours}h`
        : hours
          ? `${hours}h ${mins}m`
          : `${mins}m`;
    }
    return `${id}: ${percent}% (${reset})`;
  });
  return `Usage  ${windows.join("  ·  ")}`;
}

// Keep the main session's widget refreshed using OMP's cached usage reports
export default function usageWidget(pi) {
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.mode !== "tui" || ctx.agent.kind !== "main") return;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const result = await pi.exec(
          "omp",
          ["usage", "--json", "--provider", "openai-codex", "--no-extensions"],
          { timeout: 20_000 },
        );
        if (result.code !== 0) throw new Error("Usage command failed");
        ctx.ui.setWidget("usage-widget", [
          formatUsage(JSON.parse(result.stdout)),
        ]);
      } catch {
        ctx.ui.setWidget("usage-widget", ["Usage  unavailable"]);
      } finally {
        running = false;
      }
    };
    ctx.ui.setWidget("usage-widget", ["Usage  loading…"]);
    ctx.setInterval(refresh, 5 * 60_000);
    await refresh();
  });
}
