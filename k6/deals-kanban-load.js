import http from 'k6/http';
import { check } from 'k6';

// Deals Kanban query (complex: stages + cards + aggregates) — 50 VUs, 3 min,
// p95 < 500 ms (Session 16a, Block 7).
// Run: TEST_JWT=<token> PIPELINE_ID=<id> k6 run k6/deals-kanban-load.js
export const options = {
  vus: 50,
  duration: '3m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3001';
const PIPELINE_ID = __ENV.PIPELINE_ID || '';

export default function () {
  const res = http.get(`${API_URL}/api/v1/deals?pipelineId=${PIPELINE_ID}`, {
    headers: { Authorization: `Bearer ${__ENV.TEST_JWT}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
}
