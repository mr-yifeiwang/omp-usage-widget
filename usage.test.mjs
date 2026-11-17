import assert from "node:assert/strict";
import usageWidget, { formatUsage } from "./index.js";

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
  assert.equal(
    output,
    "5h █░░░░░░░░░ 12.5% ↻ 1h30m\n7d ███████░░░   72% ↻ 2d 1h",
  );
}

// Verify percentages and reset countdowns stay in columns across number widths
{
  for (const [first, second] of [
    [0, 0.97],
    [0.125, 1],
    [1, 0.009],
  ]) {
    const data = {
      reports: [
        {
          limits: [
            {
              scope: { windowId: "5h" },
              amount: { usedFraction: first },
              window: { resetsAt: 60_000 },
            },
            {
              scope: { windowId: "7d" },
              amount: { usedFraction: second },
              window: { resetsAt: 120_000 },
            },
          ],
        },
      ],
    };
    const [firstRow, secondRow] = formatUsage(data, 0).split("\n");
    assert.equal(firstRow.indexOf("%"), secondRow.indexOf("%"));
    assert.equal(firstRow.indexOf("↻"), secondRow.indexOf("↻"));
  }
}

// Verify countdown values align across different widths
{
  const data = {
    reports: [
      {
        limits: [
          {
            scope: { windowId: "5h" },
            amount: { usedFraction: 0 },
            window: { resetsAt: 4 * 3_600_000 },
          },
          {
            scope: { windowId: "7d" },
            amount: { usedFraction: 0.97 },
            window: { resetsAt: 11 * 3_600_000 },
          },
        ],
      },
    ],
  };
  assert.equal(
    formatUsage(data, 0),
    "5h ░░░░░░░░░░  0% ↻  4h0m\n7d ██████████ 97% ↻ 11h0m",
  );
}

// Verify both countdown components align when their widths differ
{
  const data = {
    reports: [
      {
        limits: [
          {
            scope: { windowId: "5h" },
            amount: { usedFraction: 0 },
            window: { resetsAt: 209 * 60_000 },
          },
          {
            scope: { windowId: "7d" },
            amount: { usedFraction: 0 },
            window: { resetsAt: 3060 * 60_000 },
          },
        ],
      },
    ],
  };
  assert.equal(
    formatUsage(data, 0),
    "5h ░░░░░░░░░░ 0% ↻ 3h29m\n7d ░░░░░░░░░░ 0% ↻ 2d 3h",
  );
}

// Verify countdown units at their boundaries
{
  const now = Date.UTC(2026, 0, 1);
  for (const [minutes, expected] of [
    [1, "1m"],
    [59, "59m"],
    [60, "1h0m"],
    [209, "3h29m"],
    [1439, "23h59m"],
    [1440, "1d0h"],
    [3114, "2d3h"],
  ]) {
    const data = {
      reports: [
        {
          limits: [
            {
              scope: { windowId: "5h" },
              window: { resetsAt: now + minutes * 60_000 },
              amount: { usedFraction: 0 },
            },
          ],
        },
      ],
    };
    assert.ok(formatUsage(data, now).includes(`↻ ${expected}`));
  }
}

// Verify missing data is not presented as zero usage
{
  assert.ok(formatUsage({ reports: [] }, 0).includes("unavailable"));
}
// Verify widget visibility follows the current model provider
{
  let start, widget;
  let provider = "anthropic";
  usageWidget({
    on(event, handler) {
      if (event === "session_start") start = handler;
    },
    async exec() {
      return { code: 0, stdout: JSON.stringify({ reports: [] }) };
    },
  });
  await start(
    {},
    {
      mode: "tui",
      agent: { kind: "main" },
      models: { current: () => ({ provider }) },
      setInterval() {},
      ui: {
        setWidget(_key, value) {
          widget = value;
        },
      },
    },
  );
  const component = widget({}, { fg: (_color, text) => text });
  assert.deepEqual(component.render(80), []);
  provider = "openai-codex";
  assert.ok(
    component.render(80).some((line) => line.includes("5h unavailable")),
  );
  provider = "openai";
  assert.deepEqual(component.render(80), []);
}
// Verify the widget remains right-aligned as the terminal is resized
{
  let start;
  let widget;
  const pi = {
    on(_event, handler) {
      start = handler;
    },
    async exec() {
      return {
        code: 0,
        stdout: JSON.stringify({
          reports: [
            {
              limits: [
                {
                  scope: { windowId: "5h" },
                  amount: { usedFraction: 0.25 },
                  window: { resetsAt: 0 },
                },
                {
                  scope: { windowId: "7d" },
                  amount: { usedFraction: 0.75 },
                  window: { resetsAt: 0 },
                },
              ],
            },
          ],
        }),
      };
    },
  };
  usageWidget(pi);
  await start(
    {},
    {
      mode: "tui",
      agent: { kind: "main" },
      models: { current: () => ({ provider: "openai-codex" }) },
      setInterval() {},
      ui: {
        setWidget(_key, value) {
          widget = value;
        },
      },
    },
  );
  assert.equal(typeof widget, "function");
  const component = widget(
    {},
    { fg: (_color, text) => text, bold: (text) => text },
  );
  for (const width of [60, 80]) {
    const rows = component.render(width);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].indexOf("█"), rows[1].indexOf("█"));
    assert.ok(rows.every((line) => line.length <= width));
    assert.equal(Math.max(...rows.map((line) => line.length)), width);
  }
  const styled = widget(
    {},
    { fg: (color, text) => `<${color}>${text}</${color}>` },
  ).render(80);
  assert.ok(styled[0].includes("<muted>5h </muted>"));
  assert.ok(styled[1].includes("<muted>7d </muted>"));
  assert.ok(styled[0].includes("25%"));
  assert.ok(!styled[0].includes("<muted>25%</muted>"));
  assert.ok(styled[0].includes("<accent>█"));
  assert.ok(styled[1].includes("<warning>████"));
}
// Verify colors use unrounded usage at both threshold boundaries
{
  for (const [fraction, color] of [
    [0.6999, "accent"],
    [0.7, "warning"],
    [0.8999, "warning"],
    [0.9, "error"],
  ]) {
    let start, widget;
    usageWidget({
      on(_event, handler) {
        start = handler;
      },
      async exec() {
        return {
          code: 0,
          stdout: JSON.stringify({
            reports: [
              {
                limits: [
                  {
                    scope: { windowId: "5h" },
                    amount: { usedFraction: fraction },
                    window: { resetsAt: 0 },
                  },
                ],
              },
            ],
          }),
        };
      },
    });
    await start(
      {},
      {
        mode: "tui",
        agent: { kind: "main" },
        models: { current: () => ({ provider: "openai-codex" }) },
        setInterval() {},
        ui: {
          setWidget(_key, value) {
            widget = value;
          },
        },
      },
    );
    const line = widget(
      {},
      { fg: (name, text) => `<${name}>${text}</${name}>` },
    ).render(80)[0];
    assert.ok(line.includes(`<${color}>█`), `${fraction} should use ${color}`);
  }
}
console.log("Usage display tests passed");
