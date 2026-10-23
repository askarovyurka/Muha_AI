// DOM, окна, события ввода

function applyLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      if (el.tagName === 'UL' || el.tagName === 'OL') el.innerHTML = translations[lang][key];
      else el.textContent = translations[lang][key];
    }
  });
  const tTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'btnThemeLight' : 'btnThemeDark';
  $('themeBtn').textContent = translations[lang][tTheme];
  switchInputMode(AppState.inputMode);
  
  if (typeof updatePlayerUI === 'function') updatePlayerUI();
  if ($('msg').className === 'win' && AppState.movesList.length > 0) {
      if ($('msg').textContent.includes('!') || $('msg').textContent.includes('готов')) {
          $('msg').textContent = `${translations[currentLang].msgRouteOk} ${AppState.movesList.length}.`;
      }
  }
}

$('langBtn').onclick = () => applyLang(currentLang === 'ru' ? 'en' : 'ru');

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('themeBtn').textContent = translations[currentLang][t === 'dark' ? 'btnThemeLight' : 'btnThemeDark'];
}
$('themeBtn').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
applyTheme('light');

const openDlg = id => $(id).classList.add('open');
const closeDlg = id => $(id).classList.remove('open');
$('settingsBtn').onclick = () => openDlg('settingsMenu');
$('closeSettings').onclick = () => closeDlg('settingsMenu');
$('rulesBtn').onclick = () => openDlg('rulesMenu');
$('closeRules').onclick = () => closeDlg('rulesMenu');
$('closeText').onclick = () => closeDlg('textMenu');

$('closeTests').onclick = () => closeDlg('testsMenu');

function switchInputMode(mode) {
  AppState.savedInputs[AppState.inputMode] = $('fio').value;
  AppState.inputMode = mode;
  $('tabText').classList.toggle('active', mode === 'text');
  $('tabNum').classList.toggle('active', mode === 'numbers');
  $('tabSym').classList.toggle('active', mode === 'symbols');
  $('numExtraBox').style.display = mode === 'numbers' ? 'block' : 'none';
  
  if (mode === 'text') $('inputLabel').textContent = translations[currentLang].lblInputText;
  else if (mode === 'numbers') $('inputLabel').textContent = translations[currentLang].lblInputNum;
  else $('inputLabel').textContent = translations[currentLang].lblInputSym;

  $('fio').value = AppState.savedInputs[mode] || '';
  delete $('fio').dataset.lastKey;
  updateSizeInfo();
}

$('tabText').onclick = () => switchInputMode('text');
$('tabNum').onclick = () => switchInputMode('numbers');
$('tabSym').onclick = () => switchInputMode('symbols');
$('textBtn').onclick = () => { switchInputMode('text'); openDlg('textMenu'); };
$('numBtn').onclick = () => { switchInputMode('numbers'); openDlg('textMenu'); };
$('symBtn').onclick = () => { switchInputMode('symbols'); openDlg('textMenu'); };

$('genRandomNumsBtn').onclick = () => {
  const sample = ['1', '2', '3', '4', '5', '6', '66', '121'];
  for (let i = sample.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }
  $('fio').value = sample.join(' ');
  updateSizeInfo();
};

function updateSizeInfo() {
  const raw = $('fio').value;
  const parsed = parseAndValidateInput(raw, AppState.inputMode);
  AppState.parsedTokens = parsed.tokens;
  const requiredArea = AppState.parsedTokens.length + 1;
  const t = translations[currentLang];

  const sel = $('matrixSelect');
  const cacheKey = `${AppState.inputMode}:${AppState.parsedTokens.length}`;

  if (AppState.parsedTokens.length >= 2 && cacheKey !== $('fio').dataset.lastKey) {
    sel.innerHTML = '';
    for (let r = MIN_SIZE; r <= MAX_SIZE; r++) {
      for (let c = MIN_SIZE; c <= MAX_SIZE; c++) {
        if (r * c >= requiredArea && r * c <= requiredArea + 14) sel.add(new Option(`${r} × ${c} (${r * c})`, `${r},${c}`));
      }
    }
    if (!sel.options.length) {
      for (let r = MIN_SIZE; r <= MAX_SIZE; r++) {
        for (let c = MIN_SIZE; c <= MAX_SIZE; c++) {
          if (r * c >= requiredArea) sel.add(new Option(`${r} × ${c}`, `${r},${c}`));
        }
      }
    }
    if (sel.options.length) {
      const [defR, defC] = sel.value.split(',');
      $('mRows').value = defR;
      $('mCols').value = defC;
    }
    $('fio').dataset.lastKey = cacheKey;
  }

  const r = parseInt($('mRows').value, 10) || 0;
  const c = parseInt($('mCols').value, 10) || 0;
  const area = r * c;

  let err = parsed.error;
  if (!err) {
    if (AppState.parsedTokens.length < 2 || AppState.parsedTokens.length > MAX_LEN) err = `Items: 2-${MAX_LEN} (now: ${AppState.parsedTokens.length})`;
    else if (r < MIN_SIZE || c < MIN_SIZE) err = t.errMinSize;
    else if (r > MAX_SIZE || c > MAX_SIZE) err = t.errMaxSize;
    else if (area < requiredArea) err = t.errArea + requiredArea;
  }

  let html = '';
  if (err) {
    html = `<b style="color:var(--warn)">❌ ${err}</b>`;
  } else {
    const samplePreview = AppState.parsedTokens.slice(0, 14).map(x => `[${x}]`).join(' ') + (AppState.parsedTokens.length > 14 ? ' ...' : '');
    html = `<div>${t.okItems} ${AppState.parsedTokens.length} | Area: ${area}</div>`;
    html += `<div style="margin-top:4px;color:var(--muted);font-size:12px">${samplePreview}</div>`;
    if (parsed.info) html += `<div style="margin-top:4px;color:var(--accent)">${parsed.info}</div>`;
  }

  $('preview').innerHTML = html;
  $('applyText').disabled = !!err;
  $('buildManualBtn').disabled = !!err;
}

$('fio').oninput = updateSizeInfo;
$('mRows').oninput = updateSizeInfo;
$('mCols').oninput = updateSizeInfo;
$('chkUpper').onchange = updateSizeInfo;
$('matrixSelect').onchange = e => {
  const parts = e.target.value.split(',');
  $('mRows').value = parts[0];
  $('mCols').value = parts[1];
  updateSizeInfo();
};



$('runTestsBtn').onclick = async () => {
  openDlg('testsMenu');
  $('testsLoader').style.display = 'block';
  $('testsLog').style.display = 'none';
  $('testsLog').textContent = '';

  try {
    const res = await fetch('/api/run-tests');
    const data = await res.json();
    
    $('testsLoader').style.display = 'none';
    $('testsLog').style.display = 'block';
    
    // Подсветка успешных и упавших тестов
    let formattedLog = data.output
      .replace(/PASSED/g, '<span style="color: #0f0; font-weight: bold;">PASSED</span>')
      .replace(/FAILED/g, '<span style="color: #f00; font-weight: bold;">FAILED</span>')
      .replace(/=+ (.*?) =+/g, '<b style="color: #fbbf24;">=== $1 ===</b>');
      
    $('testsLog').innerHTML = formattedLog;
  } catch (err) {
    $('testsLoader').style.display = 'none';
    $('testsLog').style.display = 'block';
    $('testsLog').innerHTML = `<span style="color: #f00;">Ошибка вызова тестов: ${err.message}</span>`;
  }
};

$('explainTestsBtn').onclick = () => {
  const el = $('testsExplanation');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
};