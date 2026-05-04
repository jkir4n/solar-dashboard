// charts.js — Custom canvas charting with crosshair overlay
// Ported from solar-v9.html lines 2033-2475

export class ChartManager {
  /**
   * @param {import('./ha-bridge.js').HABridge} bridge
   */
  constructor(bridge) {
    this._bridge = bridge;       // HABridge instance for history/stats fetching
    this._chartData = {};        // canvasId -> { datasets, opts, ... }
    this._chartAnimIds = {};     // canvasId -> requestAnimationFrame id
    this._snapshots = {};        // canvasId -> ImageData snapshot of clean chart
    this._crosshairHandlers = new Map(); // canvas -> { handlers } for cleanup
    this._lastUpdate = 0;
    this._throttleMs = 5000;
    this._hoverRafId = null; // NI8: expose hover RAF for cancellation in detachAll
    this._themeRoot = null;
    this._cachedGrid = 'rgba(255,255,255,0.06)';
    this._cachedText = 'rgba(255,255,255,0.35)';
    this._canvasRect = null;
    // Invalidate cached rect on resize so stale values are not used
    this._onWindowResize = () => { this._canvasRect = null; };
    window.addEventListener('resize', this._onWindowResize);
  }

  setThemeRoot(el) {
    this._themeRoot = el;
    this.updateTheme();
  }

  updateTheme() {
    if (!this._themeRoot) return;
    const cs = getComputedStyle(this._themeRoot);
    const grid = cs.getPropertyValue('--chart-grid').trim();
    const text = cs.getPropertyValue('--chart-text').trim();
    if (grid) this._cachedGrid = grid;
    if (text) this._cachedText = text;
  }

  // ─── drawChart ───────────────────────────────────────────────
  // Ported from v9 line 2033-2131
  drawChart(canvas, datasets, opts = {}, animate = false) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const canvasId = canvas.id || canvas.dataset.chartId || 'anon';

