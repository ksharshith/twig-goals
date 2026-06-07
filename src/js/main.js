/* ====================================================
   AURA MAIN CONTROLLER & USER INTERFACE BINDINGS
   ==================================================== */

import {
  appState,
  loadState,
  saveState,
  seedMockData,
  resetDatabase,
  saveGoal,
  deleteGoal,
  logTransaction,
  deleteTransaction,
  linkDevice,
  setTheme,
  setCurrency,
  subscribe
} from './core/state.js';

import { isCloudDb } from './config/supabase.js';

import {
  formatCurrency,
  getCurrencySymbol,
  generateSmartInsights
} from './core/insights.js';

import { renderRings } from './components/rings.js';
import { renderCharts } from './components/charts.js';
import { startConfetti, stopConfetti } from './components/confetti.js';

// Active UI states
let activeTabId = 'dashboard';
let activeFilter = 'all';
let activeDetailGoalId = null;

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Set window global currency code for charts modules
  window.activeCurrencyCode = appState.currentCurrency;
  
  // Register state change listener
  subscribe(renderApp);

  // Set up event listeners for static elements
  setupStaticEventListeners();

  // Load and sync cache state
  await loadState();

  // Set current date display
  initDateHeader();
});

// Update the header date
function initDateHeader() {
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    dateEl.innerText = new Date().toLocaleDateString('en-US', options);
  }
}

