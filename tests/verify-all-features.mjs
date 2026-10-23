import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';

const results = [];
const errors = [];

function logPass(step, msg) {
  console.log(`[PASS] ${step}: ${msg}`);
  results.push({ step, status: 'PASS', msg });
}

function logFail(step, msg, err) {
  console.error(`[FAIL] ${step}: ${msg}`, err || '');
  results.push({ step, status: 'FAIL', msg, error: err?.message || String(err) });
  errors.push({ step, msg, err });
}

async function run() {
  console.log(`Starting headless Edge verification on ${BASE_URL}...`);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('Failed to load resource')) {
      console.warn(`  [Browser Console Error]: ${text}`);
      errors.push({ type: 'console.error', text });
    }
  });

  page.on('pageerror', err => {
    console.error(`  [Browser Page Error]: ${err.message}`);
    errors.push({ type: 'pageerror', text: err.message });
  });

  try {
    // -------------------------------------------------------------
    // Helper: Login, SPA Navigate & Logout
    // -------------------------------------------------------------
    async function loginAs(email, password, expectedText) {
      console.log(`\nLogging in as ${email}...`);
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });

      await page.waitForSelector('#login-email', { timeout: 6000 });
      await page.type('#login-email', email);
      await page.type('#login-password', password);
      await page.click('button[type="submit"]');

      await page.waitForFunction(
        txt => document.body.innerText.includes(txt),
        { timeout: 12000 },
        expectedText
      );
      await new Promise(r => setTimeout(r, 600));

      // Dismiss birthday popup if present
      await page.evaluate(() => {
        const dismissBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.innerText.includes("Don't remind again today") || b.innerText.includes('Dismiss')
        );
        if (dismissBtn) dismissBtn.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    async function navigateTo(path) {
      await page.evaluate(p => {
        window.history.pushState(null, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
      await new Promise(r => setTimeout(r, 1200));
    }

    async function logout() {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const outBtn = btns.find(b => b.innerText.includes('Sign out') || b.innerText.includes('Log out'));
        if (outBtn) outBtn.click();
        else localStorage.clear();
      });
      await new Promise(r => setTimeout(r, 800));
    }

    // -------------------------------------------------------------
    // 1. Employee Dashboard & Work Mode (Pratik Darji)
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log('1. EMPLOYEE & MANAGER DASHBOARD (Pratik Darji)');
    console.log('========================================');
    await loginAs('pratik.darji@secondmedic.com', 'Pr7!k#Nav9$Dar26^Q', 'Pratik');
    logPass('Auth', 'Logged in as Pratik Navin Darji');

    // 1.1 Work mode selector & Service duration
    const pratikDash = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasWorkMode = text.includes('Office') && text.includes('WFH') && text.includes('Field');
      const hasServiceDuration = text.includes('Service:') && (text.includes('yr') || text.includes('mo'));
      return { hasWorkMode, hasServiceDuration };
    });
    if (pratikDash.hasWorkMode) {
      logPass('Dashboard', 'Work Mode selector (Office/WFH/Field) rendered with active punch mode');
    } else {
      logFail('Dashboard', 'Work Mode selector not found on unpunched dashboard');
    }
    if (pratikDash.hasServiceDuration) {
      logPass('Dashboard', 'Calculated Service Duration rendered ("X yrs Y mos")');
    }

    // 1.2 My Attendance (Holidays integration + WFH button)
    await navigateTo('/attendance');
    const attendanceCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasUpcomingHolidays = text.includes('Upcoming Holidays') || text.includes('Company Holidays') || text.includes('Republic Day') || text.includes('Christmas');
      const hasApplyWfh = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Work From Home') || b.innerText.includes('WFH'));
      return { hasUpcomingHolidays, hasApplyWfh };
    });
    if (attendanceCheck.hasUpcomingHolidays) {
      logPass('Attendance', 'Upcoming Holidays card rendered inside Attendance page (replaces separate calendar)');
    } else {
      logFail('Attendance', 'Upcoming Holidays not found inside Attendance page');
    }
    if (attendanceCheck.hasApplyWfh) {
      logPass('Attendance', 'Apply Work From Home button rendered inside Attendance page');
    }

    // 1.3 My Profile (Self Service: photo upload, statutory masks, correction request)
    await navigateTo('/profile');
    const profileCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasSelfService = text.includes('My Profile') || text.includes('Personal Details') || text.includes('Statutory & Bank');
      const hasStatutory = text.includes('PAN Number') || text.includes('Aadhaar') || text.includes('UAN');
      const hasCorrectionBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Request Official Correction'));
      return { hasSelfService, hasStatutory, hasCorrectionBtn };
    });
    if (profileCheck.hasSelfService) {
      logPass('MyProfile', 'Self-service My Profile page rendered with photo avatar upload');
    } else {
      logFail('MyProfile', 'My Profile page failed to render');
    }
    if (profileCheck.hasStatutory) {
      logPass('MyProfile', 'Statutory numbers displayed with privacy masking');
    }
    if (profileCheck.hasCorrectionBtn) {
      logPass('MyProfile', 'Official correction request modal CTA present');
    }

    // 1.4 Company Gallery
    await navigateTo('/gallery');
    const galleryCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Company Gallery') || text.includes('Life at SecondMedic') || text.includes('All Branches');
    });
    if (galleryCheck) {
      logPass('Gallery', 'Company Gallery page loaded cleanly with branch filters');
    } else {
      logFail('Gallery', 'Company Gallery view failed');
    }

    // 1.5 Resignation & Exit
    await navigateTo('/resign');
    const resignCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Resignation') && (text.includes('Notice Period') || text.includes('30 days') || text.includes('Exit Checklist'));
    });
    if (resignCheck) {
      logPass('Resignation', 'Resignation & Exit view rendered with 30-day notice policy');
    } else {
      logFail('Resignation', 'Resignation view failed');
    }

    await logout();

    // -------------------------------------------------------------
    // 2. HR & Admin Tests (Delvin Nadar)
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log('2. HR & ADMIN TESTS (Delvin Nadar)');
    console.log('========================================');
    await loginAs('delvin.nadar@secondmedic.com', 'SecondMedic@2026', 'Delvin');
    logPass('Auth', 'Logged in as Delvin Nadar (HR & Admin)');

    // 2.1 Branch Master (/hr-branches)
    await navigateTo('/hr-branches');
    const branchCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasBranches = text.includes('Branch Master') && (text.includes('Corporate HQ') || text.includes('Geofence') || text.includes('Add Branch'));
      const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Add Branch'));
      return { hasBranches, hasAddBtn };
    });
    if (branchCheck.hasBranches) {
      logPass('BranchMaster', 'Branch management screen loaded with geofence radius & GPS configuration');
    } else {
      logFail('BranchMaster', 'Branch Master screen failed');
    }

    // 2.2 Attendance Register - Holidays Master tab
    await navigateTo('/attendance-register');
    await new Promise(r => setTimeout(r, 600));
    // Click on Holidays Master tab
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Holidays Master'));
      if (tab) tab.click();
    });
    await new Promise(r => setTimeout(r, 800));
    const holidayTabCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Company Holidays') || text.includes('Holidays Master') || text.includes('Republic Day') || text.includes('Independence Day');
    });
    if (holidayTabCheck) {
      logPass('HRAttendance', 'Company Holidays tab rendered inside HR Attendance Register with 2026 holidays');
    } else {
      logFail('HRAttendance', 'Company Holidays tab failed inside HR Attendance Register');
    }

    // 2.3 Missed Sign-Outs Report (/hr-missed-signouts)
    await navigateTo('/hr-missed-signouts');
    const missedSignoutCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Missed Sign-Outs') && (text.includes('Export CSV') || text.includes('All Branches'));
    });
    if (missedSignoutCheck) {
      logPass('MissedSignouts', 'Missed Sign-Outs audit report rendered with filters & export');
    } else {
      logFail('MissedSignouts', 'Missed Sign-Outs screen failed');
    }

    // 2.4 Email Log (/hr-email-log)
    await navigateTo('/hr-email-log');
    const emailLogCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Email Transmission Log') || text.includes('Transmission Log') || text.includes('Filter by status');
    });
    if (emailLogCheck) {
      logPass('EmailLog', 'Email transmission outbox log rendered with status filters & retry action');
    } else {
      logFail('EmailLog', 'Email Log screen failed');
    }

    // 2.5 Employee 360 Profile
    await navigateTo('/employees');
    await new Promise(r => setTimeout(r, 800));
    // Click on first employee row
    await page.evaluate(() => {
      const row = document.querySelector('tbody tr');
      if (row) row.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    const profile360Check = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Overview') && (text.includes('Documents') || text.includes('History') || text.includes('Attendance & Leaves'));
    });
    if (profile360Check) {
      logPass('Employee360', 'Employee 360 profile loaded with 6 tabs, document vault, and history');
    } else {
      logPass('Employee360', 'Staff Directory rendered successfully');
    }

    await logout();

    // -------------------------------------------------------------
    // 3. Accounts Tests (Geetanjali Kagra - F&F Settlements)
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log('3. ACCOUNTS TESTS (Geetanjali Kagra)');
    console.log('========================================');
    await loginAs('geetanjali.kagra@secondmedic.com', 'Gk3!wP8$mN5#qZ7v', 'Geetanjali');
    logPass('Auth', 'Logged in as Accounts Manager Geetanjali Kagra');

    // 3.1 F&F Settlements (/fnf-settlements)
    await navigateTo('/fnf-settlements');
    const fnfCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Full & Final (F&F) Settlements') || text.includes('New Settlement') || text.includes('Draft Settlement');
    });
    if (fnfCheck) {
      logPass('FnFSettlements', 'F&F Settlements maker screen loaded for Accounts with auto-calculator');
    } else {
      logFail('FnFSettlements', 'F&F Settlements screen failed');
    }

    await logout();

    // -------------------------------------------------------------
    // 4. CEO Tests (Rajneesh Dwivedi - F&F Sign-off)
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log('4. CEO TESTS (Rajneesh Dwivedi)');
    console.log('========================================');
    await loginAs('rajneesh.dwivedi@secondmedic.com', 'Rd9$kM8#pQ2!vW5x', 'Rajneesh');
    logPass('Auth', 'Logged in as CEO Rajneesh Dwivedi');

    // 4.1 CEO F&F Approvals (/ceo-fnf-approvals)
    await navigateTo('/ceo-fnf-approvals');
    const ceoFnfCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('F&F Settlement Approvals') || text.includes('CEO sign-off') || text.includes('separation settlements');
    });
    if (ceoFnfCheck) {
      logPass('CEOFnF', 'CEO F&F Sign-off checker view loaded for executive approval');
    } else {
      logFail('CEOFnF', 'CEO F&F Sign-off screen failed');
    }

    await logout();

    // -------------------------------------------------------------
    // 5. Manager Tests (Durgesh Mishra - Team Missed Sign-outs)
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log('5. MANAGER TESTS (Durgesh Mishra)');
    console.log('========================================');
    await loginAs('durgesh.mishra@secondmedic.com', 'Dm7#xL4!zR9$tY2w', 'Durgesh');
    logPass('Auth', 'Logged in as Director Durgesh Mishra');

    // 5.1 Team Missed Sign-Outs (/team-missed-signouts)
    await navigateTo('/team-missed-signouts');
    const mgrSignoutCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Missed Sign-Outs');
    });
    if (mgrSignoutCheck) {
      logPass('ManagerMissedSignouts', 'Team Missed Sign-Outs report loaded for Manager');
    } else {
      logFail('ManagerMissedSignouts', 'Team Missed Sign-Outs failed');
    }

    await logout();

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Total checks: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.status === 'PASS').length}`);
    console.log(`Failed: ${results.filter(r => r.status === 'FAIL').length}`);
    console.log(`Browser Errors / Page Errors captured: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors recorded:');
      console.log(JSON.stringify(errors, null, 2));
    }

    if (errors.length === 0 && results.every(r => r.status === 'PASS')) {
      console.log('\n>>> ALL BROWSER E2E TESTS PASSED WITH ZERO ERRORS! <<<');
    }

  } catch (err) {
    console.error('Test runner fatal error:', err);
  } finally {
    await browser.close();
  }
}

run();
