// Format Codex quota windows for the dashboard
export function formatUsage(data, now = Date.now()) {
  const report =
    data.reports?.find((report) => report.provider === "openai-codex") ??
    data.reports?.[0];
  const limits = ["5h", "7d"].map((id) =>
    report?.limits?.find((limit) => limit.scope?.windowId === id),
  );
  const percents = limits.map((limit) =>
    Number.isFinite(limit?.amount?.usedFraction)
      ? `${Math.round(limit.amount.usedFraction * 1000) / 10}%`
      : null,
  );
  const percentWidth = Math.max(
    0,
    ...percents.map((percent) => percent?.length ?? 0),
  );
  const resets = limits.map((limit, index) => {
    if (percents[index] === null) return null;
    let reset = "reset unknown";
    if (Number.isFinite(limit.window?.resetsAt)) {
      const minutes = Math.max(
        0,
        Math.ceil((limit.window.resetsAt - now) / 60_000),
      );
      reset =
        minutes >= 1440
          ? `${Math.floor(minutes / 1440)}d`
          : minutes >= 60
            ? `${Math.floor(minutes / 60)}h`
            : `${minutes}m`;
    }
    return reset;
  });
  const resetWidth = Math.max(0, ...resets.map((reset) => reset?.length ?? 0));
  const windows = ["5h", "7d"].map((id, index) => {
    const limit = limits[index];
    const percent = percents[index];
    if (percent === null) return `${id}: unavailable`;
    const filled = Math.round(
      Math.max(0, Math.min(1, limit.amount.usedFraction)) * 8,
    );
    const bar = "█".repeat(filled) + "░".repeat(8 - filled);
    return `${id}: ${bar} ${percent.padStart(percentWidth)} (↻${resets[index].padStart(resetWidth)})`;
  });
  return windows.join("\n");
}

// Render quota rows against the current editor width
function showUsage(ctx, lines, limits = []) {
  ctx.ui.setWidget(
    "omp-usage-widget",
    (_tui, theme) => ({
      render(width) {
        const padding = " ".repeat(
          Math.max(
            0,
            width - Math.max(...lines.map((line) => [...line].length)),
          ),
        );
        return lines.map((line) => {
          const text = [...line].slice(0, width).join("");
          let styled = "";
          let cursor = 0;
          for (const match of text.matchAll(/█+|░+|\d+(?:\.\d+)?%/g)) {
            styled += theme.fg("muted", text.slice(cursor, match.index));
            styled += match[0].endsWith("%")
              ? match[0]
              : theme.fg(
                  match[0][0] === "█"
                    ? (() => {
                        const windowId =
                          text.slice(0, match.index).lastIndexOf("7d:") >= 0
                            ? "7d"
                            : "5h";
                        const fraction = limits.find(
                          (limit) => limit.scope?.windowId === windowId,
                        )?.amount?.usedFraction;
                        return fraction >= 0.9
                          ? "error"
                          : fraction >= 0.7
                            ? "warning"
                            : "accent";
                      })()
                    : "muted",
                  match[0],
                );
            cursor = match.index + match[0].length;
          }
          styled += theme.fg("muted", text.slice(cursor));
          return padding + styled;
        });
      },
      invalidate() {},
    }),
    { placement: "aboveEditor" },
  );
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
        const data = JSON.parse(result.stdout);
        const report =
          data.reports?.find((report) => report.provider === "openai-codex") ??
          data.reports?.[0];
        showUsage(ctx, formatUsage(data).split("\n"), report?.limits);
      } catch {
        showUsage(ctx, ["Usage  unavailable"]);
      } finally {
        running = false;
      }
    };
    showUsage(ctx, ["Usage  loading…"]);
    ctx.setInterval(refresh, 5 * 60_000);
    await refresh();
  });
}