// ----------------------------------------------------
// UI RENDER LOOP (Main View Synchronizer)
// ----------------------------------------------------
function renderApp() {
  const state = appState;
  window.activeCurrencyCode = state.currentCurrency;

  // 1. Theme Configuration
  document.body.className = `theme-${state.currentTheme}`;
  const darkBtn = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');
  if (darkBtn && lightBtn) {
    if (state.currentTheme === 'dark') {
      darkBtn.classList.add('active');
      lightBtn.classList.remove('active');
    } else {
      lightBtn.classList.add('active');
      darkBtn.classList.remove('active');
    }
  }

  // 2. Currency symbol prefix inputs update
  const symbol = getCurrencySymbol(state.currentCurrency);
  document.querySelectorAll('.currency-label-sign').forEach(el => {
    el.innerText = `(${symbol})`;
  });

  // 3. Header and totals calculations
  const goals = state.goals;
  const transactions = state.transactions;

  const totalSaved = goals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target, 0);
  const remainingTarget = Math.max(0, totalTarget - totalSaved);
  const goalsCount = goals.length;

  // Sidebar widget update
  const sidebarTotalEl = document.getElementById('sidebar-total-savings');
  const sidebarProgressFill = document.getElementById('sidebar-progress-fill');
  const sidebarProgressLabel = document.getElementById('sidebar-progress-label');

  if (sidebarTotalEl) sidebarTotalEl.innerText = formatCurrency(totalSaved, state.currentCurrency);
  
  const totalProgressPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  if (sidebarProgressFill) sidebarProgressFill.style.width = `${Math.min(100, totalProgressPct)}%`;
  if (sidebarProgressLabel) {
    sidebarProgressLabel.innerText = `${Math.round(totalProgressPct)}% of total targets`;
  }

  // Dashboard Stats cards
  const totalSavedEl = document.getElementById('stat-total-saved');
  const totalTargetEl = document.getElementById('stat-total-target');
  const goalsCountEl = document.getElementById('stat-goals-count');
  const monthlyTargetEl = document.getElementById('stat-monthly-target');

  if (totalSavedEl) totalSavedEl.innerText = formatCurrency(totalSaved, state.currentCurrency);
  if (totalTargetEl) totalTargetEl.innerText = formatCurrency(remainingTarget, state.currentCurrency);
  if (goalsCountEl) goalsCountEl.innerText = goalsCount;

  // Calculate monthly pacing sum for active goals
  const today = new Date();
  let monthlyTargetSum = 0;
  goals.forEach(goal => {
    const remaining = Math.max(0, goal.target - goal.current);
    if (remaining > 0) {
      const days = Math.ceil((new Date(goal.deadline) - today) / (1000 * 60 * 60 * 24));
      const months = Math.max(0.1, days / 30.4);
      monthlyTargetSum += (remaining / months);
    }
  });
  if (monthlyTargetEl) monthlyTargetEl.innerText = formatCurrency(monthlyTargetSum, state.currentCurrency);

  // 4. Progress Rings & Charts
  renderRings(goals);
  renderCharts(goals);

  // 5. Smart Insights
  const insightsContainer = document.getElementById('insights-container');
  if (insightsContainer) {
    const insightsList = generateSmartInsights(goals, state.currentCurrency);
    insightsContainer.innerHTML = insightsList.map(insight => {
      let bgClass = '';
      if (insight.type === 'success') bgClass = 'color-green';
      if (insight.type === 'warning') bgClass = 'color-pink'; // using pink as warning accent
      if (insight.type === 'summary') bgClass = 'color-blue';

      return `
        <div class="insight-row ${bgClass}">
          <span class="insight-icon">${insight.icon}</span>
          <div class="insight-content">
            <p>${insight.text}</p>
            ${insight.meta ? `<span class="insight-meta">${insight.meta}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 6. Recent Logs table
  const tbody = document.getElementById('recent-activity-tbody');
  if (tbody) {
    if (transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">No transactions logged yet. Let's make a deposit!</td>
        </tr>
      `;
    } else {
      // Show latest 5 transactions
      tbody.innerHTML = transactions.slice(0, 5).map(tx => {
        const date = new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const sign = tx.type === 'deposit' ? '+' : '-';
        const amountClass = tx.type === 'deposit' ? 'deposit' : 'withdraw';
        const badgeClass = tx.type === 'deposit' ? 'deposit' : 'withdraw';
        const label = tx.type === 'deposit' ? 'Deposit' : 'Withdraw';

        return `
          <tr>
            <td>${date}</td>
            <td><strong>${tx.goal_name}</strong></td>
            <td><span class="tx-badge ${badgeClass}">${label}</span></td>
            <td><span class="tx-amount ${amountClass}">${sign}${formatCurrency(tx.amount, state.currentCurrency)}</span></td>
            <td>
              <button class="btn-icon-only" onclick="deleteTransaction('${tx.id}')" title="Delete record">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 7. Goals Grid Cards View
  renderGoalsGrid();

  // 8. Projection completion times frame inside Analytics view
  renderProjectionsList();

  // 9. Sync & Database Settings details
  const currencySelect = document.getElementById('settings-currency');
  if (currencySelect) currencySelect.value = state.currentCurrency;

  const syncCodeInput = document.getElementById('settings-sync-code');
  if (syncCodeInput) syncCodeInput.value = state.syncCode;

  // Render open modal if activeDetailGoalId is open
  if (activeDetailGoalId) {
    const goalExists = goals.some(g => g.id === activeDetailGoalId);
    if (goalExists) {
      updateGoalDetailModal(activeDetailGoalId);
    } else {
      closeGoalDetail();
    }
  }
}

// Draw Goals Card Grid in View Goals tab
function renderGoalsGrid() {
  const container = document.getElementById('goals-grid-container');
  if (!container) return;

  const goals = appState.goals;
  
  // Filter card lists
  let filtered = goals;
  if (activeFilter === 'active') {
    filtered = goals.filter(g => g.current < g.target);
  } else if (activeFilter === 'completed') {
    filtered = goals.filter(g => g.current >= g.target);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; padding: 40px 0;">
        No goals found for this filter. Click "Add Goal" to create one!
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(goal => {
    const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
    const isCompleted = goal.current >= goal.target;
    
    // Format deadline
    const deadlineStr = new Date(goal.deadline).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Resolve category emojis
    const emojiMap = {
      tech: '💻',
      travel: '✈️',
      savings: '🏦',
      car: '🚗',
      lifestyle: '☕',
      other: '🌟'
    };
    const emoji = emojiMap[goal.category] || '🌟';

    // Action button or completed badge
    const footerActionHtml = isCompleted
      ? `<span class="goal-completed-badge">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
             <polyline points="20 6 9 17 4 12" />
           </svg>
           Completed
         </span>`
      : `<button class="goal-btn-deposit" onclick="event.stopPropagation(); openDepositModal('${goal.id}')">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 12px; height: 12px">
             <line x1="12" y1="5" x2="12" y2="19" />
             <line x1="5" y1="12" x2="19" y2="12" />
           </svg>
           Log Savings
         </button>`;

    return `
      <div class="goal-card goal-${goal.color}" onclick="openGoalDetail('${goal.id}')">
        <div class="goal-card-header">
          <span class="goal-card-cat">${emoji}</span>
          <div class="goal-actions-dropdown">
            <button class="btn-icon-only" onclick="event.stopPropagation(); editGoal('${goal.id}')" title="Edit goal parameters">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="btn-icon-only" onclick="event.stopPropagation(); deleteGoalConfirm('${goal.id}')" title="Delete goal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        <div class="goal-card-body">
          <h3>${goal.name}</h3>
          <span class="goal-card-deadline">Target: ${deadlineStr}</span>
          
          <div class="goal-card-progress">
            <div class="progress-metrics">
              <span class="progress-saved">${formatCurrency(goal.current, appState.currentCurrency)}</span>
              <span class="progress-target">of ${formatCurrency(goal.target, appState.currentCurrency)}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
        <div class="goal-card-footer">
          <span class="progress-percentage">${pct}%</span>
          ${footerActionHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Draw ETA projection times frame list inside view-analytics
function renderProjectionsList() {
  const container = document.getElementById('projection-list');
  if (!container) return;

  const goals = appState.goals.filter(g => g.current < g.target);
  if (goals.length === 0) {
    container.innerHTML = `<div class="empty-state">No active goals tracked for projection.</div>`;
    return;
  }

  const today = new Date();

  container.innerHTML = goals.map(goal => {
    const remaining = goal.target - goal.current;
    
    // Compute deadline difference
    const days = Math.ceil((new Date(goal.deadline) - today) / (1000 * 60 * 60 * 24));
    const months = Math.max(0.1, days / 30.4);
    const monthlyRate = remaining / months;

    let timeframeHtml = '';
    if (days <= 0) {
      timeframeHtml = `<span class="proj-eta" style="color:var(--system-red); font-weight:600;">Deadline Passed</span>`;
    } else {
      timeframeHtml = `<span class="proj-eta">${Math.ceil(days)} days left (${(days/30.4).toFixed(1)} months)</span>`;
    }

    return `
      <div class="projection-row">
        <span class="proj-goal-name">${goal.name}</span>
        <div class="proj-stats">
          <span class="proj-rate">${formatCurrency(monthlyRate, appState.currentCurrency)}/mo</span>
          ${timeframeHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// EVENT LISTENERS & TAB ROUTING BINDINGS
// ----------------------------------------------------
function setupStaticEventListeners() {
  // Navigation sidebar item clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Action header "Add Goal"
  const addGoalBtn = document.getElementById('btn-add-goal');
  if (addGoalBtn) addGoalBtn.addEventListener('click', () => openGoalModal());

  // Filters within My Goals view
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderGoalsGrid();
    });
  });

  // Goal Form Submission
  const goalForm = document.getElementById('goal-form');
  if (goalForm) goalForm.addEventListener('submit', handleGoalSubmit);

  // Deposit Form Submission
  const depositForm = document.getElementById('deposit-form');
  if (depositForm) depositForm.addEventListener('submit', handleDepositSubmit);

  // Modal Cancel and Close handlers
  bindCloseClick('btn-close-goal-modal', closeGoalModal);
  bindCloseClick('btn-cancel-goal-modal', closeGoalModal);
  bindCloseClick('btn-close-deposit-modal', closeDepositModal);
  bindCloseClick('btn-cancel-deposit-modal', closeDepositModal);
  bindCloseClick('btn-close-detail-modal', closeGoalDetail);
  bindCloseClick('btn-close-celebration', closeCelebration);

  // Theme Settings Options
  const darkBtn = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');
  if (darkBtn) darkBtn.addEventListener('click', () => setTheme('dark'));
  if (lightBtn) lightBtn.addEventListener('click', () => setTheme('light'));

  // Currency Selector updates
  const currencySelect = document.getElementById('settings-currency');
  if (currencySelect) {
    currencySelect.addEventListener('change', () => {
      setCurrency(currencySelect.value);
    });
  }

  // Copy sync code
  const copyBtn = document.getElementById('btn-copy-sync-code');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const codeInput = document.getElementById('settings-sync-code');
      if (codeInput) {
        codeInput.select();
        document.execCommand('copy');
        copyBtn.innerText = 'Copied! ✓';
        setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
      }
    });
  }

  // Link external device code
  const linkBtn = document.getElementById('btn-link-device');
  if (linkBtn) {
    linkBtn.addEventListener('click', async () => {
      const codeInput = document.getElementById('settings-link-code');
      if (codeInput && codeInput.value.trim() !== '') {
        const success = await linkDevice(codeInput.value);
        if (success) {
          alert('Device code linked successfully. Cloud databases synced!');
          codeInput.value = '';
        } else {
          alert('Failed to link device code. Please check your connection.');
        }
      }
    });
  }

  // Database status badge listener
  window.addEventListener('aura-db-status', (e) => {
    const badge = document.getElementById('db-status-badge');
    if (!badge) return;

    const status = e.detail;
    badge.innerText = status;
    badge.className = ''; // Reset classes

    if (status === 'online') {
      badge.innerText = 'Cloud Synced';
      badge.style.backgroundColor = 'rgba(52, 199, 89, 0.12)';
      badge.style.color = 'var(--system-green)';
    } else if (status === 'syncing') {
      badge.innerText = 'Syncing...';
      badge.style.backgroundColor = 'rgba(255, 149, 0, 0.12)';
      badge.style.color = 'var(--system-orange)';
    } else if (status === 'error') {
      badge.innerText = 'Sync Error';
      badge.style.backgroundColor = 'rgba(255, 45, 85, 0.12)';
      badge.style.color = 'var(--system-red)';
    } else {
      badge.innerText = 'Local Storage (Offline)';
      badge.style.backgroundColor = 'var(--sidebar-active-bg)';
      badge.style.color = 'var(--text-secondary)';
    }
  });

  // Seed / Reset databases
  const seedBtn = document.getElementById('btn-seed-data');
  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset current records and restore demo goals data?')) {
        seedMockData();
      }
    });
  }

  const resetBtn = document.getElementById('btn-reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to wipe out all local and remote savings goals? This action is irreversible.')) {
        resetDatabase();
      }
    });
  }

  // Data Export / Import Buttons
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importBtn = document.getElementById('btn-import-data');
  const importInput = document.getElementById('import-file-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importData);
  }

  // Goal Details modal: add deposit action hook
  const detailAddDep = document.getElementById('btn-detail-add-deposit');
  if (detailAddDep) {
    detailAddDep.addEventListener('click', () => {
      if (activeDetailGoalId) {
        openDepositModal(activeDetailGoalId);
      }
    });
  }
}

