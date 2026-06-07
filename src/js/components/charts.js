/* ====================================================
   DASHBOARD SVG ANALYTICS CHARTS
   ==================================================== */

import { formatCurrency, getCurrencySymbol } from '../core/insights.js';

// Entry function to draw both charts
export function renderCharts(goals) {
  renderProgressChart(goals);
  renderDistributionChart(goals);
}

// 1. Goal Progress Comparison Chart (SVG Bar Chart)
function renderProgressChart(goals) {
  const container = document.getElementById('bar-chart-container');
  if (!container) return;

  if (!goals || goals.length === 0) {
    container.innerHTML = `
      <div class="chart-placeholder">
        <p>Create goals to populate progress analytics</p>
      </div>
    `;
    return;
  }

  // Dimension parameters
  const svgWidth = container.clientWidth || 500;
  const svgHeight = 240;
  const paddingLeft = 65;
  const paddingBottom = 40;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Find scale boundaries
  const maxTarget = Math.max(...goals.map(g => g.target), 100);
  const maxSaved = Math.max(...goals.map(g => g.current), 0);
  const maxVal = Math.max(maxTarget, maxSaved);
  
  // Neat scale increments (round to next neat multiple)
  const order = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const step = order / 2 || 10;
  const yLimit = Math.ceil(maxVal / step) * step;

  // Grid line data
  const gridLinesCount = 4;
  let gridLinesHtml = '';
  for (let i = 0; i <= gridLinesCount; i++) {
    const val = (yLimit / gridLinesCount) * i;
    const yRatio = val / yLimit;
    const yPos = svgHeight - paddingBottom - (yRatio * chartHeight);
    
    // Horizontal line
    gridLinesHtml += `
      <line class="chart-grid-line" x1="${paddingLeft}" y1="${yPos}" x2="${svgWidth - paddingRight}" y2="${yPos}" />
      <text class="chart-label" x="${paddingLeft - 10}" y="${yPos + 4}" text-anchor="end">${formatCompactCurrency(val)}</text>
    `;
  }

  // Bars rendering
  const barWidth = Math.min(32, (chartWidth / goals.length) * 0.4);
  const groupSpacing = chartWidth / goals.length;
  let barsHtml = '';

  goals.forEach((goal, i) => {
    const xPos = paddingLeft + (i * groupSpacing) + (groupSpacing / 2) - (barWidth / 2);
    
    // Ratios and Heights
    const targetRatio = goal.target / yLimit;
    const targetHeight = targetRatio * chartHeight;
    const targetY = svgHeight - paddingBottom - targetHeight;

    const savedRatio = goal.current / yLimit;
    const savedHeight = savedRatio * chartHeight;
    const savedY = svgHeight - paddingBottom - savedHeight;

    // Truncate name
    const truncatedName = goal.name.length > 12 ? goal.name.slice(0, 10) + '..' : goal.name;

    barsHtml += `
      <!-- Target Bar (Background Translucent) -->
      <rect class="chart-bar-rect" 
            x="${xPos}" y="${targetY}" 
            width="${barWidth}" height="${targetHeight}" 
            rx="6" 
            fill="var(--system-${goal.color})" 
            fill-opacity="0.1" 
            stroke="var(--system-${goal.color})"
            stroke-opacity="0.3"
            stroke-width="1.5" />
      
      <!-- Current Savings Bar (Solid Accent) -->
      <rect class="chart-bar-rect" 
            x="${xPos}" y="${savedY}" 
            width="${barWidth}" height="${savedHeight}" 
            rx="6" 
            fill="url(#grad-${goal.color})" 
            style="filter: drop-shadow(0 2px 6px var(--goal-color-shadow-tint, rgba(0,0,0,0.1)))" />
            
      <!-- Hover Tooltip or Value Label -->
      <text class="chart-label value-label" x="${xPos + barWidth / 2}" y="${Math.min(targetY, savedY) - 6}" text-anchor="middle">
        ${formatCompactCurrency(goal.current)}
      </text>

      <!-- X Axis Label -->
      <text class="chart-label" x="${xPos + barWidth / 2}" y="${svgHeight - 12}" text-anchor="middle">
        ${truncatedName}
      </text>
    `;
  });

  // Base Axes
  const xAxisY = svgHeight - paddingBottom;
  const axesHtml = `
    <line class="chart-axis" x1="${paddingLeft}" y1="${xAxisY}" x2="${svgWidth - paddingRight}" y2="${xAxisY}" />
    <line class="chart-axis" x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${xAxisY}" />
  `;

  // Draw SVG
  container.innerHTML = `
    <svg class="analytics-bar-chart" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">
      ${gridLinesHtml}
      ${barsHtml}
      ${axesHtml}
    </svg>
  `;
}

