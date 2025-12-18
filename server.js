import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'local-secret';
const BASE_DIR = process.cwd();
const DB_PATH = path.join(BASE_DIR, 'data', 'db.json');

const ensureDb = () => {
  if (!fs.existsSync(DB_PATH)) {
    console.log('DB not found. Seeding...');
    spawnSync('node', ['scripts/migrate.js'], { stdio: 'inherit' });
  }
};

ensureDb();

const readDb = () => {
  const content = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(content);
};

const writeDb = (db) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

const parseBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = data ? JSON.parse(data) : {};
      resolve(parsed);
    } catch (e) {
      resolve({});
    }
  });
});

const sendJson = (res, status, payload, cookies = []) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Set-Cookie': cookies
  });
  res.end(JSON.stringify(payload));
};

const sendNotFound = (res) => sendJson(res, 404, { error: 'Not found' });

const hashPassword = (password, salt) => crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

const signToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
};

const verifyToken = (token) => {
  try {
    const [header, body, signature] = token.split('.');
    const check = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (check !== signature) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  } catch (e) {
    return null;
  }
};

const getUserFromRequest = (req) => {
  const cookie = req.headers.cookie || '';
  const tokenCookie = cookie.split(';').find((c) => c.trim().startsWith('token='));
  if (!tokenCookie) return null;
  const token = tokenCookie.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = readDb();
  const user = db.users.find((u) => u.id === payload.userId);
  const activeSession = db.sessions.find((s) => s.userId === payload.userId);
  if (!user || !activeSession || activeSession.id !== payload.sessionId) return null;
  return user;
};

