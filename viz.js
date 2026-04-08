// ── PREDICTOR CONFIG ──────────────────────────────────────────────────
const PREDICTORS = [
  {
    key: 'pct_nonwhite',
    label: '% Non-White',
    r: null,
    barColor: '#8b1a10',
    fmt: d => `${(d * 100).toFixed(1)}%`,
    xLabel: '% non-white residents'
  },
  {
    key: 'pct_black',
    label: '% Black',
    r: null,
    barColor: '#c5614f',
    fmt: d => `${(d * 100).toFixed(1)}%`,
    xLabel: '% Black residents'
  },
  {
    key: 'mhi',
    label: 'Median Income',
    r: null,
    barColor: '#3d8e8d',
    fmt: d => `$${Math.round(d / 1000)}k`,
    xLabel: 'median household income'
  },
  {
    key: 'corp_own_rate',
    label: 'Corporate Ownership',
    r: null,
    barColor: '#6b6b67',
    fmt: d => `${(d * 100).toFixed(1)}%`,
    xLabel: 'corporate ownership rate'
  },
  {
    key: 'flip_rate',
    label: 'Flip Rate',
    r: null,
    barColor: '#6b6b67',
    fmt: d => `${(d * 100).toFixed(1)}%`,
    xLabel: 'property flip rate'
  },
  {
    key: 'own_occ_rate',
    label: 'Owner Occupancy',
    r: null,
    barColor: '#6b6b67',
    fmt: d => `${(d * 100).toFixed(1)}%`,
    xLabel: 'owner occupancy rate'
  }
];

// ── COMPUTE REAL r VALUES ──────────────────────────────────────────────
function pearsonR(xs, ys) {
  const n = xs.length;
  const mx = d3.mean(xs), my = d3.mean(ys);
  const num = d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const den = Math.sqrt(
    d3.sum(xs.map(x => (x - mx) ** 2)) *
    d3.sum(ys.map(y => (y - my) ** 2))
  );
  return num / den;
}

const evictions = DATA.map(d => d.eviction_rate);
PREDICTORS.forEach(p => {
  p.r = pearsonR(DATA.map(d => d[p.key]), evictions);
  // Assign bar color based on computed r
  if (p.r > 0.3) p.barColor = '#8b1a10';
  else if (p.r < -0.3) p.barColor = '#3d8e8d';
  else p.barColor = '#5a5a56';
});

function linReg(xs, ys) {
  const mx = d3.mean(xs), my = d3.mean(ys);
  const slope = d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) /
                d3.sum(xs.map(x => (x - mx) ** 2));
  return { slope, intercept: my - slope * mx };
}

// ── STATE ──────────────────────────────────────────────────────────────
let activePredictor = PREDICTORS[0];
let highlightedTracts = new Set();

// ── DOM REFS ──────────────────────────────────────────────────────────
const tooltip   = document.getElementById('tooltip');
const rBadge    = document.getElementById('r-badge');
const scTitle   = document.getElementById('scatter-title');
const resetBtn  = document.getElementById('reset-btn');

// ── TOOLTIP HELPER ────────────────────────────────────────────────────
function showTooltip(event, d) {
  const p = activePredictor;
  document.getElementById('tt-title').textContent    = d.label;
  document.getElementById('tt-eviction').textContent = `${d.eviction_rate.toFixed(1)}%`;
  document.getElementById('tt-x-label').textContent  = p.label + ':';
  document.getElementById('tt-x').textContent        = p.fmt(d[p.key]);
  tooltip.style.left = (event.clientX + 16) + 'px';
  tooltip.style.top  = (event.clientY - 36) + 'px';
  tooltip.classList.add('show');
}
function hideTooltip() { tooltip.classList.remove('show'); }