    if (this._chartAnimIds[canvasId]) {
      cancelAnimationFrame(this._chartAnimIds[canvasId]);
      this._chartAnimIds[canvasId] = null;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width, H = rect.height;
    const pad = { top: 10, right: 10, bottom: 25, left: 40 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    let minVal = opts.minY ?? Infinity;
    let maxVal = opts.maxY ?? -Infinity;
    if (opts.minY === undefined || opts.maxY === undefined) {
      for (const ds of datasets) for (const v of ds.points) if (v != null) {
        if (opts.minY === undefined && v < minVal) minVal = v;
        if (opts.maxY === undefined && v > maxVal) maxVal = v;
      }
    }
    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 1;
    const range = maxVal - minVal || 1;
    // When all data equals minVal (e.g. all-zero at night), anchor the axis
    // upward from minVal rather than letting the fallback range go negative.
    const yGridTop = (maxVal === minVal) ? minVal + range : maxVal;
    const n = datasets[0].points.length;
    if (n === 0) return;
    const labelFn = opts.xLabel || (i => i);

    const drawFrame = (progress) => {
      ctx.clearRect(0, 0, W, H);

      // Grid
      const gridN = 4;
      ctx.strokeStyle = this._cachedGrid;
      ctx.lineWidth = 0.5;
      ctx.fillStyle = this._cachedText;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      let lastYLabel = null;
      for (let i = 0; i <= gridN; i++) {
        const y = pad.top + (cH * i / gridN);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
        const val = yGridTop - (range * i / gridN);
        const label = opts.yFormat ? opts.yFormat(val) : val.toFixed(0);
        if (label !== lastYLabel) {
          ctx.fillText(label, pad.left - 4, y + 4);
          lastYLabel = label;
        }
      }

      // X labels
      ctx.textAlign = 'center';
      const nSpan = Math.max(n - 1, 1);
      for (let i = 0; i < n; i += Math.max(1, Math.ceil(n / 6))) {
        const x = pad.left + (cW * i / nSpan);
        ctx.fillText(labelFn(i), x, H - 4);
      }

      // Clip-to-reveal for animation
      const clipX = pad.left + cW * progress;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, H);
      ctx.clip();

      // Draw datasets
      datasets.forEach(ds => {
        const pts = ds.points;
        ctx.beginPath();
        let started = false;
        const ptsSpan = Math.max(pts.length - 1, 1);
        pts.forEach((v, i) => {
          if (v == null) return;
          const x = pad.left + (cW * i / ptsSpan);
          const y = pad.top + cH - (cH * (v - minVal) / range);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = ds.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (ds.fill !== false) {
          const lastX = pad.left + cW;
          ctx.lineTo(lastX, pad.top + cH);
          ctx.lineTo(pad.left, pad.top + cH);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
          const toRgba = (color, alpha) => {
            const m = color.match(/rgba?\(([^)]+)\)/);
            if (!m) return color;
            const parts = m[1].split(',').map(s => s.trim());
            return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
          };
          grad.addColorStop(0, toRgba(ds.color, 0.3));
          grad.addColorStop(1, toRgba(ds.color, 0));
          ctx.fillStyle = grad;
          ctx.fill();
        }
      });
      ctx.restore();
    };

    // Store chart data for overlay / crosshair
    // Compute overall min/max across ALL datasets for correct overlay positioning
    let _oMin = Infinity, _oMax = -Infinity;
    for (const ds of datasets) for (const v of ds.points) if (v != null) {
      if (v < _oMin) _oMin = v;
      if (v > _oMax) _oMax = v;
    }
    const _oMinVal = _oMin === Infinity ? 0 : _oMin;
    const _oMaxVal = _oMax === -Infinity ? 1 : _oMax;
    this._chartData[canvasId] = {
      datasets, opts,
      padding: { left: 40, right: 10, top: 10, bottom: 25 },
      cW: rect.width - 50,   // W - pad.left - pad.right
      cH: rect.height - 35,  // H - pad.top - pad.bottom
      padLeft: 40,
      padTop: 10,
      dpr,
      minVal: opts.minY ?? _oMinVal,
      maxVal: (() => {
        const mn = opts.minY ?? _oMinVal;
        const mx = opts.maxY ?? _oMaxVal;
        return mx === mn ? mn + 1 : mx;
      })(),
    };

    if (!animate) {
      drawFrame(1);
      this._snapshots[canvasId] = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

    // Animated reveal with easeOutCubic
    const dur = 800;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      drawFrame(ease);
      if (t < 1) this._chartAnimIds[canvasId] = requestAnimationFrame(tick);
      else {
        this._chartAnimIds[canvasId] = null;
        this._snapshots[canvasId] = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    };
    this._chartAnimIds[canvasId] = requestAnimationFrame(tick);
  }

  // ─── getChartData ────────────────────────────────────────────
  // Return the first dataset's points for a given canvas
  getChartData(canvasId) {
    const cd = this._chartData[canvasId];
    if (!cd || !cd.datasets?.[0]) return null;
    return cd.datasets[0].points;
  }

  // ─── drawChartOverlay ────────────────────────────────────────
  // Ported from v9 line 2203-2301
  drawChartOverlay(canvas, mouseX) {
    const canvasId = canvas.id || canvas.dataset.chartId || 'anon';
    const cd = this._chartData[canvasId];
    if (!cd) return;
    const { datasets, opts, cW, cH, padLeft, padTop, dpr, minVal, maxVal } = cd;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const yRange = maxVal - minVal || 1;

    // Restore clean chart snapshot (avoids full redraw on every mousemove)
    const snap = this._snapshots[canvasId];
    if (snap && canvas.width === snap.width && canvas.height === snap.height) {
      ctx.putImageData(snap, 0, 0);
    } else {
      this.drawChart(canvas, datasets, opts, false);
      this._snapshots[canvasId] = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // Set transform for CSS-pixel overlay drawing
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (mouseX < padLeft || mouseX > padLeft + cW) return;

    // Nearest data-point index
    const points = datasets[0].points;
    const stepX = cW / Math.max(points.length - 1, 1);
    const idx = Math.round((mouseX - padLeft) / stepX);
    if (idx < 0 || idx >= points.length) return;
    const pointX = padLeft + idx * stepX;

    ctx.save();

    // Crosshair vertical line
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pointX, padTop);
    ctx.lineTo(pointX, padTop + cH);
    ctx.stroke();

    // Data-point dots — use chart-wide minVal/maxVal for correct Y positioning
    datasets.forEach(ds => {
      if (ds.points[idx] == null) return;
      const val = ds.points[idx];
      const py = padTop + cH - ((val - minVal) / yRange) * cH;
      ctx.fillStyle = ds.color;
      ctx.beginPath();
      ctx.arc(pointX, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Tooltip text
    const xLabel = opts.xLabel ? opts.xLabel(idx) : '';
    const values = datasets.map(ds => {
      if (ds.points[idx] == null) return null;
      const v = ds.points[idx];
      const fmt = opts.yFormat ? opts.yFormat(v) : Math.round(v);
      return ds.label ? fmt + ' ' + ds.label : String(fmt);
    }).filter(Boolean);
    const tooltipText = xLabel + (xLabel ? ' \u00b7 ' : '') + values.join(' \u00b7 ');

    // Tooltip box
    ctx.font = '12px Inter, system-ui, sans-serif';
    const textW = ctx.measureText(tooltipText).width;
    const padX = 10, padY = 7;
    const tipW = textW + padX * 2;
    const tipH = 12 + padY * 2;
    let tipX = pointX - tipW / 2;

    // Position near data — prefer above, flip below if clipped
    const topDataY = Math.min(...datasets.map(ds => {
      if (ds.points[idx] == null) return padTop + cH;
      const val = ds.points[idx];
      return padTop + cH - ((val - minVal) / yRange) * cH;
    }));
    let tipY = topDataY - tipH - 8;
    if (tipY < 2) tipY = topDataY + 12;

    // Clamp to canvas bounds
    const cssW = canvas.width / dpr;
    if (tipX < 2) tipX = 2;
    if (tipX + tipW > cssW - 2) tipX = cssW - 2 - tipW;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(tipX, tipY, tipW, tipH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, tipX + padX, tipY + tipH / 2);
    ctx.restore();
  }

  // ─── attachCrosshair ─────────────────────────────────────────
  // Ported from v9 line 2302-2334
  attachCrosshair(canvas) {
    if (!canvas) return;

    // Remove previous listeners to prevent leaks on repeated calls
    const prev = this._crosshairHandlers.get(canvas);
    if (prev) {
      canvas.removeEventListener('mousemove', prev.onMouseMove);
      canvas.removeEventListener('mouseleave', prev.onLeave);
      canvas.removeEventListener('touchstart', prev.onTouchStart);
      canvas.removeEventListener('touchmove', prev.onTouchMove);
      canvas.removeEventListener('touchend', prev.onLeave);
    }

    const handleMove = (clientX) => {
      const rect = this._canvasRect || (this._canvasRect = canvas.getBoundingClientRect());
      const mouseX = clientX - rect.left;
      this.drawChartOverlay(canvas, mouseX);
    };

    const handleLeave = () => {
      this._canvasRect = null;
      const canvasId = canvas.id || canvas.dataset.chartId || 'anon';
      const snap = this._snapshots[canvasId];
      if (snap) canvas.getContext('2d', { willReadFrequently: true }).putImageData(snap, 0, 0);
    };

    const onMouseEnter = () => { this._canvasRect = canvas.getBoundingClientRect(); };

    const onMouseMove = (e) => {
      const clientX = e.clientX;
      if (this._hoverRafId) return;
      this._hoverRafId = requestAnimationFrame(() => { this._hoverRafId = null; handleMove(clientX); });
    };
    const onTouchStart = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); };
    const onTouchMove = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); };

    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleLeave);

    this._crosshairHandlers.set(canvas, { onMouseEnter, onMouseMove, onLeave: handleLeave, onTouchStart, onTouchMove });
  }