// Router for tab layout viewports switching
function switchTab(tabId) {
  activeTabId = tabId;
  
  // Update nav highlights
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) activeNav.classList.add('active');

  // Update views visible displays
  document.querySelectorAll('.main-content .tab-view').forEach(view => {
    view.classList.remove('active');
  });
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add('active');

  // Page title update
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    const titles = {
      dashboard: 'Dashboard',
      goals: 'My Goals',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    titleEl.innerText = titles[tabId] || 'Dashboard';
  }

  // Toggle "Add Goal" visible display in header actions
  const addGoalBtn = document.getElementById('btn-add-goal');
  if (addGoalBtn) {
    if (tabId === 'settings' || tabId === 'analytics') {
      addGoalBtn.style.display = 'none';
    } else {
      addGoalBtn.style.display = 'inline-flex';
    }
  }

  renderApp();
}

// Click event helper
function bindCloseClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

// ----------------------------------------------------
// MODAL FORMS ACTIONS & LOGICS
// ----------------------------------------------------

// Goal Creation Dialog Modals
function openGoalModal(editGoalId = null) {
  const modal = document.getElementById('goal-modal');
  const form = document.getElementById('goal-form');
  if (!modal || !form) return;

  form.reset();

  if (editGoalId) {
    const goal = appState.goals.find(g => g.id === editGoalId);
    if (!goal) return;

    document.getElementById('goal-modal-title').innerText = 'Edit Goal';
    document.getElementById('goal-id').value = goal.id;
    document.getElementById('goal-name').value = goal.name;
    document.getElementById('goal-target').value = goal.target;
    document.getElementById('goal-current').value = goal.current;
    
    // Current is disabled during edit since transactions should alter it
    document.getElementById('goal-current').disabled = true;

    document.getElementById('goal-date').value = goal.deadline;
    document.getElementById('goal-category').value = goal.category;
    
    // Pre-select color circles
    const radios = document.getElementsByName('goal-color');
    radios.forEach(radio => {
      radio.checked = (radio.value === goal.color);
    });
  } else {
    document.getElementById('goal-modal-title').innerText = 'Create Goal';
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-current').disabled = false;
    
    // Default deadline to 6 months from today
    const sixMonthsFuture = new Date();
    sixMonthsFuture.setMonth(sixMonthsFuture.getMonth() + 6);
    document.getElementById('goal-date').value = sixMonthsFuture.toISOString().split('T')[0];
  }

  modal.classList.add('active');
  document.getElementById('goal-name').focus();
}

