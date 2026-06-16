# Load Tests (k6) — Session 16a, Block 7

**Status: scaffold.** Scripts are ready to run but k6 is not part of the CI
quality-gate (it needs the [k6 binary](https://grafana.com/docs/k6/latest/set-up/install-k6/)
and a populated, production-like environment to produce meaningful p95 numbers).

## Install k6

```bash
brew install k6        # macOS
# or see https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## Mint a test token

The HTTP scripts need a valid access token. Log in via the API and copy the
`accessToken`, then export it:

```bash
export TEST_JWT="<access token>"
export API_URL="http://localhost:3001"
```

## Scenarios & thresholds

| Script                 | Load                     | Threshold       |
| ---------------------- | ------------------------ | --------------- |
| `contacts-load.js`     | 100 VUs / 5 min          | p95 < 300 ms    |
| `deals-kanban-load.js` | 50 VUs / 3 min           | p95 < 500 ms    |
| `ws-pulse-load.js`     | 500 connections / 10 min | handshake < 1 s |

```bash
k6 run k6/contacts-load.js
PIPELINE_ID=<id> k6 run k6/deals-kanban-load.js
WS_URL=ws://localhost:3001 k6 run k6/ws-pulse-load.js
```

A non-zero exit code means a threshold was breached.
