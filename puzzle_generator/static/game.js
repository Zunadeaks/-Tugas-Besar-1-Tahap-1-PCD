/* Jigsaw rendering uses the generated image data; uploads stay on this server. */
(function () {
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const bitmap = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Kepingan gagal dimuat. Buat ulang puzzle.'));
    img.src = src;
  });
  const canvas = (width, height) => {
    const el = document.createElement('canvas');
    el.width = Math.max(1, Math.ceil(width));
    el.height = Math.max(1, Math.ceil(height));
    return el;
  };
  function outline(ctx, x, y, w, h, edges, depth) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    const side = (sx, sy, dx, dy, sign) => {
      const len = Math.hypot(dx, dy);
      const nx = dy / len * depth * sign;
      const ny = -dx / len * depth * sign;
      ctx.lineTo(sx + dx * .34, sy + dy * .34);
      ctx.bezierCurveTo(sx + dx * .34 + nx, sy + dy * .34 + ny,
        sx + dx * .66 + nx, sy + dy * .66 + ny,
        sx + dx * .66, sy + dy * .66);
      ctx.lineTo(sx + dx, sy + dy);
    };
    side(x, y, w, 0, edges[0]);
    side(x + w, y, 0, h, edges[1]);
    side(x + w, y + h, -w, 0, edges[2]);
    side(x, y + h, 0, -h, edges[3]);
    ctx.closePath();
  }

  class PuzzleGame {
    static async create(data, rotated) {
      const game = new PuzzleGame(data, rotated);
      await game.prepare();
      game.build();
      return game;
    }
    constructor(data, rotated) {
      this.data = data;
      this.state = new PuzzleState(data.pieces.length, rotated);
      this.root = make('div', 'puzzle-game');
      this.drag = null;
      this.disposed = false;
    }
    async prepare() {
      const { info } = this.data;
      // Limit display textures without changing downloaded originals.
      this.scale = Math.min(1, 1200 / Math.max(info.width, info.height));
      const s = this.scale;
      const full = canvas(info.width * s, info.height * s);
      const ctx = full.getContext('2d');
      const prefix = 'data:image/png;base64,';
      ctx.drawImage(await bitmap(prefix + this.data.frame), 0, 0, full.width, full.height);
      for (let i = 0; i < this.data.pieces.length; i++) {
        const meta = info.pieces[i];
        const img = await bitmap(prefix + this.data.pieces[i].data);
        const [x, y, right, bottom] = meta.box;
        const w = (right - x) * s, h = (bottom - y) * s;
        ctx.save();
        ctx.translate((x + (right - x) / 2) * s, (y + (bottom - y) / 2) * s);
        // Pillow rotates counter-clockwise; Canvas positive angles turn clockwise.
        ctx.rotate(meta.rotation_ccw * Math.PI / 180);
        const swapped = meta.rotation_ccw % 180 !== 0;
        ctx.drawImage(img, -(swapped ? h : w) / 2, -(swapped ? w : h) / 2, swapped ? h : w, swapped ? w : h);
        ctx.restore();
      }
      this.reference = full.toDataURL();
      const board = canvas(full.width, full.height);
      const bctx = board.getContext('2d');
      bctx.drawImage(full, 0, 0);
      const first = info.pieces[0].box;
      const last = info.pieces[info.pieces.length - 1].box;
      bctx.fillStyle = '#edf0f8';
      bctx.fillRect(first[0] * s, first[1] * s, (last[2] - first[0]) * s, (last[3] - first[1]) * s);
      const n = info.puzzle_grid;
      const playLeft = first[0] * s;
      const playTop = first[1] * s;
      const playWidth = (last[2] - first[0]) * s;
      const playHeight = (last[3] - first[1]) * s;
      const guideInset = Math.min(1.5, playWidth / 4, playHeight / 4);
      const vertical = Array.from({ length: n }, () => Array.from({ length: n - 1 }, () => Math.random() < .5 ? -1 : 1));
      const horizontal = Array.from({ length: n - 1 }, () => Array.from({ length: n }, () => Math.random() < .5 ? -1 : 1));
      const depth = Math.min(info.width, info.height) * s / (n + 2) * .26;
      const pad = Math.ceil(depth + 2);
      this.tiles = info.pieces.map((meta, id) => {
        const [x, y, right, bottom] = meta.box;
        const r = meta.row - 1, c = meta.column - 1;
        const w = (right - x) * s, h = (bottom - y) * s;
        const edges = [r ? -horizontal[r - 1][c] : 0, c < n - 1 ? vertical[r][c] : 0,
          r < n - 1 ? horizontal[r][c] : 0, c ? -vertical[r][c - 1] : 0];
        const cut = canvas(w + pad * 2, h + pad * 2);
        const cutCtx = cut.getContext('2d');
        outline(cutCtx, pad, pad, w, h, edges, depth);
        cutCtx.save();
        cutCtx.clip();
        cutCtx.drawImage(full, pad - x * s, pad - y * s);
        cutCtx.restore();
        cutCtx.strokeStyle = '#ffffff80';
        cutCtx.lineWidth = .7;
        cutCtx.stroke();
        // Keep the internal guides, but hide the outer contour of the
        // playable area so the board feels open while the puzzle is active.
        bctx.save();
        bctx.beginPath();
        bctx.rect(playLeft + guideInset, playTop + guideInset,
          playWidth - guideInset * 2, playHeight - guideInset * 2);
        bctx.clip();
        outline(bctx, x * s, y * s, w, h, edges, depth);
        bctx.strokeStyle = '#bac3d6';
        bctx.lineWidth = .8;
        bctx.stroke();
        bctx.restore();
        return { id, url: cut.toDataURL(), x: x * s - pad, y: y * s - pad,
          width: cut.width, height: cut.height, box: meta.box };
      });
      this.boardImage = board.toDataURL();
      this.width = full.width;
      this.height = full.height;
    }
    button(label, handler) {
      const button = make('button', 'game-action', label);
      button.type = 'button';
      button.onclick = handler;
      return button;
    }
    build() {
      const toolbar = make('div', 'game-toolbar');
      this.progress = make('strong', 'game-progress');
      this.referenceButton = this.button('Lihat gambar', () => {
        this.referenceVisible = !this.referenceVisible;
        this.referenceLayer.hidden = !this.referenceVisible;
        this.referenceButton.setAttribute('aria-pressed', String(this.referenceVisible));
      });
      this.referenceButton.setAttribute('aria-pressed', 'false');
      toolbar.append(this.progress, this.referenceButton,
        this.button('Acak', () => { this.cancelDrag(); this.state.shuffle(); this.update(); }),
        this.button('Ulang', () => this.reset()));
      this.message = make('p', 'game-message', 'Geser kepingan ke papan, atau pilih kepingan lalu klik tempatnya.');
      this.message.setAttribute('role', 'status');
      const scroll = make('div', 'game-board-scroll');
      this.board = make('div', 'game-board');
      this.board.style.aspectRatio = `${this.width} / ${this.height}`;
      this.board.style.width = `${Math.max(320, Math.min(540, 420 * this.width / this.height))}px`;
      this.board.style.minWidth = `${(this.data.info.puzzle_grid + 2) * 28}px`;
      const bg = make('img', 'board-background');
      bg.src = this.boardImage;
      bg.alt = 'Bingkai dan tempat kepingan puzzle';
      bg.draggable = false;
      this.board.append(bg);
      this.slots = this.tiles.map(tile => {
        const slot = this.button('', () => this.place(tile.id));
        slot.className = 'game-slot';
        const [x, y, r, b] = tile.box;
        Object.assign(slot.style, { left: `${x / this.data.info.width * 100}%`, top: `${y / this.data.info.height * 100}%`,
          width: `${(r - x) / this.data.info.width * 100}%`, height: `${(b - y) / this.data.info.height * 100}%` });
        const meta = this.data.info.pieces[tile.id];
        slot.setAttribute('aria-label', `Tempat baris ${meta.row}, kolom ${meta.column}`);
        this.board.append(slot);
        return slot;
      });
      this.placedLayer = make('div', 'placed-layer');
      this.referenceLayer = make('img', 'board-reference');
      this.referenceLayer.src = this.reference;
      this.referenceLayer.alt = 'Gambar petunjuk';
      this.referenceLayer.hidden = true;
      this.completeLayer = make('img', 'board-complete');
      this.completeLayer.src = this.reference;
      this.completeLayer.alt = 'Puzzle selesai, gambar utuh';
      this.completeLayer.setAttribute('aria-hidden', 'true');
      this.board.append(this.placedLayer, this.referenceLayer, this.completeLayer);
      scroll.append(this.board);
      const rotation = make('div', 'game-toolbar');
      this.selectionLabel = make('span', 'selection-label', 'Pilih kepingan');
      this.left = this.button('↶ Putar kiri', () => this.rotate(-90));
      this.right = this.button('↷ Putar kanan', () => this.rotate(90));
      rotation.append(this.selectionLabel, this.left, this.right);
      this.tray = make('div', 'game-tray');
      this.tray.setAttribute('aria-label', 'Kepingan yang belum terpasang');
      this.pieceButtons = this.tiles.map(tile => {
        const button = this.button('', () => {
          if (this.suppressClick === tile.id) { this.suppressClick = null; return; }
          this.state.select(tile.id);
          this.updateSelection();
        });
        button.className = 'game-piece';
        const img = make('img', '');
        img.src = tile.url;
        img.alt = '';
        img.draggable = false;
        button.append(img);
        button.setAttribute('aria-label', `Kepingan ${tile.id + 1}`);
        button.onpointerdown = event => this.startDrag(event, tile.id);
        button.onpointermove = event => this.moveDrag(event);
        button.onpointerup = event => this.endDrag(event);
        button.onpointercancel = () => this.cancelDrag();
        button.onlostpointercapture = () => this.cancelDrag();
        return button;
      });
      this.root.onkeydown = event => {
        if (event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'e') {
          event.preventDefault();
          this.rotate(event.key.toLowerCase() === 'q' ? -90 : 90);
        } else if (event.key === 'Escape') this.cancelDrag();
      };
      this.root.append(toolbar, this.message, scroll, rotation, this.tray);
      this.update();
    }
    updateSelection() {
      const id = this.state.selected;
      this.left.disabled = this.right.disabled = id === null;
      this.selectionLabel.textContent = id === null ? 'Pilih kepingan · Q / E untuk putar' : `Kepingan ${id + 1} · ${this.state.pieces[id].angle}°`;
      this.pieceButtons.forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === id));
        button.firstChild.style.transform = `rotate(${this.state.pieces[index].angle}deg)`;
      });
    }
    update() {
      this.tray.replaceChildren(...this.state.order.filter(id => !this.state.pieces[id].placed).map(id => this.pieceButtons[id]));
      this.placedLayer.replaceChildren();
      for (const piece of this.state.pieces) {
        this.slots[piece.id].disabled = piece.placed;
        if (!piece.placed) continue;
        const tile = this.tiles[piece.id];
        const img = make('img', 'placed-piece');
        img.src = tile.url;
        img.alt = '';
        Object.assign(img.style, { left: `${tile.x / this.width * 100}%`, top: `${tile.y / this.height * 100}%`,
          width: `${tile.width / this.width * 100}%`, height: `${tile.height / this.height * 100}%` });
        this.placedLayer.append(img);
      }
      this.progress.textContent = `${this.state.count} / ${this.tiles.length} terpasang · ${this.state.moves} percobaan`;
      this.updateSelection();
    }
    rotate(delta) {
      this.state.rotate(delta);
      this.updateSelection();
    }
    place(target) {
      const status = this.state.place(target);
      const messages = { empty: 'Pilih kepingan terlebih dahulu.', position: 'Belum cocok. Coba tempat lain.',
        rotation: 'Tempatnya benar. Putar kepingannya dulu.', placed: 'Pas! Lanjutkan kepingan berikutnya.',
        complete: 'Selesai! Semua kepingan terpasang. Klik Ulang untuk main lagi.' };
      this.message.textContent = messages[status];
      this.root.classList.toggle('is-complete', this.state.complete);
      this.completeLayer.setAttribute('aria-hidden', String(!this.state.complete));
      this.update();
    }
    startDrag(event, id) {
      if (event.button !== 0 || !this.state.select(id)) return;
      this.suppressClick = null;
      this.updateSelection();
      this.drag = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, source: event.currentTarget };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    moveDrag(event) {
      const d = this.drag;
      if (!d || event.pointerId !== d.pointer) return;
      if (!d.ghost && Math.hypot(event.clientX - d.x, event.clientY - d.y) < 5) return;
      if (!d.ghost) {
        const tile = this.tiles[d.id];
        d.ghost = make('img', 'game-drag-ghost');
        d.ghost.src = tile.url;
        d.ghost.alt = '';
        d.ghost.style.width = `${tile.width / this.width * this.board.getBoundingClientRect().width}px`;
        d.ghost.style.transform = `translate(-50%, -50%) rotate(${this.state.pieces[d.id].angle}deg)`;
        document.body.append(d.ghost);
      }
      d.ghost.style.left = `${event.clientX}px`;
      d.ghost.style.top = `${event.clientY}px`;
      this.slots.forEach(slot => {
        const r = slot.getBoundingClientRect();
        slot.classList.toggle('drop-target', !slot.disabled && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
      });
    }
    endDrag(event) {
      const d = this.drag;
      if (!d || event.pointerId !== d.pointer) return;
      if (d.ghost) {
        this.suppressClick = d.id;
        setTimeout(() => { this.suppressClick = null; }, 0);
        const target = this.slots.findIndex(slot => {
          const r = slot.getBoundingClientRect();
          return !slot.disabled && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        this.cancelDrag();
        if (target >= 0) this.place(target);
      } else this.cancelDrag();
    }
    cancelDrag() {
      const d = this.drag;
      this.drag = null;
      if (d) {
        d.ghost?.remove();
        if (d.source.hasPointerCapture(d.pointer)) d.source.releasePointerCapture(d.pointer);
      }
      this.slots?.forEach(slot => slot.classList.remove('drop-target'));
    }
    reset() {
      this.cancelDrag();
      this.state.reset();
      this.referenceVisible = false;
      this.referenceLayer.hidden = true;
      this.referenceButton.setAttribute('aria-pressed', 'false');
      this.root.classList.remove('is-complete');
      this.completeLayer.setAttribute('aria-hidden', 'true');
      this.message.textContent = 'Susun kembali kepingan pada papan.';
      this.update();
    }
    dispose() { this.cancelDrag(); this.disposed = true; this.root.remove(); }
  }
  window.PuzzleGame = PuzzleGame;
})();