// 2. Savings Distribution Chart (Donut Chart)
function renderDistributionChart(goals) {
  const container = document.getElementById('distribution-chart-container');
  if (!container) return;

  const totalSaved = goals.reduce((sum, g) => sum + g.current, 0);

  if (!goals || goals.length === 0 || totalSaved === 0) {
    container.innerHTML = `
      <div class="chart-placeholder">
        <p>No savings logged to show allocation distribution.</p>
      </div>
    `;
    return;
  }

  // We filter goals that have actual savings
  const savedGoals = goals.filter(g => g.current > 0);

  const radius = 70;
  const circumference = 2 * Math.PI * radius; // 439.82
  const strokeWidth = 16;
  const size = 180;
  const center = size / 2;

  let currentOffset = 0;
  let chartSlicesHtml = '';
  let legendItemsHtml = '';

  savedGoals.forEach(goal => {
    const share = goal.current / totalSaved;
    const strokeDash = share * circumference;
    const strokeDashOffset = circumference - strokeDash + currentOffset;

    // Accumulate offset for standard stacking layout rotation
    currentOffset -= strokeDash;

    // Segment slice
    chartSlicesHtml += `
      <circle class="pie-slice"
              cx="${center}" cy="${center}" r="${radius}"
              fill="transparent"
              stroke="var(--system-${goal.color})"
              stroke-width="${strokeWidth}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeDashOffset}"
              transform="rotate(-90 ${center} ${center})" />
    `;

    // Percentage key
    const sharePct = Math.round(share * 100);
    legendItemsHtml += `
      <div class="legend-item" style="font-size: 12px; display: flex; align-items: center; gap: 8px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--system-${goal.color})"></span>
        <span style="font-weight: 500; overflow:hidden; text-overflow:ellipsis; max-width:80px; white-space:nowrap;">${goal.name}</span>
        <span style="margin-left:auto; color:var(--text-muted); font-weight:600;">${sharePct}%</span>
      </div>
    `;
  });

  // Center metadata label inside the donut circle
  const currencySign = getCurrencySymbol(window.activeCurrencyCode);
  const formattedCenterSum = formatCompactCurrency(totalSaved);

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; width:100%; gap:24px;">
      <div style="position: relative; width: ${size}px; height: ${size}px; flex-shrink: 0;">
        <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%">
          <!-- Base background track circle -->
          <circle cx="${center}" cy="${center}" r="${radius}" fill="transparent" stroke="var(--border-light)" stroke-width="${strokeWidth}" />
          ${chartSlicesHtml}
        </svg>
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none;">
          <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:600; letter-spacing:0.5px;">Allocated</span>
          <span style="font-size:18px; font-weight:700; color:var(--text-primary); letter-spacing:-0.5px;">${formattedCenterSum}</span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0;">
        ${legendItemsHtml}
      </div>
    </div>
  `;
}

// Compact currency string helper (e.g. $12.5k, $900)
function formatCompactCurrency(value) {
  const currencySign = getCurrencySymbol(window.activeCurrencyCode);
  if (value >= 1000) {
    const kVal = (value / 1000).toFixed(1);
    return `${currencySign}${kVal.endsWith('.0') ? kVal.slice(0, -2) : kVal}k`;
  }
  return `${currencySign}${Math.round(value)}`;
}
