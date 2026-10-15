/* Pure game rules, shared by the browser and regression tests. */
(function (root) {
  class PuzzleState {
    constructor(count, rotated = false, random = Math.random) {
      this.random = random;
      this.rotated = rotated;
      this.pieces = Array.from({ length: count }, (_, id) => ({ id, angle: 0, placed: false }));
      this.reset();
    }
    shuffle() {
      this.order = this.pieces.filter(p => !p.placed).map(p => p.id);
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
    reset() {
      for (const p of this.pieces) {
        p.placed = false;
        p.angle = this.rotated ? Math.floor(this.random() * 4) * 90 : 0;
      }
      this.selected = null;
      this.moves = 0;
      this.shuffle();
    }
    select(id) {
      if (!this.pieces[id] || this.pieces[id].placed) return false;
      this.selected = id;
      return true;
    }
    rotate(delta) {
      const p = this.pieces[this.selected];
      if (!p || p.placed) return;
      p.angle = (p.angle + delta + 360) % 360;
    }
    place(target) {
      const p = this.pieces[this.selected];
      if (!p || p.placed) return 'empty';
      this.moves++;
      if (p.id !== target) return 'position';
      if (p.angle !== 0) return 'rotation';
      p.placed = true;
      this.selected = null;
      return this.complete ? 'complete' : 'placed';
    }
    get count() { return this.pieces.filter(p => p.placed).length; }
    get complete() { return this.count === this.pieces.length; }
  }
  root.PuzzleState = PuzzleState;
  if (typeof module !== 'undefined') module.exports = PuzzleState;
})(globalThis);
