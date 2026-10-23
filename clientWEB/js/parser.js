// Парсинг и сортировка

function getSortRank(token) {
  if (/^\d+$/.test(token)) return [2, parseInt(token, 10), token.length, token];
  if (token.length === 1) {
    const ruUpIdx = RU_UPPER.indexOf(token);
    if (ruUpIdx !== -1) return [0, ruUpIdx, 0, token];
    const ruLowIdx = RU_LOWER.indexOf(token);
    if (ruLowIdx !== -1) return [0, ruLowIdx, 1, token];
    const enUpIdx = EN_UPPER.indexOf(token);
    if (enUpIdx !== -1) return [1, enUpIdx, 0, token];
    const enLowIdx = EN_LOWER.indexOf(token);
    if (enLowIdx !== -1) return [1, enLowIdx, 1, token];
  }
  return [3, token.charCodeAt(0) || 0, 0, token];
}

function sortTokensClient(tokens) {
  return [...tokens].sort((a, b) => {
    const ra = getSortRank(a);
    const rb = getSortRank(b);
    for (let i = 0; i < 3; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i];
    }
    return String(ra[3]).localeCompare(String(rb[3]));
  });
}

function parseAndValidateInput(raw, mode) {
  const useUpper = $('chkUpper').checked;
  const t = translations[currentLang];

  if (mode === 'text') {
    const badMatches = raw.match(/[^а-яА-ЯёЁa-zA-Z\s]/g);
    if (badMatches) return { tokens: [], error: t.errText + [...new Set(badMatches)].join(' '), info: '' };
    let clean = raw.replace(/\s+/g, '');
    if (useUpper) clean = clean.toUpperCase();
    return { tokens: Array.from(clean), error: '', info: '' };
  }

  const tokens = [];
  let hasSplitted = false;
  
  if (mode === 'numbers') {
    if (!raw.trim()) return { tokens: [], error: '', info: '' };
    for (let i = 0; i < raw.length; i++) {
      if (!/[0-9 ]/.test(raw[i])) return { tokens: [], error: t.errNum + raw[i], info: '' };
    }
  } else if (raw.includes('_')) {
    return { tokens: [], error: t.errText.replace(t.errText, "«_» is reserved / зарезервирован"), info: '' };
  }

  const parts = raw.trim().split(/\s+/).filter(Boolean);
  parts.forEach(part => {
    const matches = part.match(/\d+|./g) || [];
    matches.forEach(m => {
      if (/^\d+$/.test(m) && m.length >= 4) {
        tokens.push(...Array.from(m));
        hasSplitted = true;
      } else {
        let val = m;
        if (useUpper && /[а-яёa-z]/i.test(val)) val = val.toUpperCase();
        tokens.push(val);
      }
    });
  });

  const info = hasSplitted ? t.infoSplitted : '';
  return { tokens, error: '', info };
}

function buildTargetMatrixClient(tokens, rows, cols) {
  const target = Array.from({ length: rows }, () => Array(cols).fill(''));
  const blanksCount = rows * cols - tokens.length;
  let placed = 0;
  for (let c = cols - 1; c >= 0; c--) {
    for (let r = rows - 1; r >= 0; r--) {
      if (placed < blanksCount) { target[r][c] = '_'; placed++; }
    }
  }
  const sorted = sortTokensClient(tokens);
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (target[r][c] === '') target[r][c] = sorted[idx++];
    }
  }
  return target;
}