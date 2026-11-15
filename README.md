# OMP Usage Widget

An OMP extension that displays OpenAI Codex usage above the editor. It shows the usage percentage and reset countdown for the five-hour and seven-day windows. The widget requests usage from OMP at startup and every five minutes.

## Example

```txt
5h: ██░░░░░░ 25% (↻3h)
7d: ██████░░ 75% (↻2d)
```

The bars use the active theme's accent color below 70%, warning color from 70% to below 90%, and error color at 90% and above. Each bar is rounded to the nearest of eight blocks.

## Requirements

- [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi)
- ChatGPT Plus/Pro with Codex access

## Installation

From the extension directory, copy the entry point to OMP's user extensions directory:

```sh
mkdir -p ~/.omp/agent/extensions/omp-usage-widget
cp index.js ~/.omp/agent/extensions/omp-usage-widget/index.js
```