const requireRole = (req, res, roles) => {
  const user = getUserFromRequest(req);
  if (!user || (roles.length && !roles.includes(user.role))) {
    sendJson(res, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
};

const serveStatic = (req, res) => {
  const parsed = url.parse(req.url);
  let pathname = parsed.pathname || '/';
  if (pathname === '/') pathname = '/academy/index.html';
  const filePath = path.join(BASE_DIR, 'public', pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
};

const generateRecommendation = (db, userId, lessonId, reason) => {
  db.recommendations.push({ id: `rec-${Date.now()}`, userId, lessonId, reason, createdAt: new Date().toISOString(), resolvedAt: null });
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  if (pathname.startsWith('/api/')) {
    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      const { email, password } = body;
      const db = readDb();
      const user = db.users.find((u) => u.email === email);
      if (!user) return sendJson(res, 401, { error: 'Invalid credentials' });
      const match = hashPassword(password, user.passwordSalt) === user.passwordHash;
      if (!match) return sendJson(res, 401, { error: 'Invalid credentials' });
      const sessionId = `sess-${Date.now()}`;
      db.sessions = db.sessions.filter((s) => s.userId !== user.id);
      db.sessions.push({ id: sessionId, userId: user.id, createdAt: new Date().toISOString() });
      writeDb(db);
      const token = signToken({ userId: user.id, sessionId });
      return sendJson(res, 200, { user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId } }, [`token=${token}; HttpOnly; Path=/`]);
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      const user = getUserFromRequest(req);
      if (user) {
        const db = readDb();
        db.sessions = db.sessions.filter((s) => s.userId !== user.id);
        writeDb(db);
      }
      return sendJson(res, 200, { ok: true }, ['token=; Max-Age=0; Path=/']);
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const user = getUserFromRequest(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthenticated' });
      return sendJson(res, 200, { user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId } });
    }

    if (req.method === 'GET' && pathname === '/api/courses') {
      const user = requireRole(req, res, ['ADMIN', 'COACH', 'LEARNER', 'OWNER']);
      if (!user) return;
      const db = readDb();
      const { q } = parsedUrl.query;
      let courses = db.courses.map((c) => ({ ...c, lessons: db.lessons.filter((l) => l.courseId === c.id) }));
      if (q) {
        const keyword = q.toLowerCase();
        courses = courses.filter((c) => c.title.toLowerCase().includes(keyword) || c.lessons.some((l) => l.tags.some((t) => t.toLowerCase().includes(keyword))));
      }
      return sendJson(res, 200, { courses });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/courses/')) {
      const user = requireRole(req, res, ['ADMIN', 'COACH', 'LEARNER', 'OWNER']);
      if (!user) return;
      const courseId = pathname.split('/').pop();
      const db = readDb();
      const course = db.courses.find((c) => c.id === courseId);
      if (!course) return sendNotFound(res);
      const lessons = db.lessons.filter((l) => l.courseId === courseId);
      return sendJson(res, 200, { course: { ...course, lessons } });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/lessons/')) {
      const user = requireRole(req, res, ['ADMIN', 'COACH', 'LEARNER', 'OWNER']);
      if (!user) return;
      const lessonId = pathname.split('/').pop();
      const db = readDb();
      const lesson = db.lessons.find((l) => l.id === lessonId);
      if (!lesson) return sendNotFound(res);
      const chapters = db.chapters.filter((c) => c.lessonId === lessonId);
      const quiz = db.quizzes.find((q) => q.lessonId === lessonId);
      const questions = quiz ? db.questions.filter((qs) => qs.quizId === quiz.id) : [];
      const assignment = db.assignments.find((a) => a.lessonId === lessonId);
      const progress = db.progress.find((p) => p.lessonId === lessonId && p.userId === user.id) || null;
      const recommendations = db.recommendations.filter((r) => r.userId === user.id && r.lessonId === lessonId && !r.resolvedAt);
      const sopDocs = db.sopDocuments;
      return sendJson(res, 200, { lesson, chapters, quiz, questions, assignment, progress, recommendations, sopDocs });
    }

    if (req.method === 'POST' && pathname === '/api/progress') {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const body = await parseBody(req);
      const { lessonId, percent, lastSec, completedAt } = body;
      const db = readDb();
      const existing = db.progress.find((p) => p.lessonId === lessonId && p.userId === user.id);
      if (existing) {
        existing.percent = percent;
        existing.lastSec = lastSec;
        existing.completedAt = completedAt || existing.completedAt;
      } else {
        db.progress.push({ id: `prog-${Date.now()}`, lessonId, userId: user.id, percent, lastSec, completedAt: completedAt || null });
      }
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname.startsWith('/api/quizzes/')) {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const quizId = pathname.split('/').pop();
      const body = await parseBody(req);
      const { answers } = body;
      const db = readDb();
      const quiz = db.quizzes.find((q) => q.id === quizId);
      if (!quiz) return sendNotFound(res);
      const questions = db.questions.filter((qs) => qs.quizId === quizId);
      let score = 0;
      questions.forEach((q) => {
        if ((answers || {})[q.id] === q.answer) score += 20;
      });
      const pass = score >= quiz.passScore;
      db.quizResults.push({ id: `qr-${Date.now()}`, quizId, userId: user.id, score, passed: pass, createdAt: new Date().toISOString() });
      if (!pass) generateRecommendation(db, user.id, quiz.lessonId, '퀴즈 점수 미달');
      const progress = db.progress.find((p) => p.lessonId === quiz.lessonId && p.userId === user.id);
      if (progress && progress.percent >= 90 && pass && !progress.completedAt) progress.completedAt = new Date().toISOString();
      writeDb(db);
      return sendJson(res, 200, { score, passed: pass });
    }

    if (req.method === 'POST' && pathname.startsWith('/api/assignments/')) {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const parts = pathname.split('/');
      const assignmentId = parts[3];
      const body = await parseBody(req);
      const { files } = body;
      const db = readDb();
      const assignment = db.assignments.find((a) => a.id === assignmentId);
      if (!assignment) return sendNotFound(res);
      const storedFiles = [];
      (files || []).forEach((f) => {
        const buffer = Buffer.from(f.data || '', 'base64');
        const safeName = `${Date.now()}-${f.name}`;
        const filePath = path.join(BASE_DIR, 'uploads', safeName);
        fs.writeFileSync(filePath, buffer);
        storedFiles.push({ name: f.name, path: `/uploads/${safeName}` });
      });
      db.submissions.push({ id: `sub-${Date.now()}`, assignmentId, userId: user.id, files: storedFiles, status: 'SUBMITTED', createdAt: new Date().toISOString() });
      writeDb(db);
      return sendJson(res, 200, { status: 'SUBMITTED' });
    }

    if (req.method === 'POST' && pathname.startsWith('/api/submissions/')) {
      const user = requireRole(req, res, ['COACH']);
      if (!user) return;
      const submissionId = pathname.split('/').pop();
      const body = await parseBody(req);
      const { scores, feedbackTemplate, feedbackText, status } = body;
      const db = readDb();
      const submission = db.submissions.find((s) => s.id === submissionId);
      if (!submission) return sendNotFound(res);
      const assignment = db.assignments.find((a) => a.id === submission.assignmentId);
      const template = db.rubricTemplates.find((r) => r.assignmentId === assignment.id);
      const items = template ? db.rubricItems.filter((i) => i.templateId === template.id) : [];
      const totalScore = items.reduce((acc, item) => acc + (Number(scores?.[item.id]) || 0) * item.weight, 0);
      db.rubricScores.push({ id: `rs-${Date.now()}`, submissionId, coachId: user.id, itemScores: scores || {}, totalScore, feedbackText: `${feedbackTemplate || ''} ${feedbackText || ''}`.trim(), createdAt: new Date().toISOString() });
      submission.status = status || 'IN_REVIEW';
      items.forEach((item) => {
        const value = Number(scores?.[item.id]) || 0;
        if (value < item.passScore) generateRecommendation(db, submission.userId, assignment.lessonId, `${item.name} 점수 미달`);
      });
      writeDb(db);
      return sendJson(res, 200, { ok: true, totalScore });
    }

    if (req.method === 'GET' && pathname === '/api/submissions') {
      const user = requireRole(req, res, ['COACH', 'ADMIN']);
      if (!user) return;
      const db = readDb();
      return sendJson(res, 200, { submissions: db.submissions });
    }

    if (req.method === 'GET' && pathname === '/api/recommendations') {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const db = readDb();
      const items = db.recommendations.filter((r) => r.userId === user.id && !r.resolvedAt);
      return sendJson(res, 200, { recommendations: items });
    }

    if (req.method === 'POST' && pathname === '/api/recommendations/resolve') {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const body = await parseBody(req);
      const { id } = body;
      const db = readDb();
      const target = db.recommendations.find((r) => r.id === id && r.userId === user.id);
      if (target) target.resolvedAt = new Date().toISOString();
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      const user = requireRole(req, res, ['LEARNER', 'OWNER', 'ADMIN']);
      if (!user) return;
      const db = readDb();
      if (user.role === 'LEARNER') {
        const myProgress = db.progress.filter((p) => p.userId === user.id);
        const submissions = db.submissions.filter((s) => s.userId === user.id);
        const myQuiz = db.quizResults.filter((q) => q.userId === user.id);
        const recs = db.recommendations.filter((r) => r.userId === user.id && !r.resolvedAt);
        return sendJson(res, 200, { progress: myProgress, submissions, quizResults: myQuiz, recommendations: recs });
      }
      if (user.role === 'OWNER') {
        const branchUsers = db.users.filter((u) => u.branchId === user.branchId && u.role === 'LEARNER');
        const userIds = branchUsers.map((u) => u.id);
        const branchProgress = db.progress.filter((p) => userIds.includes(p.userId));
        const branchQuiz = db.quizResults.filter((q) => userIds.includes(q.userId));
        const recs = db.recommendations.filter((r) => userIds.includes(r.userId) && !r.resolvedAt);
        const submissions = db.submissions.filter((s) => userIds.includes(s.userId));
        return sendJson(res, 200, {
          learnerCount: branchUsers.length,
          completionRate: branchProgress.length ? Math.round((branchProgress.filter((p) => p.completedAt).length / branchProgress.length) * 100) : 0,
          avgQuiz: branchQuiz.length ? Math.round(branchQuiz.reduce((a, b) => a + b.score, 0) / branchQuiz.length) : 0,
          pendingSubmissions: submissions.filter((s) => s.status !== 'APPROVED').length,
          recommendations: recs
        });
      }
      if (user.role === 'ADMIN') {
        const branchStats = db.branches.map((b) => {
          const branchUsers = db.users.filter((u) => u.branchId === b.id && u.role === 'LEARNER');
          const userIds = branchUsers.map((u) => u.id);
          const branchProgress = db.progress.filter((p) => userIds.includes(p.userId));
          const branchQuiz = db.quizResults.filter((q) => userIds.includes(q.userId));
          const recs = db.recommendations.filter((r) => userIds.includes(r.userId) && !r.resolvedAt);
          const submissions = db.submissions.filter((s) => userIds.includes(s.userId));
          return {
            branch: b,
            completionRate: branchProgress.length ? Math.round((branchProgress.filter((p) => p.completedAt).length / branchProgress.length) * 100) : 0,
            avgQuiz: branchQuiz.length ? Math.round(branchQuiz.reduce((a, b) => a + b.score, 0) / branchQuiz.length) : 0,
            pendingSubmissions: submissions.filter((s) => s.status !== 'APPROVED').length,
            recommendations: recs.length
          };
        });
        return sendJson(res, 200, { branchStats, users: db.users });
      }
    }

    if (req.method === 'GET' && pathname === '/api/admin/users') {
      const user = requireRole(req, res, ['ADMIN']);
      if (!user) return;
      const db = readDb();
      return sendJson(res, 200, { users: db.users, branches: db.branches });
    }

    if (req.method === 'POST' && pathname === '/api/admin/sop/ack') {
      const user = requireRole(req, res, ['LEARNER']);
      if (!user) return;
      const body = await parseBody(req);
      const { sopId } = body;
      const db = readDb();
      db.sopAcknowledgements.push({ id: `ack-${Date.now()}`, sopId, userId: user.id, completedAt: new Date().toISOString() });
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    return sendNotFound(res);
  }

  if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(BASE_DIR, pathname.slice(1));
    if (fs.existsSync(filePath)) {
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  if (serveStatic(req, res)) return;
  sendNotFound(res);
});

server.listen(PORT, () => {
  console.log(`Nadi Academy server running on http://localhost:${PORT}`);
});
