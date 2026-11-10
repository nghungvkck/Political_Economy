/* Study app: no account, no installation, works when opened locally too. */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const dialog = document.getElementById('dialog-root');
  const { questions: bank, version } = window.QUIZ_BANK;
  const core = window.QuizCore;
  const lookup = new Map(bank.map(q => [q.id, q]));
  const STORAGE = 'ktct-practice-v1';
  let state = { version, phase: 'home', exam: [], answers: {}, current: 0 };
  let filter = 'all';
  let dialogOpen = false;
  let storageAvailable = true;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arrow = '<span aria-hidden="true">→</span>';
  const chapterName = n => `Chương ${n}`;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (core.validSession(saved, bank, version)) state = saved;
  } catch (_) { storageAvailable = false; }

  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch (_) { storageAvailable = false; }
  }

  function goTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.getElementById('screen-title');
    if (heading) heading.focus({ preventScroll: true });
  }

  function startExam() {
    const previous = state.exam;
    state = { version, phase: 'exam', exam: core.createExam(bank, previous), answers: {}, current: 0 };
    filter = 'all';
    closeDialog();
    save();
    render();
    goTop();
  }

  function renderHome() {
    const counts = [1, 2, 3].map(n => bank.filter(q => q.chapter === n).length);
    app.innerHTML = `
      <section class="home-hero">
        <div class="hero-copy">
          <h1 id="screen-title" tabindex="-1">Luyện đề<br><span>Kinh tế chính trị</span></h1>
          <p class="hero-description">Mỗi đề gồm 50 câu hỏi từ 3 chương.<br>Nộp bài để xem điểm và đáp án từng câu.</p>
          <div class="hero-facts"><span><b>${bank.length}</b> câu trong ngân hàng</span><span class="fact-divider"></span><span><b>3</b> chương kiến thức</span></div>
        </div>
        <div class="exam-ticket">
          <div class="ticket-top"><span class="eyebrow">ĐỀ LUYỆN TẬP</span><span class="badge">Trắc nghiệm</span></div>
          <div class="ticket-number"><strong>50</strong><span>câu hỏi<br>mỗi lần làm đề</span></div>
          <p class="ticket-caption">Được chọn ngẫu nhiên từ ngân hàng câu hỏi.</p>
          <div class="distribution" aria-label="20% chương 1, 40% chương 2, 40% chương 3"><span></span><span></span><span></span></div>
          <div class="chapter-breakdown">
            <div><span class="chapter-dot chapter-1"></span><span>Chương 1</span><strong>10 câu</strong><small>20%</small></div>
            <div><span class="chapter-dot chapter-2"></span><span>Chương 2</span><strong>20 câu</strong><small>40%</small></div>
            <div><span class="chapter-dot chapter-3"></span><span>Chương 3</span><strong>20 câu</strong><small>40%</small></div>
          </div>
          <button class="button primary start-button" data-action="start">Bắt đầu làm đề ${arrow}</button>
          <p class="ticket-footnote">Không giới hạn thời gian.</p>
        </div>
      </section>
      <section class="how-section" aria-label="Cách làm bài">
        <div class="section-intro"><h2>Cách làm bài</h2></div>
        <div class="how-steps">
          <article><span class="step-number">01</span><h3>Chọn đáp án</h3><p>Mỗi câu chọn một đáp án. Bạn có thể quay lại đổi lựa chọn trước khi nộp.</p></article>
          <article><span class="step-number">02</span><h3>Nhận kết quả</h3><p>Xem điểm, câu đúng, câu sai và đáp án để biết mình cần ôn thêm phần nào.</p></article>
          <article><span class="step-number">03</span><h3>Thử một đề mới</h3><p>Bấm làm lại để nhận đề ngẫu nhiên mới, vẫn giữ đúng tỷ lệ ba chương.</p></article>
        </div>
      </section>
      <p class="bank-note">Chương 1 có ${counts[0]} câu nên mỗi đề dùng đủ ${counts[0]} câu và đảo thứ tự. Chương 2 và 3 được chọn ngẫu nhiên.</p>`;
  }

  function renderExam() {
    const q = lookup.get(state.exam[state.current]);
    const answered = Object.keys(state.answers).length;
    const selected = state.answers[q.id];
    app.innerHTML = `
      <div class="exam-heading"><div><h1 class="page-title">Đề luyện tập</h1></div><span class="exam-count"><b>50</b> câu hỏi · Một đáp án / câu</span></div>
      <div class="exam-layout">
        <section class="question-card" aria-label="Câu hỏi hiện tại">
          <div class="question-meta"><span class="chapter-tag chapter-tag-${q.chapter}">${chapterName(q.chapter)}</span><span>Câu <b>${state.current + 1}</b> / 50</span></div>
          <fieldset class="question-fieldset"><legend id="screen-title" tabindex="-1">${esc(q.text)}</legend>
          <div class="options">${q.options.map(o => `
            <label class="option ${selected === o.label ? 'selected' : ''}" for="option-${o.label}">
              <input type="radio" name="answer" id="option-${o.label}" value="${o.label}" data-question="${q.id}" ${selected === o.label ? 'checked' : ''}>
              <span class="option-letter" aria-hidden="true">${o.label}</span><span class="option-text">${esc(o.text)}</span><span class="option-check" aria-hidden="true">${selected === o.label ? '✓' : ''}</span>
            </label>`).join('')}</div></fieldset>
          <div class="question-footer"><button class="button secondary" data-action="previous" ${state.current === 0 ? 'disabled' : ''}><span aria-hidden="true">←</span> Câu trước</button><span class="selection-hint">${selected ? 'Đã lưu lựa chọn' : 'Chọn một đáp án ở trên'}</span>${state.current < 49 ? `<button class="button primary" data-action="next">Câu tiếp ${arrow}</button>` : '<button class="button primary" data-action="submit">Nộp bài ✓</button>'}</div>
        </section>
        <aside class="exam-sidebar" aria-label="Tiến độ làm bài">
          <div class="progress-heading"><h2>Tiến độ của bạn</h2><span><b>${answered}</b> / 50</span></div>
          <div class="progress-track" role="progressbar" aria-label="Số câu đã trả lời" aria-valuemin="0" aria-valuemax="50" aria-valuenow="${answered}"><span style="width:${answered * 2}%"></span></div>
          <p class="progress-caption">Còn ${50 - answered} câu chưa trả lời</p>
          <nav class="question-grid" aria-label="Chuyển đến câu hỏi">${state.exam.map((id, i) => `<button data-action="jump" data-index="${i}" class="question-number ${state.answers[id] ? 'answered' : ''} ${i === state.current ? 'current' : ''}" ${i === state.current ? 'aria-current="step"' : ''} aria-label="Câu ${i + 1}, ${state.answers[id] ? 'đã trả lời' : 'chưa trả lời'}">${i + 1}</button>`).join('')}</nav>
          <div class="grid-legend"><span><i class="legend-selected"></i>Đã trả lời</span><span><i class="legend-current"></i>Đang xem</span></div>
          <button class="button primary submit-button" data-action="submit">Nộp bài ${arrow}</button>
          <p class="sidebar-note">Bạn có thể xem lại và đổi đáp án bất cứ lúc nào trước khi nộp bài.</p>
        </aside>
      </div>
      <p class="save-note">${storageAvailable ? 'Bài làm được tự động lưu trên trình duyệt này.' : 'Trình duyệt không cho lưu bài. Hãy giữ trang mở cho đến khi nộp bài.'}</p>`;
  }

  function renderReviewQuestion(item, i) {
    const q = lookup.get(item.id);
    const statusLabels = { correct: 'Trả lời đúng', incorrect: 'Trả lời sai', unanswered: 'Chưa trả lời' };
    return `<article class="review-card" id="review-${i + 1}">
      <div class="review-meta"><span class="review-number">Câu ${i + 1} <span>· ${chapterName(q.chapter)}</span></span><span class="result-label ${item.status}">${item.status === 'correct' ? '✓' : item.status === 'incorrect' ? '✕' : '−'} ${statusLabels[item.status]}</span></div>
      <h3>${esc(q.text)}</h3><div class="review-options">${q.options.map(o => {
        const right = o.label === item.correct;
        const chosen = o.label === item.selected;
        return `<div class="review-option ${right ? 'right' : chosen ? 'wrong' : ''}"><span class="review-letter">${o.label}</span><span>${esc(o.text)}</span>${right ? '<small>✓ Đáp án đúng</small>' : chosen ? '<small>✕ Bạn đã chọn</small>' : ''}${right && chosen ? '<small class="chosen-note">Bạn đã chọn</small>' : ''}</div>`;
      }).join('')}</div>${item.status === 'unanswered' ? '<p class="unanswered-note">Bạn chưa chọn đáp án cho câu này.</p>' : ''}${q.explanation ? `<details class="explanation"><summary>Xem giải thích</summary><p>${esc(q.explanation)}</p></details>` : ''}</article>`;
  }

  function renderResult() {
    const result = core.grade(state.exam, state.answers, bank);
    const scoreText = result.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    const visible = result.items.map((item, i) => ({ item, i })).filter(({ item }) => filter === 'all' || item.status === filter);
    const filters = [['all', 'Tất cả', 50], ['incorrect', 'Câu sai', result.incorrect], ['unanswered', 'Chưa trả lời', result.unanswered], ['correct', 'Câu đúng', result.correct]];
    app.innerHTML = `
      <section class="result-heading"><div><h1 id="screen-title" class="page-title" tabindex="-1">Kết quả bài làm</h1></div><button class="button primary" data-action="restart">Làm lại · Đề mới ${arrow}</button></section>
      <section class="result-summary" aria-label="Điểm và thống kê bài làm"><div class="score-block"><span class="eyebrow">ĐIỂM CỦA BẠN</span><div><strong>${scoreText}</strong><span>/ 10</span></div><p>Mỗi câu đúng được 0,2 điểm</p></div><div class="score-stats"><div><span class="stat-icon correct">✓</span><strong>${result.correct}</strong><span>Câu đúng</span></div><div><span class="stat-icon incorrect">✕</span><strong>${result.incorrect}</strong><span>Câu sai</span></div><div><span class="stat-icon unanswered">−</span><strong>${result.unanswered}</strong><span>Chưa trả lời</span></div></div></section>
      <div class="chapter-results">${result.byChapter.map(c => `<div><span class="chapter-dot chapter-${c.chapter}"></span><span>${chapterName(c.chapter)}</span><b>${c.correct}<span> / ${c.total} đúng</span></b></div>`).join('')}</div>
      <section class="review-section" aria-label="Xem lại đáp án"><div class="review-heading"><div><h2>Chi tiết đáp án</h2><p>Đáp án đúng được đánh dấu xanh; lựa chọn sai của bạn được đánh dấu đỏ.</p></div><span class="review-total">${visible.length} câu</span></div><div class="review-filters" role="group" aria-label="Lọc câu hỏi">${filters.map(([key, label, count]) => `<button class="filter-button ${filter === key ? 'active' : ''}" aria-pressed="${filter === key}" data-action="filter" data-filter="${key}">${label} <span>${count}</span></button>`).join('')}</div><div id="review-list">${visible.length ? visible.map(({ item, i }) => renderReviewQuestion(item, i)).join('') : '<div class="empty-state"><span aria-hidden="true">✓</span><h3>Không có câu nào ở mục này</h3><p>Chọn mục khác để xem lại bài làm.</p></div>'}</div></section>
      <div class="result-bottom"><button class="button primary" data-action="restart">Làm lại với đề mới ${arrow}</button></div>`;
  }

  function render() {
    if (state.phase === 'exam') renderExam();
    else if (state.phase === 'result') renderResult();
    else renderHome();
  }

  function closeDialog() {
    dialogOpen = false;
    dialog.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function showSubmitDialog() {
    const answered = Object.keys(state.answers).length;
    dialogOpen = true;
    document.body.classList.add('modal-open');
    dialog.innerHTML = `<div class="dialog-backdrop"><section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><span class="dialog-icon" aria-hidden="true">✓</span><h2 id="dialog-title">Nộp bài và xem kết quả?</h2><p id="dialog-description">${answered === 50 ? 'Đã trả lời đủ 50 câu.' : `Bạn đã trả lời <b>${answered}/50 câu</b>. ${50 - answered} câu chưa trả lời sẽ được tính 0 điểm.`}</p><div class="dialog-actions"><button id="dialog-cancel" class="button secondary" data-action="cancel-submit">Quay lại làm bài</button><button id="dialog-confirm" class="button primary" data-action="confirm-submit">Nộp bài ${arrow}</button></div></section></div>`;
    document.getElementById('dialog-cancel').focus();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'start' || action === 'restart') return startExam();
    if (action === 'cancel-submit') {
      closeDialog();
      document.querySelector('[data-action="submit"]')?.focus();
      return;
    }
    if (action === 'confirm-submit' && state.phase === 'exam' && dialogOpen) {
      closeDialog();
      state.phase = 'result';
      save(); render(); goTop();
      return;
    }
    if (state.phase === 'exam') {
      if (action === 'submit') return showSubmitDialog();
      if (action === 'previous') state.current = Math.max(0, state.current - 1);
      else if (action === 'next') state.current = Math.min(49, state.current + 1);
      else if (action === 'jump') {
        const index = Number(button.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index > 49) return;
        state.current = index;
      } else return;
      save(); render(); goTop();
    } else if (state.phase === 'result' && action === 'filter') {
      if (!['all', 'correct', 'incorrect', 'unanswered'].includes(button.dataset.filter)) return;
      const scrollPosition = window.scrollY;
      filter = button.dataset.filter;
      render();
      window.scrollTo({ top: scrollPosition, behavior: 'instant' });
      document.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
    }
  }

  app.addEventListener('click', handleClick);
  dialog.addEventListener('click', handleClick);
  app.addEventListener('change', event => {
    const input = event.target;
    if (state.phase !== 'exam' || input.name !== 'answer') return;
    const q = lookup.get(state.exam[state.current]);
    if (input.dataset.question !== q.id || !q.options.some(o => o.label === input.value)) return;
    state.answers[q.id] = input.value;
    save(); renderExam();
    document.getElementById(`option-${input.value}`).focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (!dialogOpen) return;
    if (event.key === 'Escape') {
      closeDialog();
      document.querySelector('[data-action="submit"]')?.focus();
    } else if (event.key === 'Tab') {
      const first = document.getElementById('dialog-cancel');
      const last = document.getElementById('dialog-confirm');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  render();
})();
