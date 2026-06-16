import http from 'k6/http';
import { check } from 'k6';

// Contacts list endpoint — 100 VUs, 5 min, p95 < 300 ms (Session 16a, Block 7).
// Run: TEST_JWT=<token> API_URL=http://localhost:3001 k6 run k6/contacts-load.js
export const options = {
  vus: 100,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  const res = http.get(`${API_URL}/api/v1/contacts?limit=50`, {
    headers: { Authorization: `Bearer ${__ENV.TEST_JWT}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
}
