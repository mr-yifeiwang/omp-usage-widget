import assert from "node:assert/strict";
import { formatUsage } from "./index.js";

// Verify that each quota window uses its own percentage and reset time
{
  const now = Date.UTC(2026, 0, 1);
  const data = {
    reports: [
      {
        limits: [
          {
            scope: { windowId: "5h" },
            window: { resetsAt: now + 90 * 60_000 },
            amount: { usedFraction: 0.125 },
          },
          {
            scope: { windowId: "7d" },
            window: { resetsAt: now + 49 * 3_600_000 },
            amount: { usedFraction: 0.72 },
          },
        ],
      },
    ],
  };
  const output = formatUsage(data, now);
  assert.ok(output.includes("5h: 12.5% (1h 30m)"));
  assert.ok(output.includes("7d: 72% (2d 1h)"));
}

// Verify missing data is not presented as zero usage
{
  assert.ok(formatUsage({ reports: [] }, 0).includes("unavailable"));
}
console.log("Usage display tests passed");
