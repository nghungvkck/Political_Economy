const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../assets/core.js');
const bankContext = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../assets/bank.js', 'utf8'), bankContext);
const { questions: bank, version } = JSON.parse(JSON.stringify(bankContext.window.QUIZ_BANK));

test('500 exams have exact 10/20/20 distribution and no duplicate questions', () => {
  let previous = [];
  const signatures = new Set();
  for (let i = 0; i < 500; i++) {
    const exam = core.createExam(bank, previous);
    assert.equal(exam.length, 50);
    assert.equal(new Set(exam).size, 50);
    for (const [chapter, count] of Object.entries(core.QUOTAS)) {
      assert.equal(exam.filter(id => bank.find(q => q.id === id).chapter === Number(chapter)).length, count);
    }
    const signature = [...exam].sort().join('|');
    assert(!signatures.has(signature));
    signatures.add(signature);
    previous = exam;
  }
});

test('only eligible single-answer questions are exported', () => {
  assert.equal(bank.length, 198);
  for (const q of bank) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.text)).size, 4);
    assert.equal(q.options.filter(o => o.label === q.answer).length, 1);
  }
});

test('grading handles correct, incorrect and unanswered questions without rounding errors', () => {
  const exam = core.createExam(bank);
  const answers = {};
  for (let i = 0; i < 20; i++) answers[exam[i]] = bank.find(q => q.id === exam[i]).answer;
  for (let i = 20; i < 35; i++) {
    const q = bank.find(q => q.id === exam[i]);
    answers[q.id] = q.options.find(o => o.label !== q.answer).label;
  }
  const result = core.grade(exam, answers, bank);
  assert.deepEqual([result.correct, result.incorrect, result.unanswered, result.score], [20, 15, 15, 4]);
  assert.equal(result.byChapter.reduce((sum, c) => sum + c.correct, 0), 20);
  const all = Object.fromEntries(exam.map(id => [id, bank.find(q => q.id === id).answer]));
  assert.equal(core.grade(exam, all, bank).score, 10);
  assert.equal(core.grade(exam, {}, bank).score, 0);
});

test('saved sessions accept valid answers and reject corrupt or stale data', () => {
  const session = { version, phase: 'exam', exam: core.createExam(bank), current: 0, answers: {} };
  assert(core.validSession(session, bank, version));
  assert(!core.validSession({ ...session, version: 'old' }, bank, version));
  assert(!core.validSession({ ...session, current: 50 }, bank, version));
  assert(!core.validSession({ ...session, exam: Array(50).fill(session.exam[0]) }, bank, version));
  assert(!core.validSession({ ...session, answers: { [session.exam[0]]: 'Z' } }, bank, version));
});

function appHarness(saved = null) {
  // Exercise rendered markup and delegated UI events without a browser dependency.
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, focus() {} });
    return elements.get(id);
  }
  let stored = saved ? JSON.stringify(saved) : null;
  const document = { getElementById: element, querySelector: () => ({ focus() {} }), addEventListener() {}, body: { classList: { add() {}, remove() {} } } };
  const window = { QUIZ_BANK: { questions: bank, version }, QuizCore: core, scrollTo() {}, scrollY: 0 };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../assets/app.js', 'utf8'), {
    window, document, localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } }
  });
  return {
    html: () => element('app').innerHTML,
    dialog: () => element('dialog-root').innerHTML,
    saved: () => JSON.parse(stored),
    click(action, extra = {}, modal = false) {
      element(modal ? 'dialog-root' : 'app').listeners.click({ target: { closest: () => ({ dataset: { action, ...extra }, disabled: false }) } });
    },
    answer(id, value) { element('app').listeners.change({ target: { name: 'answer', value, dataset: { question: id } } }); }
  };
}

test('UI flow: start, change an answer, navigate, submit, review and start a fresh exam', () => {
  const app = appHarness();
  assert.match(app.html(), /Bắt đầu làm đề/);
  app.click('start');
  const first = app.saved().exam[0];
  const q = bank.find(q => q.id === first);
  const wrong = q.options.find(o => o.label !== q.answer).label;
  app.answer(first, wrong);
  assert.equal(app.saved().answers[first], wrong);
  assert.match(app.html(), /feedback-incorrect/);
  assert.match(app.html(), /<strong>Sai\.<\/strong> Đáp án đúng:/);
  assert.match(app.html(), /selected answer-wrong/);
  app.answer(first, q.answer);
  assert.equal(app.saved().answers[first], q.answer);
  assert.match(app.html(), /feedback-correct/);
  assert.match(app.html(), /<strong>Đúng\.<\/strong>/);
  assert.doesNotMatch(app.html(), /<strong>Sai\.<\/strong>/);
  app.click('next');
  assert.equal(app.saved().current, 1);
  assert.doesNotMatch(app.html(), /<strong>(Đúng|Sai)\.<\/strong>/);
  const second = app.saved().exam[1];
  const q2 = bank.find(q => q.id === second);
  app.answer(second, q2.options.find(o => o.label !== q2.answer).label);
  app.click('jump', { index: '49' });
  assert.equal(app.saved().current, 49);
  app.click('submit');
  assert.match(app.dialog(), /48 câu chưa trả lời/);
  app.click('cancel-submit', {}, true);
  assert.equal(app.saved().phase, 'exam');
  app.click('submit');
  app.click('confirm-submit', {}, true);
  assert.equal(app.saved().phase, 'result');
  assert.match(app.html(), /Kết quả bài làm/);
  assert.equal((app.html().match(/class="review-card"/g) || []).length, 50);
  assert.match(app.html(), /<strong>0,2<\/strong><span>\/ 10<\/span>/);
  const previous = app.saved().exam;
  app.click('filter', { filter: 'incorrect' });
  assert.equal((app.html().match(/class="review-card"/g) || []).length, 1);
  app.click('restart');
  assert.equal(app.saved().phase, 'exam');
  assert.deepEqual(app.saved().answers, {});
  assert.notEqual([...app.saved().exam].sort().join('|'), [...previous].sort().join('|'));
});

test('reloading resumes an in-progress exam and preserves submitted results', () => {
  const app = appHarness();
  app.click('start');
  app.click('jump', { index: '12' });
  const resumed = appHarness(app.saved());
  assert.equal(resumed.saved().current, 12);
  assert.match(resumed.html(), /Câu <b>13<\/b> \/ 50/);
  resumed.click('submit');
  resumed.click('confirm-submit', {}, true);
  const reviewed = appHarness(resumed.saved());
  assert.match(reviewed.html(), /Kết quả bài làm/);
  assert.match(reviewed.html(), /50<\/strong><span>Chưa trả lời/);
});
