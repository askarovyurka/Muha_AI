// Игровая механика и плеер

function cloneMat(mat) { return mat.map(row => [...row]); }
function matricesEqual(a, b) {
  if (!a.length || !b.length || a.length !== b.length || a[0].length !== b[0].length) return false;
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[0].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function getBlankNeighbors(mat, r, c) {
  const res = [];
  if (!mat.length || mat[r][c] === '_') return res;
  const rows = mat.length, cols = mat[0].length;
  const dirs = [{dr:-1,dc:0,arrow:'↑'},{dr:1,dc:0,arrow:'↓'},{dr:0,dc:-1,arrow:'←'},{dr:0,dc:1,arrow:'→'}];
  for (const d of dirs) {
    const nr = r + d.dr, nc = c + d.dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && mat[nr][nc] === '_') {
      res.push({ r: nr, c: nc, dr: d.dr, dc: d.dc, arrow: d.arrow });
    }
  }
  return res;
}

function autoSelectInitialTile(mat) {
  if (!mat.length) { AppState.selectedCell = null; return; }
  if (AppState.selectedCell) {
    const [sr, sc] = AppState.selectedCell;
    if (sr >= 0 && sr < mat.length && sc >= 0 && sc < mat[0].length && mat[sr][sc] !== '_') return;
  }
  for (let r = 0; r < mat.length; r++) {
    for (let c = 0; c < mat[0].length; c++) {
      if (mat[r][c] !== '_' && getBlankNeighbors(mat, r, c).length > 0) {
        AppState.selectedCell = [r, c]; return;
      }
    }
  }
}

function initBoardFromCurrentConfig() {
  stopAutoPlay();
  updateSizeInfo();
  if ($('buildManualBtn').disabled) return;

  const rows = Math.max(MIN_SIZE, Math.min(MAX_SIZE, parseInt($('mRows').value, 10) || 5));
  const cols = Math.max(MIN_SIZE, Math.min(MAX_SIZE, parseInt($('mCols').value, 10) || 5));

  AppState.startMatrix = Array.from({ length: rows }, () => Array(cols).fill('_'));
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (idx < AppState.parsedTokens.length) AppState.startMatrix[r][c] = AppState.parsedTokens[idx++];
    }
  }

  AppState.currentMatrix = cloneMat(AppState.startMatrix);
  AppState.targetMatrix = buildTargetMatrixClient(AppState.parsedTokens, rows, cols);
  AppState.movesList = [];
  AppState.currentStep = 0;
  AppState.selectedCell = null;
  autoSelectInitialTile(AppState.currentMatrix);

  $('player').classList.add('active');
  $('msg').textContent = '';
  $('msg').className = '';
  renderStep();
}

$('buildManualBtn').onclick = () => { closeDlg('textMenu'); initBoardFromCurrentConfig(); };

function executeManualSlide(fromR, fromC, toR, toC) {
  stopAutoPlay();
  if (!AppState.currentMatrix.length || AppState.currentMatrix[fromR][fromC] === '_' || AppState.currentMatrix[toR][toC] !== '_') return false;
  if (Math.abs(fromR - toR) + Math.abs(fromC - toC) !== 1) return false;

  const ch = AppState.currentMatrix[fromR][fromC];
  if (AppState.currentStep < AppState.movesList.length) AppState.movesList = AppState.movesList.slice(0, AppState.currentStep);

  AppState.movesList.push({ step: AppState.movesList.length + 1, char: ch, from: [fromR, fromC], to: [toR, toC] });
  AppState.currentStep = AppState.movesList.length;
  AppState.selectedCell = [toR, toC];
  renderStep();

  const t = translations[currentLang];
  if (matricesEqual(AppState.currentMatrix, AppState.targetMatrix)) {
    $('msg').textContent = `${t.msgWin} ${AppState.movesList.length}!`;
    $('msg').className = 'win';
  } else {
    $('msg').textContent = `${t.txtMove} #${AppState.currentStep}: «${ch}» (${fromR}, ${fromC}) → (${toR}, ${toC})`;
    $('msg').className = '';
  }
  return true;
}

