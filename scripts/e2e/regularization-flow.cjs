// End-to-end check of the time-update (regularization) flow against a mocked Supabase API.
// No real database is touched: every /rest/v1 and /auth/v1 call is answered from the in-memory `db` below.
// Usage:
//   VITE_SUPABASE_URL=http://mock.supabase.local VITE_SUPABASE_ANON_KEY=mockkey npx vite --port 5179 --strictPort
//   node scripts/e2e/regularization-flow.cjs http://localhost:5179   (screenshots land in scripts/e2e/screenshots/)
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:5173';
const SHOTS = require('path').join(__dirname, 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });

const today = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// A past weekday in the current month (fallback: today).
let pastDay = new Date(today);
for (let i = 1; i <= 10; i++) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
  if (d.getMonth() === today.getMonth() && d.getDay() !== 0) { pastDay = d; break; }
}
const PAST = iso(pastDay);

const db = {
  employees: [
    { id: 2, emp_code: 'SM002', full_name: 'Tara Lead', official_email: 'lead@secondmedic.com', manager_id: null, status: 'ACTIVE', auth_user_id: 'u-lead', department: { name: 'Clinical' } },
    { id: 3, emp_code: 'SM003', full_name: 'Nina Nurse', official_email: 'nurse@secondmedic.com', manager_id: 2, status: 'ACTIVE', auth_user_id: 'u-nurse', department: { name: 'Clinical' } }
  ],
  employee_roles: [ { employee_id: 2, role: 'MANAGER' }, { employee_id: 2, role: 'EMPLOYEE' }, { employee_id: 3, role: 'EMPLOYEE' } ],
  attendance_regularizations: [],
  attendance_records: [
    { id: 50, employee_id: 3, work_date: PAST, punch_in: `${PAST}T04:10:00Z`, punch_out: null, worked_hours: null, status: 'PRESENT', is_regularized: false, shift_id: 1 }
  ]
};
let nextId = 900;
let currentUser = null;
const writes = [];

