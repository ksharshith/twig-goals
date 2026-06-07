/* ====================================================
   STATE MANAGEMENT & DATA SYNC ENGINE
   ==================================================== */

import { supabase, isCloudDb } from '../config/supabase.js';

// Central application state
export let appState = {
  goals: [],
  transactions: [],
  currentTheme: 'dark',
  currentCurrency: 'USD',
  syncCode: ''
};

const STORAGE_KEY = 'aura_money_goals_state';
const listeners = [];

// Subscribe UI components to state updates
export function subscribe(callback) {
  listeners.push(callback);
}

// Notify all subscribers of a change
export function notify() {
  listeners.forEach(callback => callback());
}

// Generate device guest sync code
function generateUUID() {
  return 'aura-xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Initialize and load state
export async function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      appState = JSON.parse(stored);
      // Ensure default values exist
      if (!appState.goals) appState.goals = [];
      if (!appState.transactions) appState.transactions = [];
      if (!appState.currentTheme) appState.currentTheme = 'dark';
      if (!appState.currentCurrency) appState.currentCurrency = 'USD';
      if (!appState.syncCode) appState.syncCode = generateUUID();
    } catch (e) {
      console.error("Error parsing stored state, seeding database:", e);
      seedMockData();
    }
  } else {
    seedMockData();
  }

  // Save changes to ensure generated syncCode is cached
  saveState();

  // If cloud database is enabled, sync changes
  if (isCloudDb) {
    await syncDataFromCloud();
  } else {
    notify();
  }
}

