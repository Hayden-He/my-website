/**
 * CanvasRenderingContext2D.roundRect 兜底实现（Safari 16 以前等旧浏览器不支持，调用会抛错导致整个画面崩溃）
 */
(function () {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const proto = CanvasRenderingContext2D.prototype;
  if (proto.roundRect) return;
  proto.roundRect = function (x, y, w, h, r) {
    let radius = Array.isArray(r) ? r[0] : r;
    radius = Math.max(0, Math.min(radius || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
})();