function closeGoalModal() {
  const modal = document.getElementById('goal-modal');
  if (modal) modal.classList.remove('active');
}

// Handles goal insertion/modification submissions
async function handleGoalSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('goal-id').value;
  const name = document.getElementById('goal-name').value;
  const target = parseFloat(document.getElementById('goal-target').value);
  const deadline = document.getElementById('goal-date').value;
  const category = document.getElementById('goal-category').value;
  
  // Handle start balance creation parameter
  const startSavingsInput = document.getElementById('goal-current');
  const current = startSavingsInput ? parseFloat(startSavingsInput.value || 0) : 0;

  // Selected accent color check
  let color = 'blue';
  const radios = document.getElementsByName('goal-color');
  for (const radio of radios) {
    if (radio.checked) {
      color = radio.value;
      break;
    }
  }

  // Update central state
  const goalObj = { name, target, deadline, category, color };
  if (id) {
    goalObj.id = id;
  } else {
    goalObj.current = current;
  }

  const saved = await saveGoal(goalObj);

  // If a new goal was created with starting savings, log a starting transaction record
  if (!id && current > 0 && saved) {
    await logTransaction({
      goalId: saved.id,
      amount: current,
      type: 'deposit'
    });
    
    // Auto start transaction writes in log if starting savings matches target
    if (current >= target) {
      triggerCelebration(name);
    }
  }

  closeGoalModal();
}

