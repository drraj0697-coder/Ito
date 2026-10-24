(() => {
  'use strict';

  const configuredApi = String(window.MEDQ_CONFIG?.apiBase || '').trim().replace(/\/+$/, '');
  const API = configuredApi;
  const $ = selector => document.querySelector(selector);
  const screen = $('#screen');
  const notice = $('#notice');
  const backButton = $('#back-button');
  const connection = $('#connection');
  const navButtons = [...document.querySelectorAll('[data-nav]')];

  const state = {
    view: 'home',
    history: [],
    bootstrap: null,
    selectedSubject: null,
    selectedTopic: null,
    topics: null,
    mixedConfig: false,
    practiceCount: 10,
    practice: null,
    dataSaver: localStorage.getItem('medq-data-saver') === 'true',
    searchResults: [],
    searchQuery: '',
    remoteProgress: null,
    dataBytes: Number(localStorage.getItem('medq-api-bytes') || 0),
    deviceId: getDeviceId(),
  };

  function getDeviceId() {
    let id = localStorage.getItem('medq-device-id');
    if (!id) {
      const generated = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replaceAll('-', '') : `${Date.now()}${Math.random()}`.replace('.', '');
      id = `medq_${generated}`.slice(0, 80);
      localStorage.setItem('medq-device-id', id);
    }
    return id;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function plainText(value) {
    const doc = new DOMParser().parseFromString(String(value ?? ''), 'text/html');
    return (doc.body.textContent || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function bytesText(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function questionCount(count) {
    return `${Number(count || 0).toLocaleString()} Q${Number(count || 0) === 1 ? '' : 's'}`;
  }

  function recordData(bytes) {
    state.dataBytes += Math.max(0, bytes || 0);
    localStorage.setItem('medq-api-bytes', String(state.dataBytes));
  }

  function showNotice(message, type = '') {
    notice.textContent = message;
    notice.className = `notice ${type}`;
    notice.classList.remove('hidden');
    clearTimeout(showNotice.timeout);
    showNotice.timeout = setTimeout(() => notice.classList.add('hidden'), 5200);
  }

  async function api(path, options = {}) {
    if (!API || API.includes('YOUR-API-HOST')) throw new Error('This GitHub Pages app is not connected to its API yet. Set MEDQ_API_BASE_URL in the repository Actions variables, then deploy Pages again.');
    if (!navigator.onLine) throw new Error('You are offline. Reconnect to load live question data.');
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const raw = await response.text();
    recordData(new TextEncoder().encode(raw).byteLength);
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new Error('The server returned an invalid response.'); }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function setConnection() {
    const online = navigator.onLine;
    connection.classList.toggle('offline', !online);
    connection.innerHTML = `<span class="status-dot"></span><span>${online ? 'Online' : 'Offline'}</span>`;
    if (!online) showNotice('You are offline. The installed shell is available, but live questions and search need a connection.', 'error');
  }

  function setNavActive() {
    const active = ['subject', 'configure', 'practice'].includes(state.view) ? 'subjects' : state.view;
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.nav === active));
  }

  function updateBack() {
    backButton.classList.toggle('hidden', state.history.length === 0);
  }

  function setView(view, data = {}, pushHistory = true) {
    if (pushHistory && state.view !== view) state.history.push({ view: state.view, data: snapshot() });
    state.view = view;
    Object.assign(state, data);
    render();
  }

  function snapshot() {
    return {
      selectedSubject: state.selectedSubject,
      selectedTopic: state.selectedTopic,
      topics: state.topics,
      mixedConfig: state.mixedConfig,
      practiceCount: state.practiceCount,
      practice: state.practice,
      searchResults: state.searchResults,
      searchQuery: state.searchQuery,
      remoteProgress: state.remoteProgress,
    };
  }

  function goBack() {
    const previous = state.history.pop();
    if (!previous) return;
    state.view = previous.view;
    Object.assign(state, previous.data);
    render();
  }

  function setMainNav(view) {
    state.history = [];
    state.view = view;
    if (view === 'subjects') state.selectedSubject = null;
    render();
  }

  function loading(label = 'Loading live content…') {
    screen.innerHTML = `<section class="hero"><p class="eyebrow">Online-first PWA</p><h1>${escapeHTML(label)}</h1><p class="lead">Only the current screen is requested from the server.</p></section><div class="grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  }

  function noData(title, detail) {
    return `<div class="card empty"><span class="empty-icon">◌</span><h3>${escapeHTML(title)}</h3><p class="lead">${escapeHTML(detail)}</p></div>`;
  }

  function render() {
    updateBack();
    setNavActive();
    if (state.view === 'home') renderHome();
    else if (state.view === 'subjects') renderSubjects();
    else if (state.view === 'subject') renderSubject();
    else if (state.view === 'configure') renderConfigure();
    else if (state.view === 'practice') renderPractice();
    else if (state.view === 'search') renderSearch();
    else if (state.view === 'profile') renderProfile();
    screen.focus({ preventScroll: true });
  }

  function renderHome() {
    const subjects = (state.bootstrap?.subjects || []).filter(subject => subject.question_count > 0);
    const preview = subjects.slice(0, 6);
    screen.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Practice, not downloads</p>
        <h1>Your live medical question bank.</h1>
        <p class="lead">Choose a subject, start a small online session, and keep the app light on your iPad.</p>
        <div class="pills"><span class="pill">${state.bootstrap ? questionCount(state.bootstrap.question_total) : 'Connecting…'}</span><span class="pill">No full database download</span></div>
      </section>
      <div class="button-row"><button class="primary" data-action="start-any">Start 10-question session</button><button class="secondary" data-action="open-data">Data use</button></div>
      <div class="section-row"><h2>Subjects</h2><button class="text-button" data-action="open-subjects">See all</button></div>
      ${preview.length ? `<div class="grid subject-grid">${preview.map(subjectCard).join('')}</div>` : noData('No questions are ready yet', 'Run the taxonomy and MedMCQA ingestion steps on the server, then reload this app.')}
      <div class="info-strip"><span>◉</span><div><b>Online-first by design.</b> The installed PWA caches its interface only. Questions, explanations, search and progress sync are requested from your server as you use them.</div></div>`;
  }

  function subjectCard(subject) {
    return `<button class="subject-card" data-action="open-subject" data-id="${escapeHTML(subject.id)}"><span class="subject-symbol">${escapeHTML(subject.name.charAt(0))}</span><span class="badge">Live</span><h3>${escapeHTML(subject.name)}</h3><small>${questionCount(subject.question_count)}</small></button>`;
  }

  function renderSubjects() {
    const subjects = state.bootstrap?.subjects || [];
    screen.innerHTML = `
      <p class="eyebrow">Question bank</p><h1>Choose a subject</h1><p class="lead">Question counts are live totals from your database.</p>
      <div class="search-wrap"><span class="search-icon">⌕</span><input id="subject-filter" class="search-input" type="search" autocomplete="off" placeholder="Filter subjects" aria-label="Filter subjects"></div>
      <div id="subject-list" class="grid subject-grid">${subjects.length ? subjects.map(subjectCard).join('') : '<div class="skeleton"></div><div class="skeleton"></div>'}</div>`;
    const filter = $('#subject-filter');
    filter?.addEventListener('input', () => {
      const needle = filter.value.trim().toLowerCase();
      const filtered = subjects.filter(subject => subject.name.toLowerCase().includes(needle));
      $('#subject-list').innerHTML = filtered.length ? filtered.map(subjectCard).join('') : noData('No matching subject', 'Try a different spelling.');
    });
  }

  async function openSubject(id) {
    const subject = state.bootstrap?.subjects.find(row => row.id === id);
    if (!subject) return showNotice('That subject is no longer available.', 'error');
    state.selectedSubject = subject;
    state.selectedTopic = null;
    setView('subject', { topics: null });
    loading(`Loading ${subject.name}`);
    try {
      const data = await api(`/subjects/${encodeURIComponent(id)}/topics`);
      state.topics = data.topics || [];
      renderSubject();
    } catch (error) {
      renderSubject();
      showNotice(error.message, 'error');
    }
  }

  function renderSubject() {
    const subject = state.selectedSubject;
    if (!subject) return setMainNav('subjects');
    if (!state.topics) return loading(`Loading ${subject.name}`);
    const populated = state.topics.filter(topic => topic.question_count > 0);
    screen.innerHTML = `
      <p class="eyebrow">${escapeHTML(subject.name)}</p><h1>Pick a topic</h1><p class="lead">Select one topic for a focused session, or practice the whole subject.</p>
      <div class="card practice-config"><h3>All of ${escapeHTML(subject.name)}</h3><p class="meta">${questionCount(subject.question_count)} available across this subject</p><button class="primary wide" style="margin-top:14px" data-action="configure" data-scope="subject">Practice this subject</button></div>
      <div class="section-row"><h2>Topics</h2><span class="meta">${populated.length} available</span></div>
      ${populated.length ? `<div class="card">${populated.map(topic => `<button class="topic-card" data-action="configure" data-scope="topic" data-id="${escapeHTML(topic.id)}"><span><h3>${escapeHTML(topic.name)}</h3><span class="meta">${questionCount(topic.question_count)}</span></span><span class="arrow">›</span></button>`).join('')}</div>` : noData('No populated topics yet', 'This subject has no question-to-topic mappings in the current database.')}`;
  }

  function renderConfigure() {
    const subject = state.selectedSubject;
    const topic = state.selectedTopic;
    const isMixed = state.mixedConfig;
    if (!subject && !isMixed) return setMainNav('subjects');
    const title = isMixed ? 'Mixed practice' : (topic ? topic.name : subject.name);
    const available = isMixed ? (state.bootstrap?.question_total || 0) : (topic ? topic.question_count : subject.question_count);
    const counts = [10, 20, 50];
    const effective = state.dataSaver ? 10 : state.practiceCount;
    screen.innerHTML = `
      <p class="eyebrow">New session</p><h1>${escapeHTML(title)}</h1><p class="lead">Questions are fetched once for this session. Nothing from the full bank is downloaded.</p>
      <section class="card practice-config">
        <div class="info-strip"><span>◌</span><div><b>${questionCount(available)} available.</b> The batch includes text and explanations only. Any future image/video content should be streamed on tap.</div></div>
        <label class="field-label">Session length</label>
        <div class="count-row">${counts.map(count => `<button class="count-button ${effective === count ? 'selected' : ''}" data-action="set-count" data-count="${count}" ${state.dataSaver && count !== 10 ? 'disabled title="Data Saver uses 10 questions"' : ''}>${count}</button>`).join('')}</div>
        ${state.dataSaver ? '<p class="small" style="margin:12px 0 0">Data Saver is on: sessions are limited to 10 questions.</p>' : '<p class="small" style="margin:12px 0 0">Typical text-only transfer: about 0.5–3 MB per 100 questions, depending on explanation length.</p>'}
        <button class="primary wide" style="margin-top:17px" data-action="start-session">Load ${effective} live questions</button>
      </section>`;
  }

  async function startPractice() {
    const subject = state.selectedSubject;
    const topic = state.selectedTopic;
    const count = state.dataSaver ? 10 : state.practiceCount;
    loading('Loading your live session');
    const query = new URLSearchParams({ count: String(count) });
    if (subject?.id) query.set('subject_id', subject.id);
    if (topic?.id) query.set('topic_id', topic.id);
    try {
      const data = await api(`/questions?${query.toString()}`);
      if (!data.questions?.length) {
        state.practice = null;
        renderConfigure();
        return showNotice('No questions matched this selection. Choose another subject or topic.', 'error');
      }
      state.practice = { questions: data.questions, index: 0, results: {}, sourceLabel: topic?.name || subject?.name || 'Mixed practice' };
      state.view = 'practice';
      render();
    } catch (error) {
      renderConfigure();
      showNotice(error.message, 'error');
    }
  }

  function renderPractice() {
    const practice = state.practice;
    if (!practice?.questions?.length) return state.selectedSubject ? setView('configure', {}, false) : setMainNav('home');
    if (practice.index >= practice.questions.length) return renderCompletion();
    const question = practice.questions[practice.index];
    const selected = practice.results[question.id];
    const correctIndex = Number(String(question.answer || '').replace('option_', '')) - 1;
    const percent = ((practice.index) / practice.questions.length) * 100;
    const optionNames = ['A', 'B', 'C', 'D'];
    screen.innerHTML = `
      <div class="practice-header"><span class="progress-label">${escapeHTML(practice.sourceLabel || 'Practice')}</span><span class="progress-label">${practice.index + 1} / ${practice.questions.length}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <section class="card question-card">
        <div class="question-number">Question ${practice.index + 1}</div>
        <div class="question-text">${escapeHTML(plainText(question.question))}</div>
        <div class="options">${question.options.map((option, index) => {
          const optionId = `option_${index + 1}`;
          const optionClass = selected ? (index === correctIndex ? 'correct' : selected.selected === optionId ? 'selected-wrong' : '') : '';
          return `<button class="option ${optionClass}" ${selected || question.revealing ? 'disabled' : ''} data-action="answer" data-index="${index}"><span class="option-key">${optionNames[index]}</span><span>${escapeHTML(plainText(option))}</span></button>`;
        }).join('')}</div>
        ${selected ? answerPanel(question, selected, correctIndex) : (question.revealing ? '<p class="small" style="margin:15px 0 0">Checking your answer securely with the live server…</p>' : '<p class="small" style="margin:15px 0 0">Choose an answer to reveal the explanation and sync this attempt.</p>')}
      </section>
      ${selected ? `<div class="runner-actions"><button class="secondary" data-action="end-session">End session</button><button class="primary" data-action="next-question">${practice.index + 1 === practice.questions.length ? 'Finish session' : 'Next question →'}</button></div>` : ''}`;
  }

  function answerPanel(question, selected, correctIndex) {
    const isCorrect = selected.correct;
    const correctOption = question.options[correctIndex] || '';
    const explanation = plainText(question.explanation) || 'No explanation was supplied for this question.';
    return `<div class="answer-panel ${isCorrect ? '' : 'wrong'}"><div class="answer-title">${isCorrect ? 'Correct — well done.' : `Correct answer: ${escapeHTML(String.fromCharCode(65 + correctIndex))}`}</div>${!isCorrect ? `<p class="small" style="margin:7px 0 0"><b>${escapeHTML(plainText(correctOption))}</b></p>` : ''}<p class="explanation">${escapeHTML(explanation)}</p></div>`;
  }

  async function answerQuestion(index) {
    const practice = state.practice;
    const question = practice?.questions?.[practice.index];
    if (!question || practice.results[question.id] || question.revealing) return;
    const selected = `option_${index + 1}`;
    // Initial batches intentionally exclude keys and explanations. This extra,
    // small request makes review live-only and reduces unused explanation data.
    question.revealing = true;
    renderPractice();
    try {
      const reveal = await api(`/questions/${encodeURIComponent(question.id)}/reveal`);
      question.answer = reveal.answer;
      question.explanation = reveal.explanation;
      question.revealing = false;
      const correct = selected === question.answer;
      practice.results[question.id] = { selected, correct };
      renderPractice();
      await api('/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: state.deviceId, question_id: question.id, selected }) });
    } catch (error) {
      question.revealing = false;
      renderPractice();
      showNotice(`Could not check this answer: ${error.message}`, 'error');
    }
  }

  function nextQuestion() {
    if (!state.practice) return;
    state.practice.index += 1;
    renderPractice();
  }

  function renderCompletion() {
    const practice = state.practice;
    const results = Object.values(practice.results || {});
    const right = results.filter(row => row.correct).length;
    const total = practice.questions.length;
    const score = total ? Math.round((right / total) * 100) : 0;
    screen.innerHTML = `
      <p class="eyebrow">Session complete</p><h1>Nice work.</h1><p class="lead">Your answered items were sent to the server under this installation’s anonymous device identifier.</p>
      <section class="card score-card"><div class="score-ring" style="--score:${score}%"><strong>${score}%</strong></div><h2>${right} of ${total} correct</h2><p class="meta">${escapeHTML(practice.sourceLabel || 'Practice')}</p></section>
      <div class="button-row" style="margin-top:14px"><button class="secondary" data-action="end-session">Choose another</button><button class="primary" data-action="repeat-session">Practice again</button></div>`;
  }

  function renderSearch() {
    screen.innerHTML = `
      <p class="eyebrow">Live search</p><h1>Find a question</h1><p class="lead">Search queries are sent to your server. The app does not keep a complete local search index.</p>
      <div class="search-wrap"><span class="search-icon">⌕</span><input id="live-search" class="search-input" type="search" autocomplete="off" value="${escapeHTML(state.searchQuery)}" placeholder="e.g. atrial fibrillation" aria-label="Search questions"></div>
      <div id="search-results">${state.searchQuery ? renderSearchResults() : noData('Start typing to search', 'Search uses the server’s Mongo text index when it is available.')}</div>`;
    const input = $('#live-search');
    input.addEventListener('input', () => debounceSearch(input.value));
    setTimeout(() => input.focus(), 0);
  }

  function renderSearchResults() {
    if (!state.searchResults.length) return noData('No results found', 'Try a shorter phrase or check that the server text index has been created.');
    return `<div class="card">${state.searchResults.map(row => `<button class="action-card" data-action="open-question" data-id="${escapeHTML(row.id)}"><span><h3>${escapeHTML(plainText(row.question).slice(0, 150))}${plainText(row.question).length > 150 ? '…' : ''}</h3><p class="meta">Load question and explanation</p></span><span class="arrow">›</span></button>`).join('')}</div>`;
  }

  function debounceSearch(value) {
    clearTimeout(debounceSearch.timer);
    state.searchQuery = value;
    debounceSearch.timer = setTimeout(async () => {
      const target = $('#search-results');
      if (!state.searchQuery.trim()) {
        state.searchResults = [];
        if (target) target.innerHTML = noData('Start typing to search', 'Search uses the server’s Mongo text index when it is available.');
        return;
      }
      if (target) target.innerHTML = '<div class="skeleton"></div>';
      try {
        const data = await api(`/search?q=${encodeURIComponent(state.searchQuery)}&limit=15`);
        state.searchResults = data.results || [];
        if (target) target.innerHTML = renderSearchResults();
      } catch (error) {
        if (target) target.innerHTML = noData('Search is unavailable', error.message);
      }
    }, 280);
  }

  async function openQuestion(id) {
    loading('Loading question');
    try {
      const data = await api(`/questions/${encodeURIComponent(id)}`);
      state.practice = { questions: [data.question], index: 0, results: {}, sourceLabel: 'Search result' };
      setView('practice', {}, false);
    } catch (error) {
      setView('search', {}, false);
      showNotice(error.message, 'error');
    }
  }

  async function loadProgress() {
    state.remoteProgress = 'loading';
    renderProfile();
    try {
      const data = await api(`/progress?device_id=${encodeURIComponent(state.deviceId)}`);
      state.remoteProgress = data;
    } catch (error) {
      state.remoteProgress = { error: error.message };
    }
    renderProfile();
  }

  function renderProfile() {
    const progress = state.remoteProgress;
    const correct = progress?.attempts?.filter(row => row.correct).length || 0;
    const attempted = progress?.count || 0;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    const progressDisplay = progress === 'loading' ? '<div class="skeleton"></div>' : progress?.error ? `<div class="info-strip"><span>!</span><div>${escapeHTML(progress.error)}</div></div>` : `
      <div class="grid two-col"><div class="card data-card"><span class="meta">Synced attempts</span><div class="data-number">${attempted}</div></div><div class="card data-card"><span class="meta">Accuracy</span><div class="data-number">${accuracy}%</div></div></div>`;
    screen.innerHTML = `
      <p class="eyebrow">Your device</p><h1>Profile & data</h1><p class="lead">Progress sync is attached to this browser installation. Add account authentication before relying on it for multi-device access.</p>
      <div class="section-row"><h2>Progress</h2><button class="text-button" data-action="refresh-progress">Refresh</button></div>${progressDisplay}
      <div class="section-row"><h2>Data controls</h2></div>
      <section class="card data-card">
        <div class="toggle-row"><div><h3>Data Saver</h3><p class="small">Limits sessions to 10 text questions and avoids prefetching.</p></div><button aria-label="Toggle Data Saver" class="toggle ${state.dataSaver ? 'on' : ''}" data-action="toggle-saver"></button></div>
        <div class="toggle-row"><div><h3>Known API payload</h3><p class="small">${bytesText(state.dataBytes)} received by this app since its last reset. This is an estimate of decoded JSON only; iOS system totals, app installation, and streamed media are not included.</p></div><button class="secondary" data-action="reset-meter">Reset</button></div>
        <div class="divider"></div><p class="small"><b>Cache policy:</b> only the small PWA shell is cached for launch speed. Live questions, explanations, search results, and API progress are not cached by the service worker.</p>
      </section>
      <div class="info-strip"><span>◌</span><div><b>Expected use:</b> a text-only 100-question session is commonly around 0.5–3 MB, depending on explanation length. Images and video should be served on demand and can consume much more.</div></div>`;
  }

  async function beginAnyPractice() {
    state.selectedSubject = null;
    state.selectedTopic = null;
    state.mixedConfig = true;
    state.practiceCount = 10;
    setView('configure');
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action], [data-nav]');
    if (!target) return;
    const { action, nav, id, scope, count, index } = target.dataset;
    if (nav) return setMainNav(nav);
    if (action === 'open-subject') return openSubject(id);
    if (action === 'open-subjects') return setMainNav('subjects');
    if (action === 'start-any') return beginAnyPractice();
    if (action === 'open-data') return setMainNav('profile');
    if (action === 'configure') {
      state.mixedConfig = false;
      state.selectedTopic = scope === 'topic' ? state.topics?.find(topic => topic.id === id) || null : null;
      return setView('configure');
    }
    if (action === 'set-count') { state.practiceCount = state.dataSaver ? 10 : Number(count); return render(); }
    if (action === 'start-session') return startPractice();
    if (action === 'answer') return answerQuestion(Number(index));
    if (action === 'next-question') return nextQuestion();
    if (action === 'end-session') { state.practice = null; return state.selectedSubject ? setView('subject') : setMainNav('home'); }
    if (action === 'repeat-session') { state.practice = null; return startPractice(); }
    if (action === 'open-question') return openQuestion(id);
    if (action === 'refresh-progress') return loadProgress();
    if (action === 'toggle-saver') { state.dataSaver = !state.dataSaver; localStorage.setItem('medq-data-saver', String(state.dataSaver)); return renderProfile(); }
    if (action === 'reset-meter') { state.dataBytes = 0; localStorage.setItem('medq-api-bytes', '0'); return renderProfile(); }
  });

  backButton.addEventListener('click', goBack);
  window.addEventListener('online', setConnection);
  window.addEventListener('offline', setConnection);

  async function boot() {
    setConnection();
    loading('Connecting to your study server');
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    try {
      state.bootstrap = await api('/bootstrap');
      render();
    } catch (error) {
      screen.innerHTML = `<section class="hero"><p class="eyebrow">Connection needed</p><h1>Your question bank is online.</h1><p class="lead">${escapeHTML(error.message)}</p></section>${noData('Cannot load the live catalog', 'Check the server, MongoDB connection, and internet access, then reload.')}`;
      showNotice(error.message, 'error');
    }
  }

  boot();
})();