  detachAll() {
    // NI8: Cancel pending chart animations
    for (const canvasId of Object.keys(this._chartAnimIds)) {
      if (this._chartAnimIds[canvasId]) {
        cancelAnimationFrame(this._chartAnimIds[canvasId]);
        this._chartAnimIds[canvasId] = null;
      }
    }
    // NI8: Cancel hover RAF
    if (this._hoverRafId) {
      cancelAnimationFrame(this._hoverRafId);
      this._hoverRafId = null;
    }
    this._crosshairHandlers.forEach((handlers, canvas) => {
      if (handlers.onMouseEnter) canvas.removeEventListener('mouseenter', handlers.onMouseEnter);
      canvas.removeEventListener('mousemove', handlers.onMouseMove);
      canvas.removeEventListener('mouseleave', handlers.onLeave);
      canvas.removeEventListener('touchstart', handlers.onTouchStart);
      canvas.removeEventListener('touchmove', handlers.onTouchMove);
      canvas.removeEventListener('touchend', handlers.onLeave);
    });
    this._snapshots = {};
    this._crosshairHandlers.clear();
    this._canvasRect = null;
  }

  // ─── showPlaceholder ─────────────────────────────────────────
  // Ported from v9 line 2337-2351
  showPlaceholder(canvas, message) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = this._cachedText;
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, rect.width / 2, rect.height / 2);
  }

  // Returns the UTC Date corresponding to 00:00:00 in the given IANA timezone.
  _tzMidnightUTC(tz, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(now);
    const h = +parts.find(p => p.type === 'hour').value;
    const m = +parts.find(p => p.type === 'minute').value;
    const s = +parts.find(p => p.type === 'second').value;
    return new Date(now.getTime() - (h * 3600 + m * 60 + s) * 1000 - now.getMilliseconds());
  }

  // ─── loadRange ───────────────────────────────────────────────
  // Ported from v9 line 2345-2475
  // Returns { powerData, socData } for caller to render solar chart etc.
  async loadRange(range, canvases, entityIds, timezone) {
    const tz = timezone || 'UTC';
    let powerData = null, socData = null;

    // Validate entity IDs before fetching
    if (!entityIds?.power) {
      console.warn('[Solar] Chart loadRange skipped — missing power entity ID:', entityIds);
      return { powerData, socData, timeXLabel: () => '' };
    }

    // Determine if power entity is signed (POWER fallback has negative=discharge, positive=charge)
    // vs unsigned (DISCHG_POWER/CHG_POWER are always positive)
    const powerIsSigned = !!(entityIds._signed);

    try {
      if (range === 'Live') {
        // Today from midnight (in supplied timezone) to now
        const now = new Date();
        const start = this._tzMidnightUTC(tz, now);
        if (entityIds.soc) {
          [powerData, socData] = await Promise.all([
            this._bridge.fetchHistoryRange(entityIds.power, start, now),
            this._bridge.fetchHistoryRange(entityIds.soc, start, now)
          ]);
        } else {
          powerData = await this._bridge.fetchHistoryRange(entityIds.power, start, now);
        }
      } else if (range === '1D') {
        // Yesterday — use statistics for regular 5-min intervals (history only returns state changes)
        const now = new Date();
        const endMidnight = this._tzMidnightUTC(tz, now);
        const startMidnight = new Date(endMidnight.getTime() - 24 * 60 * 60 * 1000);
        // Use stats for yesterday (1 day) to get regular intervals
        if (entityIds.soc) {
          [powerData, socData] = await Promise.all([
            this._bridge.fetchStatsRange(entityIds.power, 1, startMidnight, endMidnight),
            this._bridge.fetchStatsRange(entityIds.soc, 1, startMidnight, endMidnight)
          ]);
        } else {
          powerData = await this._bridge.fetchStatsRange(entityIds.power, 1, startMidnight, endMidnight);
        }
      } else {
        // 7D or 30D — use statistics endpoint, end at today's local midnight to exclude partial day
        const days = range === '7D' ? 7 : 30;
        const todayMidnight = this._tzMidnightUTC(tz);
        if (entityIds.soc) {
          [powerData, socData] = await Promise.all([
            this._bridge.fetchStatsRange(entityIds.power, days, null, todayMidnight),
            this._bridge.fetchStatsRange(entityIds.soc, days, null, todayMidnight)
          ]);
        } else {
          powerData = await this._bridge.fetchStatsRange(entityIds.power, days, null, todayMidnight);
        }
      }
    } catch (e) {
      console.warn('Chart fetch failed', e);
      // NI9: Show error placeholder on all requested canvases
      if (canvases.power) this.showPlaceholder(canvases.power, 'Failed to load');
      if (canvases.soc) this.showPlaceholder(canvases.soc, 'Failed to load');
      if (canvases.solar) this.showPlaceholder(canvases.solar, 'Failed to load');
    }

    // Build x-label function from timestamps
    const timeXLabel = (data) => (i) => {
      if (!data?.[i]) return '';
      const d = data[i].t;
      return (range === 'Live' || range === '1D')
        ? d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
        : (d.getMonth() + 1) + '/' + d.getDate();
    };

    // Render power chart (discharging power)
    if (canvases.power) {
      if (powerData?.length) {
        const pts = powerIsSigned
          ? powerData.map(d => (d.v !== null && d.v < 0) ? Math.abs(d.v) : 0)
          : powerData.map(d => (d.v !== null && d.v > 0) ? d.v : 0);
        this.drawChart(canvases.power, [{ points: pts, color: 'rgb(59,130,246)' }], {
          minY: 0, xLabel: timeXLabel(powerData), yFormat: v => Math.round(v) + ' W'
        }, true);
      } else {
        this.showPlaceholder(canvases.power, powerData === null ? 'Fetch error' : 'No data available');
      }
    }

    // Render SOC chart
    if (canvases.soc) {
      if (socData?.length) {
        const pts = socData.map(d => d.v ?? 0);
        this.drawChart(canvases.soc, [{ points: pts, color: 'rgb(249,115,22)' }], {
          minY: 0, maxY: 100, yFormat: v => Math.round(v) + '%', xLabel: timeXLabel(socData)
        }, true);
      } else {
        this.showPlaceholder(canvases.soc, socData === null ? 'Fetch error' : 'No data available');
      }
    }

    // Render solar chart (positive power = charging from solar)
    if (canvases.solar) {
      if (powerData?.length) {
        const pts = powerData.map(d => (d.v !== null && d.v > 0) ? d.v : 0);
        this.drawChart(canvases.solar, [{ points: pts, color: 'rgb(34,197,94)' }], {
          minY: 0, xLabel: timeXLabel(powerData), yFormat: v => Math.round(v) + ' W'
        }, true);
      } else {
        this.showPlaceholder(canvases.solar, powerData === null ? 'Fetch error' : 'No data available');
      }
    }

    return { powerData, socData, timeXLabel };
  }
}