// ── CORR CHART ────────────────────────────────────────────────────────
function buildCorrChart() {
  const el   = document.getElementById('corr-chart');
  const W    = el.parentElement.clientWidth;
  const barH = 34, gap = 8;
  const H    = PREDICTORS.length * (barH + gap) + 28;
  const mL   = 168, mR = 64, mT = 8;
  const iW   = W - mL - mR;
  const maxAbs = 0.76;

  const xSc = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, iW]);
  const zero = xSc(0);

  const svg = d3.select('#corr-chart')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  const g = svg.append('g').attr('transform', `translate(${mL},${mT})`);

  // Reference lines at ±0.5 and 0
  [-0.5, 0, 0.5].forEach(v => {
    g.append('line')
      .attr('x1', xSc(v)).attr('x2', xSc(v))
      .attr('y1', 0).attr('y2', H - mT - 16)
      .attr('stroke', v === 0 ? 'rgba(240,236,226,0.18)' : 'rgba(240,236,226,0.07)')
      .attr('stroke-dasharray', v === 0 ? 'none' : '3,3');
    g.append('text')
      .attr('x', xSc(v)).attr('y', H - mT - 2)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', 10)
      .attr('fill', 'rgba(240,236,226,0.28)')
      .text(v === 0 ? '0.0' : d3.format('+.1f')(v));
  });

  PREDICTORS.forEach((p, i) => {
    const y       = i * (barH + gap);
    const isActive = p.key === activePredictor.key;

    const row = g.append('g')
      .attr('transform', `translate(0,${y})`)
      .style('cursor', 'pointer')
      .on('click', () => {
        activePredictor = p;
        buildCorrChart();
        updateScatter();
      });

    // Row hover bg
    row.append('rect')
      .attr('x', -mL).attr('y', -2)
      .attr('width', W).attr('height', barH + 2)
      .attr('fill', isActive ? 'rgba(255,255,255,0.035)' : 'transparent')
      .attr('rx', 6)
      .on('mouseover', function() {
        if (!isActive) d3.select(this).attr('fill', 'rgba(255,255,255,0.02)');
      })
      .on('mouseout', function() {
        if (!isActive) d3.select(this).attr('fill', 'transparent');
      });

    // Active left accent
    if (isActive) {
      row.append('rect')
        .attr('x', -mL).attr('y', 3)
        .attr('width', 3).attr('height', barH - 6)
        .attr('rx', 2)
        .attr('fill', '#3d8e8d');
    }

    // Label
    row.append('text')
      .attr('x', -12).attr('y', barH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', isActive ? 12 : 11)
      .attr('font-weight', isActive ? 500 : 400)
      .attr('fill', isActive ? '#f0ece2' : 'rgba(240,236,226,0.5)')
      .text(p.label);

    // Bar
    const bx = p.r >= 0 ? zero : xSc(p.r);
    const bw = Math.max(Math.abs(xSc(p.r) - zero), 3);
    row.append('rect')
      .attr('x', bx).attr('y', 7)
      .attr('width', bw).attr('height', barH - 14)
      .attr('rx', 4)
      .attr('fill', p.barColor)
      .attr('opacity', isActive ? 1 : 0.5);

    // r value label
    row.append('text')
      .attr('x', p.r >= 0 ? xSc(p.r) + 7 : xSc(p.r) - 7)
      .attr('y', barH / 2 + 4)
      .attr('text-anchor', p.r >= 0 ? 'start' : 'end')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', 11)
      .attr('font-weight', isActive ? 600 : 400)
      .attr('fill', isActive ? '#f0ece2' : 'rgba(240,236,226,0.42)')
      .text(d3.format('+.3f')(p.r));
  });
}

