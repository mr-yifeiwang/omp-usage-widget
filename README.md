# OMP Usage Widget

An OMP extension that displays OpenAI Codex usage above the editor. It shows the usage percentage and reset countdown for the five-hour and seven-day windows. The widget requests usage from OMP at startup and every five minutes.

The plugin currently supports the following providers:

- `openai-codex`

## Example

```txt
5h ██░░░░░░░░ 25% ↻ 3h29m
7d ███████░░░ 75% ↻ 2d 3h
```

The bars use the active theme's accent color below 60%, warning color from 60% to below 90%, and error color at 90% and above. Each filled block represents a complete 10% of usage.

## Requirements

- [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi)
- ChatGPT Plus/Pro with Codex access

## Installation

```sh
omp plugin install git:github.com/mr-yifeiwang/omp-usage-widget
```
