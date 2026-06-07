/* ====================================================
   APPLE ACTIVITY RINGS COMPONENT
   ==================================================== */

const RINGS_CONFIG = [
  { id: 'apple-ring-1', circumference: 502.65 }, // Outer Ring (r=80)
  { id: 'apple-ring-2', circumference: 364.42 }, // Middle Ring (r=58)
  { id: 'apple-ring-3', circumference: 226.19 }  // Inner Ring (r=36)
];

// Renders concentric progress rings and active legends on dashboard panel
export function renderRings(goals) {
  const legendContainer = document.getElementById('rings-legend-list');
  if (!legendContainer) return;

  // Filter in-progress goals
  const activeGoals = goals
    .filter(g => g.current < g.target)
    .slice(0, 3); // Max 3 rings

  // If no active goals, reset rings and show empty state legend
  if (activeGoals.length === 0) {
    RINGS_CONFIG.forEach(ring => {
      const el = document.getElementById(ring.id);
      if (el) {
        el.style.strokeDashoffset = ring.circumference;
      }
    });

    legendContainer.innerHTML = `
      <div class="empty-state">
        <span>No active goals to display. Add goals to see progress rings!</span>
      </div>
    `;
    return;
  }

  // Bind up to 3 goals to concentric rings
  let legendHtml = '';
  
  RINGS_CONFIG.forEach((ring, index) => {
    const el = document.getElementById(ring.id);
    if (!el) return;

    if (index < activeGoals.length) {
      const goal = activeGoals[index];
      const pct = Math.min(1.0, Math.max(0, goal.current / goal.target));
      const strokeOffset = ring.circumference - (pct * ring.circumference);
      
      // Update SVG attributes and animate
      el.style.stroke = `url(#grad-${goal.color})`;
      el.style.strokeDashoffset = strokeOffset;

      // Calculate percentage string
      const pctString = Math.round(pct * 100) + '%';

      // Generate legend HTML with matching theme classes
      legendHtml += `
        <div class="legend-item" data-goal-id="${goal.id}">
          <span class="legend-dot" style="background: var(--system-${goal.color}); box-shadow: 0 0 8px var(--system-${goal.color})"></span>
          <span class="legend-name">${goal.name}</span>
          <span class="legend-percentage">${pctString}</span>
        </div>
      `;
    } else {
      // Hide or empty out unused inner rings
      el.style.strokeDashoffset = ring.circumference;
    }
  });

  legendContainer.innerHTML = legendHtml;
}