// Trigger confirm deletion
function deleteGoalConfirm(goalId) {
  const goal = appState.goals.find(g => g.id === goalId);
  if (goal && confirm(`Are you sure you want to delete "${goal.name}" and all of its associated transaction records?`)) {
    deleteGoal(goalId);
  }
}

// Deposit Contribution Dialog Modals
function openDepositModal(goalId) {
  const modal = document.getElementById('deposit-modal');
  const form = document.getElementById('deposit-form');
  const summaryEl = document.getElementById('deposit-goal-summary-text');
  
  const goal = appState.goals.find(g => g.id === goalId);
  if (!modal || !form || !goal) return;

  form.reset();
  
  document.getElementById('deposit-goal-id').value = goalId;
  if (summaryEl) {
    summaryEl.innerText = `Logging transaction for: ${goal.name}`;
  }

  modal.classList.add('active');
  
  const amtInput = document.getElementById('deposit-amount');
  if (amtInput) {
    amtInput.focus();
  }
}

function closeDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.remove('active');
}

// Handles log deposits contributions submissions
async function handleDepositSubmit(e) {
  e.preventDefault();

  const goalId = document.getElementById('deposit-goal-id').value;
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  const type = document.getElementById('deposit-type').value;

  const result = await logTransaction({ goalId, amount, type });
  closeDepositModal();

  if (result) {
    const { goal } = result;
    // Check if goal was just achieved (and is a deposit)
    if (type === 'deposit' && goal.current >= goal.target) {
      triggerCelebration(goal.name);
    }
  }
}

// ----------------------------------------------------
// GOALS HISTORY & DETAILS VIEWPORT DRAWER
// ----------------------------------------------------
function openGoalDetail(goalId) {
  const goal = appState.goals.find(g => g.id === goalId);
  if (!goal) return;

  activeDetailGoalId = goalId;
  updateGoalDetailModal(goalId);

  const modal = document.getElementById('goal-detail-modal');
  if (modal) modal.classList.add('active');
}

function closeGoalDetail() {
  activeDetailGoalId = null;
  const modal = document.getElementById('goal-detail-modal');
  if (modal) modal.classList.remove('active');
}

