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
  assert.equal(output, "5h: █░░░░ 12.5% (1h) · 7d: ████░ 72% (2d)");
}

// Verify countdown units at their boundaries
{
  const now = Date.UTC(2026, 0, 1);
  for (const [minutes, expected] of [
    [1, "1m"],
    [59, "59m"],
    [60, "1h"],
    [1439, "23h"],
    [1440, "1d"],
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
    assert.ok(formatUsage(data, now).includes(`(${expected})`));
  }
}

// Verify missing data is not presented as zero usage
{
  assert.ok(formatUsage({ reports: [] }, 0).includes("unavailable"));
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
    for (const line of component.render(width)) {
      assert.equal([...line].length, width);
      assert.ok(line.startsWith(" "));
      assert.ok(!line.endsWith(" "));
    }
  }
  const styled = widget(
    {},
    { fg: (color, text) => `<${color}>${text}</${color}>` },
  ).render(80)[0];
  assert.ok(styled.includes("<muted>5h: </muted>"));
  assert.ok(styled.includes("<muted> (0m) · 7d: </muted>"));
  assert.ok(styled.includes("25%"));
  assert.ok(!styled.includes("<muted>25%</muted>"));
  assert.ok(styled.includes("<accent>█"));
  assert.ok(styled.includes("<warning>████"));
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
