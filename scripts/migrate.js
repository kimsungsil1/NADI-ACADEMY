import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'data', 'db.json');

const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
};

const createUser = (id, name, email, role, branchId, password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id,
    name,
    email,
    role,
    branchId,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };
};

const seedData = {
  branches: [
    { id: 'b1', name: '서울본점' },
    { id: 'b2', name: '부산서면' }
  ],
  users: [
    createUser('u-admin', '관리자', 'admin@nadi.com', 'ADMIN', 'b1', 'admin123'),
    createUser('u-coach', '코치', 'coach@nadi.com', 'COACH', 'b1', 'coach123'),
    createUser('u-owner', '가맹점주', 'owner@nadi.com', 'OWNER', 'b2', 'owner123'),
    createUser('u-learner', '신입직원', 'learner@nadi.com', 'LEARNER', 'b2', 'learner123')
  ],
  courses: [
    { id: 'c1', title: 'Onboarding 7일 트랙', trackType: '7_DAY', level: 'L1', description: '첫 주 필수 교육' },
    { id: 'c2', title: 'Onboarding 30일 트랙', trackType: '30_DAY', level: 'L2', description: '1개월 집중 교육' }
  ],
  lessons: [
    { id: 'l1', courseId: 'c1', title: '기본 워밍업', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', transcript: '영상 스크립트 샘플', tags: ['유지력', '기본'], summary: '기본기를 다지는 레슨', chapterRequirement: 0.9 },
    { id: 'l2', courseId: 'c1', title: '클린업 심화', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', transcript: '클린업 과정', tags: ['클린업', '위생'], summary: '클린업 루틴', chapterRequirement: 0.9 },
    { id: 'l3', courseId: 'c2', title: '속도 향상', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', transcript: '속도 향상 팁', tags: ['속도', '숙련'], summary: '속도 업', chapterRequirement: 0.9 }
  ],
  chapters: [
    { id: 'ch1', lessonId: 'l1', title: '준비물 소개', startSec: 0 },
    { id: 'ch2', lessonId: 'l1', title: '데모', startSec: 20 },
    { id: 'ch3', lessonId: 'l2', title: '위생 확인', startSec: 0 },
    { id: 'ch4', lessonId: 'l2', title: '정리', startSec: 30 }
  ],
  quizzes: [
    { id: 'q1', lessonId: 'l1', passScore: 80 },
    { id: 'q2', lessonId: 'l2', passScore: 80 }
  ],
  questions: [
    { id: 'qs1', quizId: 'q1', type: 'MCQ', prompt: '준비물이 아닌 것은?', choices: ['테이프', '글루', '비누', '스파츌라'], answer: '비누' },
    { id: 'qs2', quizId: 'q1', type: 'TRUE_FALSE', prompt: '위생 장갑은 필수이다.', choices: ['True', 'False'], answer: 'True' },
    { id: 'qs3', quizId: 'q1', type: 'MCQ', prompt: '기본 워밍업 시간은?', choices: ['5분', '10분', '30분', '60분'], answer: '10분' },
    { id: 'qs4', quizId: 'q1', type: 'TRUE_FALSE', prompt: '기본기는 중요하지 않다.', choices: ['True', 'False'], answer: 'False' },
    { id: 'qs5', quizId: 'q1', type: 'MCQ', prompt: '태그에 포함된 단어는?', choices: ['속도', '유지력', '가격', '영업'], answer: '유지력' },
    { id: 'qs6', quizId: 'q2', type: 'MCQ', prompt: '클린업 루틴에서 중요한 것은?', choices: ['대칭', '속도', '가격', '광고'], answer: '대칭' },
    { id: 'qs7', quizId: 'q2', type: 'TRUE_FALSE', prompt: '손 위생은 선택사항이다.', choices: ['True', 'False'], answer: 'False' },
    { id: 'qs8', quizId: 'q2', type: 'MCQ', prompt: '적정 접착 시간은?', choices: ['1초', '5초', '10초', '30초'], answer: '5초' },
    { id: 'qs9', quizId: 'q2', type: 'TRUE_FALSE', prompt: '정리 단계는 생략 가능하다.', choices: ['True', 'False'], answer: 'False' },
    { id: 'qs10', quizId: 'q2', type: 'MCQ', prompt: '클린업 태그는?', choices: ['위생', '가격', '홍보', '재고'], answer: '위생' }
  ],
  assignments: [
    { id: 'a1', lessonId: 'l1', title: '기본 워밍업 촬영', angleGuide: ['정면', '좌측', '우측', '클로즈업'] },
    { id: 'a2', lessonId: 'l2', title: '클린업 촬영', angleGuide: ['정면', '위생포인트'] }
  ],
  submissions: [],
  progress: [],
  quizResults: [],
  rubricTemplates: [
    { id: 'rt1', assignmentId: 'a1', name: '기본 루브릭' },
    { id: 'rt2', assignmentId: 'a2', name: '클린업 루브릭' }
  ],
  rubricItems: [
    { id: 'ri1', templateId: 'rt1', name: '대칭', weight: 1, passScore: 3 },
    { id: 'ri2', templateId: 'rt1', name: '접착', weight: 1, passScore: 3 },
    { id: 'ri3', templateId: 'rt1', name: '속도', weight: 1, passScore: 3 },
    { id: 'ri4', templateId: 'rt1', name: '위생', weight: 1, passScore: 3 },
    { id: 'ri5', templateId: 'rt2', name: '클린업', weight: 1, passScore: 3 },
    { id: 'ri6', templateId: 'rt2', name: '정리', weight: 1, passScore: 3 }
  ],
  rubricScores: [],
  recommendations: [],
  sessions: [],
  sopDocuments: [
    { id: 's1', title: '기본 SOP v1', content: '위생 절차와 기본 안전 규정', version: '1.0', createdAt: new Date().toISOString() }
  ],
  sopAcknowledgements: []
};

const ensureDir = () => {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
};

const writeDb = (data) => {
  ensureDir();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

const seed = () => {
  writeDb(seedData);
  console.log('Database seeded at', dbPath);
};

seed();
