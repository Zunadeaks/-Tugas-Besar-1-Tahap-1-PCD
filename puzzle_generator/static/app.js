'use strict';

const $ = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[data-tab]')];
let original = '';
let result = null;
let tab = 'play';
let game = null;
let busy = false;
let reading = false;
let selectionVersion = 0;
let dragDepth = 0;

function syncControls() {
  $('generate').disabled = busy || reading || !original;
  $('download').disabled = busy || !result;
  $('file').disabled = busy;
  $('drop').setAttribute('aria-disabled', String(busy));
  $('canvas').setAttribute('aria-busy', String(busy || reading));
  $('generate').setAttribute('aria-busy', String(busy));
}

function invalidateResult() {
  game?.dispose();
  game = null;
  result = null;
  $('count').textContent = 'Belum ada hasil';
  $('dimensions').textContent = '\u2014';
  syncControls();
}

function showImage(src, alt) {
  const img = new Image();
  img.className = 'result-img';
  img.alt = alt;
  img.src = src;
  $('canvas').replaceChildren(img);
}

function render() {
  for (const button of tabs) {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  game?.cancelDrag();
  $('canvas').classList.toggle('playing', tab === 'play' && Boolean(game));
  if (tab === 'play' && game) {
    $('canvas').replaceChildren(game.root);
  } else if (tab === 'original' && original) {
    showImage(original, 'Gambar asli');
  } else if (tab === 'frame' && result) {
    showImage('data:image/png;base64,' + result.frame, 'Bingkai puzzle');
  } else if (tab === 'pieces' && result) {
    const grid = document.createElement('div');
    grid.className = 'pieces';
    for (const piece of result.pieces) {
      const link = document.createElement('a');
      link.className = 'piece';
      link.href = 'data:image/png;base64,' + piece.data;
      link.download = piece.name;
      link.setAttribute('aria-label', 'Unduh ' + piece.name);
      const img = new Image();
      img.src = link.href;
      img.alt = piece.name;
      link.append(img, document.createTextNode(piece.name + ' \u2193'));
      grid.append(link);
    }
    $('canvas').replaceChildren(grid);
  } else {
    $('canvas').replaceChildren($('empty-state').content.cloneNode(true));
  }
}

function choose(file) {
  if (!file || busy) return;
  if (!/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)) {
    $('status').textContent = 'Pilih gambar PNG, JPG, WebP, BMP, atau TIFF.';
    return;
  }
  if (!file.size || file.size > 15000000) {
    $('status').textContent = 'Gambar harus berisi data dan maksimal 15 MB.';
    return;
  }
  const version = ++selectionVersion;
  original = '';
  reading = true;
  invalidateResult();
  $('filename').textContent = file.name;
  $('status').textContent = 'Membaca gambar\u2026';
  tab = 'original';
  render();
  const reader = new FileReader();
  reader.onload = () => {
    if (version !== selectionVersion) return;
    original = reader.result;
    reading = false;
    render();
    syncControls();
    $('status').textContent = 'Gambar siap diproses.';
    // TIFF can be processed by Pillow even when the browser cannot preview it.
    const img = $('canvas').querySelector('img');
    if (img) img.onerror = () => {
      if (version !== selectionVersion || tab !== 'original') return;
      const message = document.createElement('p');
      message.className = 'text-sm text-slate-500 text-center';
      message.textContent = 'Pratinjau format ini tidak tersedia. Klik Buat puzzle.';
      $('canvas').replaceChildren(message);
    };
  };
  reader.onerror = reader.onabort = () => {
    if (version !== selectionVersion) return;
    reading = false;
    original = '';
    $('status').textContent = 'Gambar gagal dibaca. Pilih ulang gambar.';
    syncControls();
  };
  reader.readAsDataURL(file);
}

$('file').onchange = event => {
  choose(event.target.files[0]);
  event.target.value = '';
};
$('drop').ondragenter = event => {
  event.preventDefault();
  if (!busy && ++dragDepth === 1) $('drop').classList.add('drag');
};
$('drop').ondragover = event => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
};
$('drop').ondragleave = event => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('drop').classList.remove('drag');
};
$('drop').ondrop = event => {
  event.preventDefault();
  dragDepth = 0;
  $('drop').classList.remove('drag');
  choose(event.dataTransfer.files[0]);
};
// Dropping outside the upload area must not navigate away from the app.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

for (const button of tabs) button.onclick = () => {
  tab = button.dataset.tab;
  render();
};

$('generate').onclick = async () => {
  if (busy || reading || !original) return;
  busy = true;
  invalidateResult();
  render();
  $('status').textContent = 'Membuat puzzle\u2026';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: original.split(',')[1], m: 3,
        rotate: true, grayscale: false,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gambar tidak dapat diproses.');
    if (!data.frame || !data.archive || !data.info || !Array.isArray(data.pieces)) {
      throw new Error('Hasil server tidak lengkap. Coba lagi.');
    }
    result = data;
    try {
      game = await window.PuzzleGame.create(data, true);
      tab = 'play';
    } catch (gameError) {
      tab = 'frame';
      $('status').textContent = gameError.message;
    }
    render();
    $('dimensions').textContent = `${data.info.width} \u00d7 ${data.info.height} PX \u00b7 ${data.info.mode}`;
    $('count').textContent = `1 bingkai + ${data.info.count} potongan PNG`;
    if (game) $('status').textContent = 'Puzzle siap dimainkan.';
  } catch (error) {
    $('status').textContent = error.name === 'AbortError'
      ? 'Proses terlalu lama. Coba gambar lebih kecil.'
      : error instanceof TypeError || error instanceof SyntaxError
        ? 'Server tidak terhubung. Jalankan aplikasi lalu coba lagi.'
        : error.message || 'Proses gagal. Coba lagi.';
  } finally {
    clearTimeout(timeout);
    busy = false;
    syncControls();
  }
};

$('download').onclick = () => {
  if (!result || busy) return;
  const bytes = Uint8Array.from(atob(result.archive), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `puzzle_${result.info.puzzle_grid}x${result.info.puzzle_grid}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
syncControls();
render();
