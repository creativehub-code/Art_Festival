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
const successfulMarks = new Rate('successful_marks');

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

    return { csrfToken, cookies: jar.cookiesForURL(baseUrl), user: loginRes.json('user') };
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
    // If running an automated load test, testProgramId might be 'replace_with_test_program_id'
    // In this case, we auto-generate deterministic credentials and mappings per VU
    const isAuto = testProgramId === 'replace_with_test_program_id' || testProgramId === 'auto';
    
    if (!isAuto && (!judgeEmail || !judgePassword)) {
        console.warn('Skipping Judge Scenario: Credentials not provided');
        sleep(5);
        return;
    }

    // Determine deterministic credentials based on VU
    // We only use Judges 1-4 because they are assigned to LOADTEST_PROGRAM_04 (the only program participants are registered for)
    const judgeIndex = ((__VU - 1) % 4) + 1; 
    const currentJudgeEmail = isAuto ? `loadtest_judge_${String(judgeIndex).padStart(2, '0')}@test.com` : judgeEmail;
    const currentJudgePassword = isAuto ? 'password123' : judgePassword;

    group('Judge Authentication', function () {
        const authData = authenticate(currentJudgeEmail, currentJudgePassword);
        if (!authData) return;

        const headers = {
            'Content-Type': 'application/json',
            'x-csrf-token': authData.csrfToken,
            'Origin': origin
        };

        // Determine program ID dynamically
        // LOADTEST_PROGRAM_04 is the 4th assigned program (index 3) for JudgeGroup 1
        let currentProgramId = testProgramId;
        if (isAuto && authData.user && authData.user.assignedPrograms) {
            currentProgramId = authData.user.assignedPrograms.length > 3 
                ? authData.user.assignedPrograms[3] 
                : authData.user.assignedPrograms[0];
        }

        let currentParticipantId = testParticipantId;

        group('Judge Reads', function () {
            // Fetch participant list
            const partRes = http.get(`${baseUrl}/api/participants?limit=200`, { headers });
            check(partRes, { 'Fetched participants': (r) => r.status === 200 });

            if (isAuto && partRes.status === 200) {
                const participantsList = partRes.json('data');
                if (participantsList && participantsList.length > 0) {
                    // Pick a unique participant based on VU to ensure 10 VUs can submit without hitting 409 duplicates initially
                    const pIndex = (__VU - 1) % participantsList.length;
                    currentParticipantId = participantsList[pIndex]._id;
                }
            }

            // Fetch marks for the program
            if (currentProgramId !== 'replace_with_test_program_id') {
                const marksRes = http.get(`${baseUrl}/api/marks/${currentProgramId}`, { headers });
                check(marksRes, { 'Fetched marks': (r) => r.status === 200 });
            }
        });

        // Explicitly testing WRITE operations for the Judge Mark Submission Scenario
        group('Judge Writes (Submit Mark)', function () {
            if (!currentProgramId || !currentParticipantId || currentProgramId === 'replace_with_test_program_id') {
                console.warn(`VU ${__VU}: Skipping write, missing dynamic IDs`);
                return;
            }

            const submitRes = http.post(`${baseUrl}/api/marks`, JSON.stringify({
                programId: currentProgramId,
                participantId: currentParticipantId,
                marksGiven: Math.floor(Math.random() * 10) + 1
            }), { headers });

            const status = submitRes.status;
            
            check(submitRes, {
                'Mark submitted or intentionally rejected (409)': (r) => [200, 201, 409].includes(r.status)
            });

            if (status === 409) {
                expectedRejections.add(1); // Application correctly rejected duplicate mark
            } else if ([200, 201].includes(status)) {
                successfulMarks.add(1); // Track successful submissions
            } else {
                errorRate.add(1);
            }
        });
        
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