window.addEventListener('keydown', e => {
  if (document.querySelector('.overlay.open') || !AppState.currentMatrix.length) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

  const wasdMap = { KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
  if (wasdMap[e.code]) {
    e.preventDefault();
    autoSelectInitialTile(AppState.currentMatrix);
    if (!AppState.selectedCell) return;
    const [dr, dc] = wasdMap[e.code];
    let [r, c] = AppState.selectedCell;
    const rows = AppState.currentMatrix.length, cols = AppState.currentMatrix[0].length;
    for (let step = 1; step <= Math.max(rows, cols); step++) {
      const nr = r + dr * step, nc = c + dc * step;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
      if (AppState.currentMatrix[nr][nc] !== '_') {
        AppState.selectedCell = [nr, nc];
        renderMatrix(AppState.currentMatrix);
        return;
      }
    }
    return;
  }

  const arrowMap = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (arrowMap[e.code]) {
    e.preventDefault();
    autoSelectInitialTile(AppState.currentMatrix);
    if (!AppState.selectedCell) return;
    const [sr, sc] = AppState.selectedCell;
    const [dr, dc] = arrowMap[e.code];
    const tr = sr + dr, tc = sc + dc;
    if (tr >= 0 && tr < AppState.currentMatrix.length && tc >= 0 && tc < AppState.currentMatrix[0].length && AppState.currentMatrix[tr][tc] === '_') {
      executeManualSlide(sr, sc, tr, tc);
    }
  }
});

function renderMatrix(mat) {
  if (!mat || !mat.length) return;
  const rows = mat.length, cols = mat[0].length;
  const b = $('board');
  b.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  b.innerHTML = '';

  autoSelectInitialTile(mat);
  const targetHoles = new Map();
  if (AppState.selectedCell) {
    const [sr, sc] = AppState.selectedCell;
    if (sr >= 0 && sr < rows && sc >= 0 && sc < cols && mat[sr][sc] !== '_') {
      getBlankNeighbors(mat, sr, sc).forEach(nb => targetHoles.set(`${nb.r},${nb.c}`, nb.arrow));
    }
  }

  const baseFontSize = Math.max(13, Math.floor(260 / Math.max(rows, cols)));
  b.style.setProperty('--fs', baseFontSize + 'px');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = mat[r][c];
      const isHole = v === '_';
      const blankNbrs = isHole ? [] : getBlankNeighbors(mat, r, c);
      const isSelected = AppState.selectedCell && AppState.selectedCell[0] === r && AppState.selectedCell[1] === c;
      const holeArrow = targetHoles.get(`${r},${c}`);

      const div = document.createElement('div');
      div.className = 'cell' + (isHole ? ' hole' : '') + (blankNbrs.length > 0 ? ' movable' : '') + (isSelected ? ' selected' : '') + (holeArrow ? ' target-hole' : '');

      const spanVal = document.createElement('span');
      spanVal.textContent = v;
      if (v.length >= 3) spanVal.style.fontSize = '0.72em';
      else if (v.length === 2) spanVal.style.fontSize = '0.85em';
      div.appendChild(spanVal);

      if (holeArrow) {
        const badge = document.createElement('span');
        badge.className = 'dir-badge';
        badge.textContent = holeArrow;
        div.appendChild(badge);
      }

      if (!isHole) {
        div.onpointerdown = e => AppState.dragStartInfo = { r, c, x: e.clientX, y: e.clientY };
        div.onpointerup = e => {
          if (!AppState.dragStartInfo || AppState.dragStartInfo.r !== r || AppState.dragStartInfo.c !== c) { AppState.dragStartInfo = null; return; }
          const dx = e.clientX - AppState.dragStartInfo.x, dy = e.clientY - AppState.dragStartInfo.y;
          AppState.dragStartInfo = null;

          if (Math.hypot(dx, dy) >= 14) {
            let dr = 0, dc = 0;
            if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1; else dr = dy > 0 ? 1 : -1;
            const tr = r + dr, tc = c + dc;
            if (tr >= 0 && tr < rows && tc >= 0 && tc < cols && mat[tr][tc] === '_') executeManualSlide(r, c, tr, tc);
            return;
          }

          if (blankNbrs.length === 1 && AppState.selectedCell && AppState.selectedCell[0] === r && AppState.selectedCell[1] === c) {
            executeManualSlide(r, c, blankNbrs[0].r, blankNbrs[0].c);
          } else {
            AppState.selectedCell = [r, c];
            renderMatrix(AppState.currentMatrix);
          }
        };
      } else if (holeArrow && AppState.selectedCell) {
        div.onclick = () => executeManualSlide(AppState.selectedCell[0], AppState.selectedCell[1], r, c);
      }
      b.appendChild(div);
    }
  }
}

window.addEventListener('pointerup', e => {
  if (!AppState.dragStartInfo || !AppState.currentMatrix.length) return;
  const { r, c, x, y } = AppState.dragStartInfo;
  AppState.dragStartInfo = null;
  const dx = e.clientX - x, dy = e.clientY - y;
  if (Math.hypot(dx, dy) >= 18) {
    const rows = AppState.currentMatrix.length, cols = AppState.currentMatrix[0].length;
    let dr = 0, dc = 0;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1; else dr = dy > 0 ? 1 : -1;
    const tr = r + dr, tc = c + dc;
    if (tr >= 0 && tr < rows && tc >= 0 && tc < cols && AppState.currentMatrix[tr][tc] === '_') {
      executeManualSlide(r, c, tr, tc);
    }
  }
});

