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
      reset =
        minutes >= 1440
          ? `${Math.floor(minutes / 1440)}d`
          : minutes >= 60
            ? `${Math.floor(minutes / 60)}h`
            : `${minutes}m`;
    }
    const filled = Math.round(
      Math.max(0, Math.min(1, limit.amount.usedFraction)) * 5,
    );
    const bar = "█".repeat(filled) + "░".repeat(5 - filled);
    return `${id}: ${bar} ${percent}% (${reset})`;
  });
  return windows.join(" · ");
}

// Render quota rows against the current editor width
function showUsage(ctx, lines, limits = []) {
  ctx.ui.setWidget(
    "usage-widget",
    (_tui, theme) => ({
      render(width) {
        return lines.map((line) => {
          const text = [...line].slice(0, width).join("");
          const padding = " ".repeat(Math.max(0, width - [...text].length));
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
        showUsage(ctx, [formatUsage(data)], report?.limits);
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
