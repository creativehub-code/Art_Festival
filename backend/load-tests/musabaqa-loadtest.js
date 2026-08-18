import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// --- CONFIGURATION ---
// Safe default configuration. Do not run high VU tests on initial run.
const vus = parseInt(__ENV.K6_VUS || '10', 10);
const duration = __ENV.K6_DURATION || '2m';
const baseUrl = __ENV.K6_BASE_URL || 'https://art-festival-test-backend.onrender.com';
const origin = __ENV.K6_ORIGIN || 'http://localhost:3000'; // Default known from project config

// Credentials MUST be passed via environment variables
const adminEmail = __ENV.TEST_ADMIN_EMAIL;
const adminPassword = __ENV.TEST_ADMIN_PASSWORD;
const judgeEmail = __ENV.TEST_JUDGE_EMAIL;
const judgePassword = __ENV.TEST_JUDGE_PASSWORD;

// Specific test IDs required to avoid corrupting production data
const testProgramId = __ENV.TEST_PROGRAM_ID || 'replace_with_test_program_id';
const testParticipantId = __ENV.TEST_PARTICIPANT_ID || 'replace_with_test_participant_id';

// --- CUSTOM METRICS ---
const errorRate = new Rate('errors');
const expectedRejections = new Rate('expected_rejections');
const authFailures = new Rate('auth_failures');

export const options = {
    thresholds: {
        'http_req_duration': ['p(95)<1000', 'p(99)<2000'], // 95% of requests must complete below 1s
        'http_req_failed': ['rate<0.05'], // Max 5% failure rate
        'errors': ['rate<0.05'],
    },
};

// --- HELPER: AUTHENTICATION ---
function authenticate(email, password) {
    const jar = http.cookieJar();

    // 1. Fetch CSRF Token
    let csrfRes = http.get(`${baseUrl}/api/csrf-token`, { headers: { 'Origin': origin } });
    check(csrfRes, {
        'CSRF token retrieved': (r) => r.status === 200 && r.json('csrfToken') !== undefined,
    });
    
    if (csrfRes.status !== 200) {
        errorRate.add(1);
        authFailures.add(1);
        return null;
    }

    const csrfToken = csrfRes.json('csrfToken');

    // 2. Login (Needs CSRF header but technically exempt by middleware, sending it anyway)
    const loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
        email: email,
        password: password
    }), {
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'Origin': origin
        }
    });

    check(loginRes, {
        'Login successful': (r) => r.status === 200,
    });

    if (loginRes.status !== 200) {
        errorRate.add(1);
        authFailures.add(1);
        return null;
    }

    return { csrfToken, cookies: jar.cookiesForURL(baseUrl) };
}

// --- SCENARIO A: PUBLIC VIEWERS (READ-ONLY) ---
export function publicViewerScenario() {
    group('Public Viewers Workflow', function () {
        const endpoints = [
            `${baseUrl}/api/public/programs`,
            `${baseUrl}/api/public/teams/leaderboard`,
        ];

        // Randomly pick a read endpoint to simulate user navigation
        const url = endpoints[Math.floor(Math.random() * endpoints.length)];
        const res = http.get(url, { headers: { 'Origin': origin } });

        const success = check(res, {
            'Public API status 200': (r) => r.status === 200,
        });
        
        if (!success) {
            errorRate.add(1);
            if (res.status >= 500) {
                console.error(`[PUBLIC] 5xx Error on ${url}: ${res.status}`);
            }
        }
        
        sleep(Math.random() * 2 + 1); // Think time 1-3 seconds
    });
}

// --- SCENARIO B: JUDGE WORKFLOW (READ + CONTROLLED WRITE) ---
export function judgeScenario() {
    if (!judgeEmail || !judgePassword) {
        console.warn('Skipping Judge Scenario: Credentials not provided');
        sleep(5);
        return;
    }

    group('Judge Authentication', function () {
        const authData = authenticate(judgeEmail, judgePassword);
        if (!authData) return;

        const headers = {
            'Content-Type': 'application/json',
            'x-csrf-token': authData.csrfToken,
            'Origin': origin
        };

        group('Judge Reads', function () {
            // Fetch participant list
            const partRes = http.get(`${baseUrl}/api/participants`, { headers });
            check(partRes, { 'Fetched participants': (r) => r.status === 200 });

            // Fetch marks for the program
            const marksRes = http.get(`${baseUrl}/api/marks/${testProgramId}`, { headers });
            check(marksRes, { 'Fetched marks': (r) => r.status === 200 });
        });

        // Uncomment the section below ONLY if explicitly testing WRITE operations in Phase 6+
        /*
        group('Judge Writes (Submit Mark)', function () {
            const submitRes = http.post(`${baseUrl}/api/marks`, JSON.stringify({
                programId: testProgramId,
                participantId: testParticipantId,
                marksGiven: Math.floor(Math.random() * 10) + 1
            }), { headers });

            const status = submitRes.status;
            
            check(submitRes, {
                'Mark submitted or intentionally rejected (409)': (r) => [200, 201, 409].includes(r.status)
            });

            if (status === 409) {
                expectedRejections.add(1); // Application correctly rejected duplicate mark
            } else if (![200, 201].includes(status)) {
                errorRate.add(1);
            }
        });
        */
        
        sleep(Math.random() * 3 + 2); // Think time 2-5 seconds
    });
}

// --- SCENARIO C: ADMIN WORKFLOW (READ-HEAVY) ---
export function adminScenario() {
    if (!adminEmail || !adminPassword) {
        console.warn('Skipping Admin Scenario: Credentials not provided');
        sleep(5);
        return;
    }

    group('Admin Authentication', function () {
        const authData = authenticate(adminEmail, adminPassword);
        if (!authData) return;

        const headers = {
            'Content-Type': 'application/json',
            'x-csrf-token': authData.csrfToken,
            'Origin': origin
        };

        group('Admin Dashboard Reads', function () {
            // Fetch system reference data
            const refRes = http.batch([
                { method: 'GET', url: `${baseUrl}/api/programs`, params: { headers } },
                { method: 'GET', url: `${baseUrl}/api/teams`, params: { headers } },
                { method: 'GET', url: `${baseUrl}/api/groups`, params: { headers } },
            ]);
            
            check(refRes, {
                'Admin reference data fetched': (r) => r.every(res => res.status === 200)
            });

            // Fetch marks for a specific program
            const marksRes = http.get(`${baseUrl}/api/marks/${testProgramId}`, { headers });
            check(marksRes, { 'Admin fetched marks': (r) => r.status === 200 });
        });

        // Calculation and Approval are write-heavy and disabled for initial safe load testing.
        // They should be manually enabled in later specific scenarios.
        
        sleep(Math.random() * 5 + 2); // Think time 2-7 seconds
    });
}

// --- MAIN EXECUTOR ---
// When K6_VUS and K6_DURATION are passed, k6 uses the default execution model.
export default function () {
    // Distribute VUs roughly: 10% admin, 20% judge, 70% public viewer
    const r = Math.random();
    if (r < 0.1) {
        adminScenario();
    } else if (r < 0.3) {
        judgeScenario();
    } else {
        publicViewerScenario();
    }
}
