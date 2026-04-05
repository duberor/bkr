# UPS Planner Pro

## Install

Use Node.js 20.19+ or 22+.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npm test
```

## Product flow

Main user route:

1. `Огляд` — quick project status, import/export JSON, next step.
2. `Прилади` — add zones and only those devices that must work during outages.
3. `Параметри` — set battery type, system voltage, and desired runtime in hours or days.
4. `Рішення` — see inverter, battery capacity, runtime, and battery options.
5. `Обладнання` — review compatible equipment and optional marketplace matches.
6. `Звіт` — print or save a clean PDF-oriented report.

## Calculation assumptions

- Desired runtime is stored canonically as `targetAutonomyHours`.
- Battery sizing is based on daily energy use scaled by the requested runtime.
- Inverter sizing uses the scheduled peak running load plus the worst startup delta.
- Device startup power is optional. If omitted, working power is used automatically.
- Advanced settings (`inverterEfficiency`, `reserveRatio`, `batteryReserveRatio`) remain available for expert tuning.

## Live marketplace search

To enable marketplace suggestions on `Обладнання`, set these env vars:

```bash
VITE_GOOGLE_CSE_API_KEY=
VITE_GOOGLE_CSE_CX=
```

Without them, the local catalog still works and the live-search block stays disabled.

## Fixes in this package

- fixed Choices.js init crash
- fixed stretched charts
- added locale number parsing (10,5)
- grouped consumers by zones using accordions