// ── SCATTER CHART ─────────────────────────────────────────────────────
function updateScatter() {
  const p    = activePredictor;
  const xVals = DATA.map(d => d[p.key]);
  const yVals = DATA.map(d => d.eviction_rate);
  const r     = pearsonR(xVals, yVals);
  const { slope, intercept } = linReg(xVals, yVals);

  // Update header
  scTitle.textContent = `${p.label} vs. Eviction Filing Rate`;
  rBadge.textContent  = `r = ${d3.format('+.2f')(r)}`;
  rBadge.className    = 'r-badge ' + (r >= 0 ? 'pos' : 'neg');

  const el  = document.getElementById('scatter-chart');
  const W   = el.parentElement.clientWidth;
  const H   = Math.min(Math.round(W * 0.56), 430);
  const mL  = 52, mR = 20, mT = 18, mB = 50;
  const iW  = W - mL - mR;
  const iH  = H - mT - mB;

  const xExt = d3.extent(xVals);
  const xPad = (xExt[1] - xExt[0]) * 0.04;
  const xSc  = d3.scaleLinear()
    .domain([xExt[0] - xPad, xExt[1] + xPad])
    .range([0, iW]).nice();
  const ySc  = d3.scaleLinear()
    .domain([0, d3.max(yVals) * 1.06])
    .range([iH, 0]).nice();

  const svg = d3.select('#scatter-chart')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width', W).attr('height', H);

  // Root group (create once)
  let root = svg.select('g.root');
  if (root.empty()) {
    root = svg.append('g').attr('class', 'root')
      .attr('transform', `translate(${mL},${mT})`);
    root.append('g').attr('class', 'grid-y');
    root.append('line').attr('class', 'reg-line');
    root.append('g').attr('class', 'dots');
    root.append('g').attr('class', 'ax-x').attr('transform', `translate(0,${iH})`);
    root.append('g').attr('class', 'ax-y');
    root.append('text').attr('class', 'lbl-x');
    root.append('text').attr('class', 'lbl-y');
  }

  // Y grid lines
  root.select('.grid-y').selectAll('line')
    .data(ySc.ticks(5))
    .join('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', d => ySc(d)).attr('y2', d => ySc(d))
    .attr('stroke', 'rgba(240,236,226,0.055)');

  // Regression line
  const x0 = xSc.domain()[0], x1 = xSc.domain()[1];
  const lineColor = r > 0.3 ? 'rgba(139,26,16,0.55)'
                  : r < -0.3 ? 'rgba(61,142,141,0.55)'
                  : 'rgba(106,106,102,0.45)';
  root.select('.reg-line')
    .attr('x1', xSc(x0)).attr('x2', xSc(x1))
    .attr('y1', ySc(slope * x0 + intercept))
    .attr('y2', ySc(slope * x1 + intercept))
    .attr('stroke', lineColor)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3');

  // Dots
  function dotFill(d) {
    if (highlightedTracts.size === 0) return 'rgba(139,26,16,0.6)';
    return highlightedTracts.has(d.label) ? '#c5614f' : 'rgba(139,26,16,0.1)';
  }
  function dotStroke(d) {
    return highlightedTracts.has(d.label)
      ? 'rgba(240,236,226,0.75)' : 'rgba(240,236,226,0.12)';
  }
  function dotStrokeW(d) {
    return highlightedTracts.has(d.label) ? 1.5 : 0.5;
  }

  root.select('.dots').selectAll('circle')
    .data(DATA, d => d.label + '|' + d.eviction_rate)
    .join(
      enter => enter.append('circle')
        .attr('r', 0)
        .attr('cx', d => xSc(d[p.key]))
        .attr('cy', d => ySc(d.eviction_rate))
        .call(e => e.transition().duration(380).attr('r', 4.8)),
      update => update.call(u =>
        u.transition().duration(380)
          .attr('cx', d => xSc(d[p.key]))
          .attr('cy', d => ySc(d.eviction_rate))),
      exit => exit.call(e =>
        e.transition().duration(180).attr('r', 0).remove())
    )
    .attr('fill',         dotFill)
    .attr('stroke',       dotStroke)
    .attr('stroke-width', dotStrokeW)
    .style('cursor', 'pointer')
    .on('mousemove', showTooltip)
    .on('mouseleave', hideTooltip)
    .on('click', (event, d) => {
      if (highlightedTracts.has(d.label)) highlightedTracts.delete(d.label);
      else highlightedTracts.add(d.label);
      resetBtn.classList.toggle('on', highlightedTracts.size > 0);
      refreshDots();
    });

  // Axes
  const axStyle = g => {
    g.select('.domain').attr('stroke', 'rgba(240,236,226,0.14)');
    g.selectAll('.tick line').attr('stroke', 'rgba(240,236,226,0.14)');
    g.selectAll('.tick text')
      .attr('fill', 'rgba(240,236,226,0.42)')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', 10);
  };

  root.select('.ax-x')
    .call(d3.axisBottom(xSc).ticks(5).tickFormat(v => p.fmt(v)))
    .call(axStyle);

  root.select('.ax-y')
    .call(d3.axisLeft(ySc).ticks(5).tickFormat(d => `${d}%`))
    .call(axStyle);

  // Axis labels
  root.select('.lbl-x')
    .attr('x', iW / 2).attr('y', iH + 42)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'IBM Plex Mono, monospace')
    .attr('font-size', 11)
    .attr('fill', 'rgba(240,236,226,0.4)')
    .text(p.xLabel);

  root.select('.lbl-y')
    .attr('x', -iH / 2).attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('font-family', 'IBM Plex Mono, monospace')
    .attr('font-size', 11)
    .attr('fill', 'rgba(240,236,226,0.4)')
    .text('eviction filing rate (%)');
}

function refreshDots() {
  const p = activePredictor;
  d3.select('#scatter-chart').selectAll('circle')
    .attr('fill', d => {
      if (highlightedTracts.size === 0) return 'rgba(139,26,16,0.6)';
      return highlightedTracts.has(d.label) ? '#c5614f' : 'rgba(139,26,16,0.1)';
    })
    .attr('stroke', d =>
      highlightedTracts.has(d.label)
        ? 'rgba(240,236,226,0.75)' : 'rgba(240,236,226,0.12)')
    .attr('stroke-width', d =>
      highlightedTracts.has(d.label) ? 1.5 : 0.5);
}

// ── RESET ─────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  highlightedTracts.clear();
  resetBtn.classList.remove('on');
  refreshDots();
});

// ── INIT + RESIZE ──────────────────────────────────────────────────────
buildCorrChart();
updateScatter();
window.addEventListener('resize', () => {
  buildCorrChart();
  updateScatter();
});
