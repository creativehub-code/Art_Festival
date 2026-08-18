`# Musabaqa Art Festival - K6 Load Testing

This directory contains the automated K6 load testing suite for the Art Festival platform.

**IMPORTANT SAFETY RULE: NEVER RUN THIS AGAINST PRODUCTION.**

The tests are specifically designed for the isolated TEST environment.

## 1. Prerequisites & Installation

To run these tests, you must have `k6` installed on your machine.
- **Windows (Winget):** `winget install k6`
- **Mac (Homebrew):** `brew install k6`
- **Linux (Debian/Ubuntu):** `sudo apt-get install k6`

## 2. Required Environment Variables

Before running the test, configure the following environment variables. Do NOT hardcode credentials into the script.

**Windows (PowerShell):**
```powershell
$env:K6_BASE_URL="https://art-festival-test-backend.onrender.com"
$env:TEST_ADMIN_EMAIL="admin_test@example.com"
$env:TEST_ADMIN_PASSWORD="your_test_admin_password"
$env:TEST_JUDGE_EMAIL="judge_test@example.com"
$env:TEST_JUDGE_PASSWORD="your_test_judge_password"
$env:TEST_PROGRAM_ID="replace_with_test_program_id"
$env:TEST_PARTICIPANT_ID="replace_with_test_participant_id"
```

**Mac/Linux:**
```bash
export K6_BASE_URL="https://art-festival-test-backend.onrender.com"
export TEST_ADMIN_EMAIL="admin_test@example.com"
export TEST_ADMIN_PASSWORD="your_test_admin_password"
export TEST_JUDGE_EMAIL="judge_test@example.com"
export TEST_JUDGE_PASSWORD="your_test_judge_password"
export TEST_PROGRAM_ID="replace_with_test_program_id"
export TEST_PARTICIPANT_ID="replace_with_test_participant_id"
```

## 3. How to Run the Initial 10-VU Safe Test

The initial test uses a small configuration to establish a baseline and verify the test harness is working.

```bash
K6_VUS=10 K6_DURATION=2m k6 run musabaqa-loadtest.js
```

*(For Windows PowerShell)*:
```powershell
$env:K6_VUS=10; $env:K6_DURATION="2m"; k6 run musabaqa-loadtest.js
```

## 4. Scaling the Test (Test Levels)

Once the 10 VU test passes successfully, you can scale up the test by modifying the environment variables:

- **Level 1 (10 VUs):** `K6_VUS=10 K6_DURATION=2m k6 run musabaqa-loadtest.js`
- **Level 2 (50 VUs):** `K6_VUS=50 K6_DURATION=3m k6 run musabaqa-loadtest.js`
- **Level 3 (100 VUs):** `K6_VUS=100 K6_DURATION=3m k6 run musabaqa-loadtest.js`
- **Level 4 (200 VUs):** `K6_VUS=200 K6_DURATION=5m k6 run musabaqa-loadtest.js`
- **Level 5 (350 VUs):** `K6_VUS=350 K6_DURATION=5m k6 run musabaqa-loadtest.js`

*Note: Ensure your Render instance and MongoDB Atlas tier can handle the scaled load before proceeding past Level 2.*

## 5. Scenarios

- **Public Viewers (Read-Only):** Simulates users accessing public endpoints like programs and leaderboards. Safe to run at scale.
- **Judge Workflow (Read-Heavy / Controlled Write):** Simulates judge login and data fetching. The mark submission POST request is commented out by default to maintain database safety during read-only load testing.
- **Admin Workflow (Read-Only):** Simulates admin dashboard data gathering. Heavy write operations like 'Calculate Scores' are explicitly excluded from automated load testing.

## 6. How to Stop the Test Safely

If you notice infrastructure degradation:
1. Press `Ctrl + C` in the terminal running K6.
2. The K6 process will immediately halt and print partial statistics.

## 7. Performance Thresholds & Interpreting Results

K6 will output a summary block at the end. Pay attention to:

- `http_req_duration`: Look at `p(95)` and `p(99)`.
  - **p95 < 1000ms** is considered healthy for this test.
  - If p99 spikes severely, the backend Node.js event loop or MongoDB connection pool might be saturated.
- `http_req_failed`: Must be `< 0.05` (5% error rate threshold).
- `expected_rejections`: Tracks HTTP 409 Conflict responses (e.g. duplicate mark submissions) which are expected application behavior, NOT server crashes.

## 8. Render & MongoDB Observation Checklist

While K6 is running, actively monitor your infrastructure:

### Render Dashboard
- [ ] CPU Utilization (Watch for >85%)
- [ ] RAM Usage (Watch for memory leaks approaching instance limits)
- [ ] Instance Restarts (OOM crashes will show here)
- [ ] HTTP 5xx Errors in Logs

### MongoDB Atlas Dashboard
- [ ] Connection Count (Ensure connection pool isn't maxed out)
- [ ] Operations/sec (Compare read ops vs write ops)
- [ ] CPU and Cluster Load
- [ ] Query Latency (Watch for missing indexes during heavy concurrent queries)
