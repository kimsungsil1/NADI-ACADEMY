import { spawn, spawnSync } from 'child_process';

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const base = 'http://localhost:3000';

const request = async (path, options = {}, cookie) => {
  const res = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers||{}), ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'manual' });
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, body, cookie: setCookie };
};

const run = async () => {
  spawnSync('node', ['scripts/migrate.js'], { stdio: 'inherit' });
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });
  try {
    await wait(800);

    const learnerLogin = await request('/api/login', { method: 'POST', body: JSON.stringify({ email: 'learner@nadi.com', password: 'learner123' }) });
    if (learnerLogin.status !== 200) throw new Error('Learner login failed');
    const learnerCookie = learnerLogin.cookie;

    const guard = await request('/api/admin/users', {}, learnerCookie);
    if (guard.status === 200) throw new Error('Guard failed');

    const progress = await request('/api/progress', { method: 'POST', body: JSON.stringify({ lessonId: 'l1', percent: 50, lastSec: 10 }) }, learnerCookie);
    if (progress.status !== 200) throw new Error('Progress save failed');

    const assignment = await request('/api/assignments/a1/submit', { method: 'POST', body: JSON.stringify({ files: [{ name: 'demo.txt', data: Buffer.from('demo').toString('base64') }] }) }, learnerCookie);
    if (assignment.status !== 200) throw new Error('Submission failed');

    const adminLogin = await request('/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@nadi.com', password: 'admin123' }) });
    if (adminLogin.status !== 200) throw new Error('Admin login failed');
    const adminCookie = adminLogin.cookie;

    const adminUsers = await request('/api/admin/users', {}, adminCookie);
    if (adminUsers.status !== 200) throw new Error('Admin fetch failed');

    console.log('Smoke tests passed');
  } finally {
    server.kill('SIGINT');
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