// Save state to localStorage
export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Seed Demo Goals and Transactions
export function seedMockData() {
  const today = new Date();
  
  const getFutureDate = (monthsOffset) => {
    const d = new Date();
    d.setMonth(today.getMonth() + monthsOffset);
    return d.toISOString().split('T')[0];
  };

  appState.goals = [
    {
      id: 'mock-goal-1',
      name: 'MacBook Pro M4',
      target: 2499,
      current: 1750,
      deadline: getFutureDate(4),
      category: 'tech',
      color: 'blue'
    },
    {
      id: 'mock-goal-2',
      name: 'Japan Adventure 2027',
      target: 6000,
      current: 3200,
      deadline: getFutureDate(9),
      category: 'travel',
      color: 'purple'
    },
    {
      id: 'mock-goal-3',
      name: 'Emergency Fund',
      target: 10000,
      current: 8500,
      deadline: getFutureDate(14),
      category: 'savings',
      color: 'green'
    }
  ];

  appState.transactions = [
    {
      id: 'mock-tx-1',
      goal_id: 'mock-goal-1',
      goal_name: 'MacBook Pro M4',
      type: 'deposit',
      amount: 1750,
      timestamp: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-tx-2',
      goal_id: 'mock-goal-2',
      goal_name: 'Japan Adventure 2027',
      type: 'deposit',
      amount: 3200,
      timestamp: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-tx-3',
      goal_id: 'mock-goal-3',
      goal_name: 'Emergency Fund',
      type: 'deposit',
      amount: 8500,
      timestamp: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  if (!appState.syncCode) {
    appState.syncCode = generateUUID();
  }

  saveState();
}

// Reset data store
export async function resetDatabase() {
  appState.goals = [];
  appState.transactions = [];
  saveState();

  if (isCloudDb) {
    try {
      await supabase.from('goals').delete().eq('user_id', appState.syncCode);
      await supabase.from('transactions').delete().eq('user_id', appState.syncCode);
    } catch (e) {
      console.error("Error clearing Cloud database:", e);
    }
  }

  notify();
}

// Add or Edit Goal
export async function saveGoal(goalData) {
  let goal;
  if (goalData.id) {
    // Edit Mode
    const index = appState.goals.findIndex(g => g.id === goalData.id);
    if (index !== -1) {
      appState.goals[index] = { ...appState.goals[index], ...goalData };
      goal = appState.goals[index];
    }
  } else {
    // New Goal
    goal = {
      id: 'goal-' + Date.now(),
      current: 0,
      ...goalData
    };
    appState.goals.push(goal);
  }

  saveState();
  notify();

  // Sync to Cloud
  if (isCloudDb && goal) {
    try {
      await supabase.from('goals').upsert({
        id: goal.id,
        user_id: appState.syncCode,
        name: goal.name,
        target: goal.target,
        current: goal.current,
        deadline: goal.deadline,
        category: goal.category,
        color: goal.color
      });
    } catch (e) {
      console.error("Cloud DB Goal Sync Error:", e);
    }
  }
  
  return goal;
}

// Delete Goal and its transaction records
export async function deleteGoal(goalId) {
  appState.goals = appState.goals.filter(g => g.id !== goalId);
  appState.transactions = appState.transactions.filter(t => t.goal_id !== goalId);
  
  saveState();
  notify();

  if (isCloudDb) {
    try {
      await supabase.from('goals').delete().eq('id', goalId).eq('user_id', appState.syncCode);
      await supabase.from('transactions').delete().eq('goal_id', goalId).eq('user_id', appState.syncCode);
    } catch (e) {
      console.error("Cloud DB Goal Delete Error:", e);
    }
  }
}

// Add Contribution (Deposit / Withdrawal)
export async function logTransaction({ goalId, amount, type }) {
  const goal = appState.goals.find(g => g.id === goalId);
  if (!goal) return null;

  // Calculate adjusted current
  if (type === 'deposit') {
    goal.current += amount;
  } else {
    goal.current = Math.max(0, goal.current - amount);
  }

  const tx = {
    id: 'tx-' + Date.now(),
    goal_id: goalId,
    goal_name: goal.name,
    type,
    amount,
    timestamp: new Date().toISOString()
  };

  appState.transactions.unshift(tx);
  saveState();
  notify();

  // Cloud DB sync
  if (isCloudDb) {
    try {
      await supabase.from('goals').upsert({
        id: goal.id,
        user_id: appState.syncCode,
        name: goal.name,
        target: goal.target,
        current: goal.current,
        deadline: goal.deadline,
        category: goal.category,
        color: goal.color
      });

      await supabase.from('transactions').insert({
        id: tx.id,
        user_id: appState.syncCode,
        goal_id: tx.goal_id,
        goal_name: tx.goal_name,
        type: tx.type,
        amount: tx.amount,
        timestamp: tx.timestamp
      });
    } catch (e) {
      console.error("Cloud DB Transaction Sync Error:", e);
    }
  }

  return { goal, tx };
}

// Delete transaction (reversing amounts)
export async function deleteTransaction(txId) {
  const txIndex = appState.transactions.findIndex(t => t.id === txId);
  if (txIndex === -1) return;

  const tx = appState.transactions[txIndex];
  const goal = appState.goals.find(g => g.id === tx.goal_id);

  if (goal) {
    if (tx.type === 'deposit') {
      goal.current = Math.max(0, goal.current - tx.amount);
    } else {
      goal.current += tx.amount;
    }
  }

  appState.transactions.splice(txIndex, 1);
  saveState();
  notify();

  if (isCloudDb) {
    try {
      if (goal) {
        await supabase.from('goals').upsert({
          id: goal.id,
          user_id: appState.syncCode,
          name: goal.name,
          target: goal.target,
          current: goal.current,
          deadline: goal.deadline,
          category: goal.category,
          color: goal.color
        });
      }
      await supabase.from('transactions').delete().eq('id', txId).eq('user_id', appState.syncCode);
    } catch (e) {
      console.error("Cloud DB Transaction Delete Error:", e);
    }
  }
}

// Link Device using foreign sync code
export async function linkDevice(newSyncCode) {
  if (!newSyncCode || newSyncCode.trim() === '') return false;
  
  appState.syncCode = newSyncCode.trim();
  saveState();

  if (isCloudDb) {
    await syncDataFromCloud();
  } else {
    notify();
  }
  return true;
}

// Synchronize all data from Supabase PostgreSQL
export async function syncDataFromCloud() {
  if (!isCloudDb) return;
  
  // Dispatch custom event to notify UI sync status is in-progress
  window.dispatchEvent(new CustomEvent('aura-db-status', { detail: 'syncing' }));

  try {
    const { data: cloudGoals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', appState.syncCode);

    if (goalsError) throw goalsError;

    const { data: cloudTx, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', appState.syncCode)
      .order('timestamp', { ascending: false });

    if (txError) throw txError;

    // Update state cache with cloud data
    appState.goals = cloudGoals.map(g => ({
      id: g.id,
      name: g.name,
      target: parseFloat(g.target),
      current: parseFloat(g.current),
      deadline: g.deadline,
      category: g.category,
      color: g.color
    }));

    appState.transactions = cloudTx.map(t => ({
      id: t.id,
      goal_id: t.goal_id,
      goal_name: t.goal_name,
      type: t.type,
      amount: parseFloat(t.amount),
      timestamp: t.timestamp
    }));

    saveState();
    window.dispatchEvent(new CustomEvent('aura-db-status', { detail: 'online' }));
    notify();
  } catch (e) {
    console.error("Supabase pull synchronization failed:", e);
    window.dispatchEvent(new CustomEvent('aura-db-status', { detail: 'error' }));
    // Fall back to localStorage rendering
    notify();
  }
}

// Set application styling theme
export function setTheme(theme) {
  appState.currentTheme = theme;
  saveState();
  notify();
}

// Set currency parameter
export function setCurrency(currency) {
  appState.currentCurrency = currency;
  saveState();
  notify();
}