let abortController = null;
async function requestFlySolve(useCurrentBoard = false) {
  stopAutoPlay();
  updateSizeInfo();
  if (!useCurrentBoard && $('applyText').disabled) return;

  const rows = useCurrentBoard && AppState.currentMatrix.length ? AppState.currentMatrix.length : (parseInt($('mRows').value, 10) || 5);
  const cols = useCurrentBoard && AppState.currentMatrix.length ? AppState.currentMatrix[0].length : (parseInt($('mCols').value, 10) || 5);

  const payload = {
    fio: $('fio').value,
    rows: rows,
    cols: cols,
    uppercase: $('chkUpper').checked,
    items: AppState.parsedTokens,
    current_matrix: useCurrentBoard && AppState.currentMatrix.length ? AppState.currentMatrix : null,
    max_moves: parseInt($('maxMoves').value, 10) || 1000
  };

  abortController = new AbortController();
  const timeoutSec = Math.max(1, parseInt($('timeoutSec').value, 10) || 30);
  const timeoutId = setTimeout(() => abortController.abort(), timeoutSec * 1000);

  openDlg('modal');
  const t = translations[currentLang];

  try {
    const res = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortController.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP: ${res.status}`);
    }

    const data = await res.json();
    AppState.startMatrix = data.start_matrix;
    AppState.targetMatrix = data.target_matrix;
    AppState.movesList = data.moves;

    closeDlg('modal');
    if (data.is_solved) {
        $('msg').textContent = `${t.msgRouteOk} ${AppState.movesList.length}. ${t.txtSynapses} ${data.stats.synapses_used}.`;
        $('msg').className = 'win';
    } else if (AppState.movesList.length >= payload.max_moves) {
        $('msg').textContent = t.msgFail;
        $('msg').className = 'err';
    } else {
        $('msg').textContent = t.msgImp;
        $('msg').className = 'err';
    }

    resetPlayer();
    if (AppState.movesList.length > 0) startAutoPlay(); 
  } catch (err) {
    if (err.name === 'AbortError') $('msg').textContent = t.msgTimeout;
    else $('msg').textContent = 'Server Error: ' + err.message;
    $('msg').className = 'err';
    closeDlg('modal');
  }
}

$('textMenu').onsubmit = async e => { e.preventDefault(); closeDlg('textMenu'); await requestFlySolve(false); };
$('solveFlyBtn').onclick = async () => { await requestFlySolve(AppState.currentMatrix.length > 0); };
$('cancelFly').onclick = () => { if (abortController) abortController.abort(); closeDlg('modal'); };

function formatMove(m, index) {
  const tMove = translations[currentLang].txtMove;
  if (m && typeof m === 'object' && !Array.isArray(m) && m.from && m.to) {
    return `${tMove} ${index + 1}: '${m.char}' (${m.from[0]}, ${m.from[1]}) -> (${m.to[0]}, ${m.to[1]})`;
  }
  return `${tMove} ${index + 1}: (${m[0]}, ${m[1]})`;
}

function updatePlayerUI() {
  const isPlaying = AppState.autoPlayId !== null;
  const t = translations[currentLang];
  $('btnPlay').textContent = isPlaying ? t.btnPause : t.btnPlay;
  $('btnPrev').disabled = AppState.currentStep === 0 || isPlaying;
  $('btnStart').disabled = AppState.currentStep === 0 || isPlaying;
  $('btnNext').disabled = AppState.currentStep === AppState.movesList.length || isPlaying;
  $('btnEnd').disabled = AppState.currentStep === AppState.movesList.length || isPlaying;
  $('stepSlider').max = AppState.movesList.length;
  $('stepSlider').value = AppState.currentStep;
  $('stepCounter').textContent = `${t.stepCounter} ${AppState.currentStep} / ${AppState.movesList.length}`;
}

function renderStep() {
  if (!AppState.startMatrix.length) return;
  const mat = cloneMat(AppState.startMatrix);
  let logHtml = `<b>${translations[currentLang].txtStart}</b> ${translations[currentLang].txtInitMat}<br>`;

  for (let i = 0; i < AppState.currentStep; i++) {
    const move = AppState.movesList[i];
    if (move && typeof move === 'object' && !Array.isArray(move) && move.from && move.to) {
      const [r1, c1] = move.from, [r2, c2] = move.to;
      const temp = mat[r1][c1]; mat[r1][c1] = mat[r2][c2]; mat[r2][c2] = temp;
      AppState.selectedCell = [r2, c2]; 
    }
    logHtml += formatMove(move, i) + '<br>';
  }

  AppState.currentMatrix = mat;
  renderMatrix(AppState.currentMatrix);
  $('movesLog').innerHTML = logHtml;
  $('movesLog').scrollTop = $('movesLog').scrollHeight;
  updatePlayerUI();
}

function stopAutoPlay() { if (AppState.autoPlayId) { clearInterval(AppState.autoPlayId); AppState.autoPlayId = null; updatePlayerUI(); } }
function startAutoPlay() {
  stopAutoPlay();
  if (AppState.currentStep >= AppState.movesList.length) AppState.currentStep = 0;
  AppState.autoPlayId = setInterval(() => {
    if (AppState.currentStep < AppState.movesList.length) { AppState.currentStep++; renderStep(); } else stopAutoPlay();
  }, AppState.movesList.length > 80 ? 75 : 180);
  updatePlayerUI();
}

function resetPlayer() {
  $('player').classList.add('active');
  AppState.currentStep = 0;
  stopAutoPlay();
  renderStep();
}

$('btnNext').onclick = () => { stopAutoPlay(); if (AppState.currentStep < AppState.movesList.length) { AppState.currentStep++; renderStep(); } };
$('btnPrev').onclick = () => { stopAutoPlay(); if (AppState.currentStep > 0) { AppState.currentStep--; renderStep(); } };
$('btnStart').onclick = () => { stopAutoPlay(); AppState.currentStep = 0; renderStep(); };
$('btnEnd').onclick = () => { stopAutoPlay(); AppState.currentStep = AppState.movesList.length; renderStep(); };
$('stepSlider').oninput = e => { stopAutoPlay(); AppState.currentStep = parseInt(e.target.value, 10) || 0; renderStep(); };
$('btnPlay').onclick = () => { if (AppState.autoPlayId) stopAutoPlay(); else startAutoPlay(); };
$('btnReset').onclick = () => { stopAutoPlay(); initBoardFromCurrentConfig(); };

$('btnExport').onclick = () => {
  let txt = `Fly Puzzle Route / Отчет алгоритма «Муха»\n`;
  txt += `Mode: ${AppState.inputMode}\n`;
  txt += `Input: ${$('fio').value}\n`;
  txt += `Rows: ${$('mRows').value}\n`;
  txt += `Cols: ${$('mCols').value}\n`;
  txt += `Total moves: ${AppState.movesList.length}\n\n`;
  AppState.movesList.forEach((m, i) => { txt += formatMove(m, i) + '\n'; });
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fly_moves.txt';
  a.click();
};

$('btnImport').onclick = () => $('importFile').click();
$('importFile').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target.result;
    const lines = text.split('\n');
    let loadedMoves = [];
    let importedMode = null, importedInput = null, importedRows = null, importedCols = null;
    
    lines.forEach(line => {
      if (line.startsWith('Mode: ')) importedMode = line.substring(6).trim();
      else if (line.startsWith('Input: ')) importedInput = line.substring(7).trim();
      else if (line.startsWith('Rows: ')) importedRows = line.substring(6).trim();
      else if (line.startsWith('Cols: ')) importedCols = line.substring(6).trim();
      else {
        const match = line.match(/(?:Шаг|Move)\s+\d+:\s+'(.*?)'\s+\((\d+),\s*(\d+)\)\s*->\s*\((\d+),\s*(\d+)\)/);
        if (match) {
          loadedMoves.push({
            step: loadedMoves.length + 1,
            char: match[1],
            from: [parseInt(match[2], 10), parseInt(match[3], 10)],
            to: [parseInt(match[4], 10), parseInt(match[5], 10)]
          });
        }
      }
    });

    const t = translations[currentLang];
    if (importedMode && importedInput && importedRows && importedCols) {
      switchInputMode(importedMode);
      $('fio').value = importedInput;
      $('mRows').value = importedRows;
      $('mCols').value = importedCols;
      
      initBoardFromCurrentConfig();
      AppState.movesList = loadedMoves;
      AppState.currentStep = 0; 
      
      $('msg').textContent = `${t.msgImportOk} ${AppState.movesList.length}.`;
      $('msg').className = 'win';
      resetPlayer(); 
    } else {
      $('msg').textContent = t.msgImportErrFormat;
      $('msg').className = 'err';
    }
  };
  reader.readAsText(file);
  e.target.value = ''; 
};

// Запуск при загрузке
applyLang(currentLang);
initBoardFromCurrentConfig();