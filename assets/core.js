(function (root) {
  'use strict';
  const QUOTAS = Object.freeze({ 1: 10, 2: 20, 3: 20 });

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createExam(bank, previous = [], random = Math.random) {
    const unique = new Map(bank.map(q => [q.id, q]));
    if (unique.size !== bank.length) throw new Error('Ngân hàng có mã câu hỏi trùng nhau.');
    let chosen;
    for (let attempt = 0; attempt < 10; attempt++) {
      chosen = [];
      for (const [chapter, count] of Object.entries(QUOTAS)) {
        const pool = bank.filter(q => q.chapter === Number(chapter));
        if (pool.length < count) throw new Error(`Chương ${chapter} chưa đủ ${count} câu hỏi.`);
        chosen.push(...shuffle(pool, random).slice(0, count));
      }
      const signature = chosen.map(q => q.id).sort().join('|');
      if (signature !== [...previous].sort().join('|')) break;
    }
    return shuffle(chosen, random).map(q => q.id);
  }

  function grade(exam, answers, bank) {
    const lookup = new Map(bank.map(q => [q.id, q]));
    const items = exam.map(id => {
      const q = lookup.get(id);
      if (!q) throw new Error('Câu hỏi không còn trong ngân hàng.');
      const selected = answers[id] || null;
      const status = selected === null ? 'unanswered' : selected === q.answer ? 'correct' : 'incorrect';
      return { id, chapter: q.chapter, selected, correct: q.answer, status };
    });
    const correct = items.filter(i => i.status === 'correct').length;
    return {
      items, correct,
      incorrect: items.filter(i => i.status === 'incorrect').length,
      unanswered: items.filter(i => i.status === 'unanswered').length,
      score: Number((correct / exam.length * 10).toFixed(1)),
      byChapter: Object.keys(QUOTAS).map(Number).map(chapter => ({
        chapter, total: items.filter(i => i.chapter === chapter).length,
        correct: items.filter(i => i.chapter === chapter && i.status === 'correct').length
      }))
    };
  }

  function validSession(session, bank, version) {
    if (!session || session.version !== version || !['exam', 'result'].includes(session.phase)) return false;
    if (!Array.isArray(session.exam) || session.exam.length !== 50 || new Set(session.exam).size !== 50) return false;
    const lookup = new Map(bank.map(q => [q.id, q]));
    if (session.exam.some(id => !lookup.has(id))) return false;
    if (Object.entries(QUOTAS).some(([c, n]) => session.exam.filter(id => lookup.get(id).chapter === Number(c)).length !== n)) return false;
    if (!Number.isInteger(session.current) || session.current < 0 || session.current >= 50) return false;
    if (!session.answers || typeof session.answers !== 'object' || Array.isArray(session.answers)) return false;
    return Object.entries(session.answers).every(([id, label]) => session.exam.includes(id) && lookup.get(id).options.some(o => o.label === label));
  }

  const api = { QUOTAS, shuffle, createExam, grade, validSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