function parseFilters(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    out.push([k, v]);
  }
  return out;
}
function matches(row, [k, v]) {
  if (k === 'or') return true; // reporting-line OR filters: allow (mock has one team)
  const m = v.match(/^(eq|neq|is|in|gte|lte|ilike)\.(.*)$/);
  if (!m) return true;
  const [, op, raw] = m;
  const val = row[k];
  const s = val == null ? null : String(val);
  switch (op) {
    case 'eq': return s === raw;
    case 'neq': return s !== raw;
    case 'is': return raw === 'null' ? val == null : String(val) === raw;
    case 'in': return raw.replace(/[()]/g, '').split(',').map(x => x.replace(/"/g, '')).includes(s);
    case 'gte': return s != null && s >= raw;
    case 'lte': return s != null && s <= raw;
    case 'ilike': return s != null && s.toLowerCase() === raw.toLowerCase();
  }
  return true;
}
const empById = id => db.employees.find(e => e.id === id);
function decorate(table, row) {
  if (table === 'attendance_regularizations') {
    const e = empById(row.employee_id); const a = empById(row.approver_id);
    return { ...row, employee: e && { emp_code: e.emp_code, full_name: e.full_name, manager_id: e.manager_id }, approver: a ? { full_name: a.full_name } : null };
  }
  return row;
}

async function handleRest(route) {
  const req = route.request();
  const url = new URL(req.url());
  const table = url.pathname.split('/rest/v1/')[1];
  const method = req.method();
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  const filters = parseFilters(url);
  const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

  if (table === 'employees' && method === 'GET' && url.searchParams.get('or')?.includes('auth_user_id')) {
    const me = db.employees.find(e => e.auth_user_id === currentUser);
    return json(wantsObject ? me : [me]);
  }
  let rows = (db[table] || []).filter(r => filters.every(f => matches(r, f))).map(r => decorate(table, r));

  if (method === 'HEAD') {
    return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` }, body: '' });
  }
  if (method === 'GET') {
    if (wantsObject) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
    return json(rows, 200, { 'content-range': `0-${rows.length}/${rows.length}` });
  }
  if (method === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    const items = (Array.isArray(body) ? body : [body]).map(b => ({ id: nextId++, ...b }));
    db[table] = db[table] || [];
    db[table].push(...items);
    writes.push({ table, method, body });
    const out = items.map(r => decorate(table, r));
    return json(wantsObject ? out[0] : out, 201);
  }
  if (method === 'PATCH') {
    const body = JSON.parse(req.postData() || '{}');
    writes.push({ table, method, body, filters });
    const target = (db[table] || []).filter(r => filters.every(f => matches(r, f)));
    target.forEach(r => Object.assign(r, body));
    const out = target.map(r => decorate(table, r));
    if (wantsObject) return out.length ? json(out[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
    return json(out);
  }
  return json([]);
}

async function handleAuth(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname.endsWith('/token')) {
    const { email } = JSON.parse(req.postData() || '{}');
    const emp = db.employees.find(e => e.official_email === email);
    if (!emp) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
    currentUser = emp.auth_user_id;
    const user = { id: emp.auth_user_id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'mock.' + emp.id, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user }) });
  }
  if (url.pathname.endsWith('/logout')) { currentUser = null; return route.fulfill({ status: 204, body: '' }); }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
}

async function login(page, email) {
  await page.goto(BASE + '/');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('input[type=password]'), null, { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const results = [];
  const check = (name, ok, extra = '') => { results.push(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); if (!ok) process.exitCode = 1; };

  for (const step of ['employee', 'lead']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${step}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${step}] pageerror ${e.message}`));
    await page.route('**/rest/v1/**', handleRest);
    await page.route('**/auth/v1/**', handleAuth);
    await page.route('**/storage/v1/**', r => r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));

    if (step === 'employee') {
      await login(page, 'nurse@secondmedic.com');
      await page.goto(BASE + '/my-attendance');
      await page.click(`[data-testid="day-${PAST}"]`);
      await page.getByRole('button', { name: 'Request Regularization' }).click();
      check('time inputs are 24h pickers prefilled from the punch', (await page.inputValue('#reg-in-time')).match(/^\d\d:\d\d$/) != null, await page.inputValue('#reg-in-time'));
      await page.fill('#reg-in-time', '09:30');
      await page.fill('#reg-out-time', '08:00');
      await page.fill('#reg-reason', 'Biometric down, forgot to punch out');
      await page.getByRole('button', { name: 'Submit Request' }).click();
      await page.waitForTimeout(400);
      check('out-before-in is blocked client-side', !writes.some(w => w.table === 'attendance_regularizations' && w.method === 'POST'));
      await page.fill('#reg-out-time', '18:00');
      await page.getByRole('button', { name: 'Submit Request' }).click();
      await page.waitForTimeout(800);
      const post = writes.find(w => w.table === 'attendance_regularizations' && w.method === 'POST');
      check('request stored with 24h times', post && post.body.requested_in === '09:30' && post.body.requested_out === '18:00', JSON.stringify(post?.body));
      check('request routed to reporting manager', post?.body.approver_id === 2);
      await page.click(`[data-testid="day-${PAST}"]`);
      await page.waitForSelector('[data-testid="my-reg-pending"]');
      check('employee sees pending status and cannot resubmit', await page.getByRole('button', { name: 'Request Regularization' }).isDisabled());
      await page.screenshot({ path: `${SHOTS}/e2e-1-employee-pending.png` });
      db.attendance_regularizations.push({ id: 777, employee_id: 3, work_date: PAST, requested_in: '10:00', requested_out: '12:00', reason: 'Second test row', status: 'PENDING', approver_id: 2 });
    } else {
      await login(page, 'lead@secondmedic.com');
      await page.goto(BASE + '/team-regularization');
      const first = db.attendance_regularizations[0];
      await page.waitForSelector(`[data-testid="reg-card-${first.id}"]`);
      const card = page.locator(`[data-testid="reg-card-${first.id}"]`);
      check('team lead sees the request with payroll effect', (await card.innerText()).includes('8.5h · Full day'), (await card.innerText()).replace(/\s+/g, ' ').slice(0, 160));
      await page.screenshot({ path: `${SHOTS}/e2e-2-lead-queue.png`, fullPage: true });

      await page.click('[data-testid="reg-reject-777"]');
      await page.getByRole('button', { name: 'Confirm Rejection' }).click();
      await page.waitForTimeout(300);
      check('reject without remarks is blocked', !writes.some(w => w.method === 'PATCH'));
      await page.fill('#reg-reject-remarks', 'Only 2 hours requested — apply half-day leave instead');
      await page.screenshot({ path: `${SHOTS}/e2e-3-reject-modal.png` });
      await page.getByRole('button', { name: 'Confirm Rejection' }).click();
      await page.waitForTimeout(800);
      const rej = writes.find(w => w.method === 'PATCH' && w.body.status === 'REJECTED');
      check('reject saves remarks and only touches PENDING rows', rej && rej.body.approver_remarks && rej.filters.some(f => f[0] === 'status' && f[1] === 'eq.PENDING'), JSON.stringify(rej));

      await page.click(`[data-testid="reg-approve-${first.id}"]`);
      await page.waitForTimeout(800);
      const appr = writes.find(w => w.method === 'PATCH' && w.body.status === 'APPROVED');
      check('approve records approver', appr?.body.approver_id === 2, JSON.stringify(appr?.body));
      check('client no longer writes attendance itself (DB trigger does)', !writes.some(w => w.table === 'attendance_records'));
      await page.waitForSelector('text=No Pending Regularizations');
      check('queue empties after actions', true);
      await page.screenshot({ path: `${SHOTS}/e2e-4-lead-empty.png` });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(results.join('\n'));
  const realErrors = errors.filter(e => !/Failed to load resource/.test(e));
  console.log(realErrors.length ? 'CONSOLE ERRORS:\n' + realErrors.join('\n') : 'no console errors');
  if (realErrors.length) process.exitCode = 1;
})();