// Draw dynamic content in details drawer modal
function updateGoalDetailModal(goalId) {
  const goal = appState.goals.find(g => g.id === goalId);
  const heroArea = document.getElementById('detail-hero-area');
  const titleEl = document.getElementById('detail-modal-title');
  const logsContainer = document.getElementById('detail-logs-container');

  if (!goal || !heroArea || !titleEl || !logsContainer) return;

  titleEl.innerText = goal.name;

  // Calculate percentage and ETA rate pace
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const remaining = Math.max(0, goal.target - goal.current);
  
  const today = new Date();
  const days = Math.ceil((new Date(goal.deadline) - today) / (1000 * 60 * 60 * 24));
  const months = Math.max(0.1, days / 30.4);
  const monthlyRate = remaining > 0 ? (remaining / months) : 0;

  let projectionText = '';
  if (remaining === 0) {
    projectionText = 'Goal Fully Achieved! 🎉';
  } else if (days <= 0) {
    projectionText = 'Deadline Passed. Please adjust date settings.';
  } else {
    projectionText = `Pace: <strong>${formatCurrency(monthlyRate, appState.currentCurrency)}/mo</strong> to hit deadline in ${Math.round(days)} days.`;
  }

  // Draw Hero widget
  heroArea.innerHTML = `
    <div class="detail-hero-metrics" style="--goal-color-tint: var(--system-${goal.color})">
      <div>
        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight:600;">Current Savings</span>
        <span class="detail-hero-saved" style="color: var(--system-${goal.color}); display:block;">${formatCurrency(goal.current, appState.currentCurrency)}</span>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight:600;">Goal Target</span>
        <span class="detail-hero-target" style="display:block; font-weight:700; font-size:18px;">${formatCurrency(goal.target, appState.currentCurrency)}</span>
      </div>
    </div>
    
    <div class="progress-bar-track" style="height: 10px; margin-bottom: 12px;">
      <div class="progress-bar-fill" style="width: ${pct}%; background-color: var(--system-${goal.color}); box-shadow: 0 0 10px var(--system-${goal.color})"></div>
    </div>
    
    <span class="detail-hero-progress-label">${pct}% Saved — ${projectionText}</span>
  `;

  // Filter transaction logs relating to this specific goal
  const txs = appState.transactions.filter(t => t.goal_id === goalId);
  if (txs.length === 0) {
    logsContainer.innerHTML = `<div class="empty-state">No transaction logs logged for this goal yet.</div>`;
  } else {
    logsContainer.innerHTML = txs.map(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const sign = tx.type === 'deposit' ? '+' : '-';
      const typeClass = tx.type === 'deposit' ? 'deposit' : 'withdraw';
      const label = tx.type === 'deposit' ? 'Deposit' : 'Withdrawal';

      return `
        <div class="detail-log-row">
          <div class="detail-log-info">
            <span class="detail-log-type">${label}</span>
            <span class="detail-log-date">${date}</span>
          </div>
          <div class="detail-log-right">
            <span class="detail-log-amount ${typeClass}">${sign}${formatCurrency(tx.amount, appState.currentCurrency)}</span>
            <button class="btn-icon-only" onclick="deleteDetailTransaction('${tx.id}')" title="Delete log">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Delete transaction specifically from inside detailed view
function deleteDetailTransaction(txId) {
  if (confirm('Delete this contribution record? This will adjust the savings balance.')) {
    deleteTransaction(txId);
  }
}

// ----------------------------------------------------
// CELEBRATION MODAL OVERLAY TRIGGER
// ----------------------------------------------------
function triggerCelebration(goalName) {
  const overlay = document.getElementById('celebration-overlay');
  const textEl = document.getElementById('celebration-text');
  if (!overlay || !textEl) return;

  textEl.innerHTML = `You have successfully achieved your target savings for <strong>${goalName}</strong>!`;
  overlay.classList.add('active');
  startConfetti();
}

function closeCelebration() {
  const overlay = document.getElementById('celebration-overlay');
  if (overlay) overlay.classList.remove('active');
  stopConfetti();
}

// ----------------------------------------------------
// LOCAL FILE EXPORT / IMPORT BACKUPS
// ----------------------------------------------------
function exportData() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `aura_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(e) {
  if (!e.target.files || e.target.files.length === 0) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (imported.goals && Array.isArray(imported.goals)) {
        appState.goals = imported.goals;
        appState.transactions = imported.transactions || [];
        appState.currentTheme = imported.currentTheme || 'dark';
        appState.currentCurrency = imported.currentCurrency || 'USD';
        
        saveState();
        alert('Data backup imported successfully!');
        
        // Push full state updates to remote cloud databases if connected
        if (isCloudDb) {
          syncDataFromCloud();
        } else {
          renderApp();
        }
      } else {
        alert('Invalid backup file layout format.');
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing JSON backup file.');
    }
  };
  reader.readAsText(e.target.files[0]);
}

// ----------------------------------------------------
// GLOBAL SCOPE BINDINGS FOR HTML EVENT TARGETS
// ----------------------------------------------------
window.editGoal = openGoalModal;
window.deleteGoalConfirm = deleteGoalConfirm;
window.openDepositModal = openDepositModal;
window.deleteTransaction = (txId) => {
  if (confirm('Are you sure you want to delete this contribution log?')) {
    deleteTransaction(txId);
  }
};
window.openGoalDetail = openGoalDetail;
window.deleteDetailTransaction = deleteDetailTransaction;
window.closeGoalDetail = closeGoalDetail;
window.closeGoalModal = closeGoalModal;
window.closeDepositModal = closeDepositModal;
window.closeCelebration = closeCelebration;
window.switchTab = switchTab;
