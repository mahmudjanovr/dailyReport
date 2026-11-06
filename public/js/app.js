/**
 * Master Application Bootstrap
 * Operator Daily Report — Vanilla ES Modules
 */

import { state } from './state.js';
import { api } from './api.js';
import { initDashboard, renderDashboard } from './dashboard.js';
import { initHistory, loadHistory } from './history.js';
import { initSettings, loadSettingsPage } from './settings.js';

function setupTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (!tabName) return;

      // Update tab active classes
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Update pane visibility
      panes.forEach((p) => p.classList.remove('active'));
      const activePane = document.getElementById(`pane-${tabName}`);
      if (activePane) {
        activePane.classList.add('active');
      }

      state.activeTab = tabName;

      // Trigger lazy loads
      if (tabName === 'history') {
        loadHistory();
      } else if (tabName === 'settings') {
        loadSettingsPage();
      } else if (tabName === 'dashboard') {
        renderDashboard();
      }
    });
  });
}

function setupTheme() {
  const toggleBtn = document.getElementById('themeToggle');

  // Apply stored theme
  document.documentElement.setAttribute('data-theme', state.theme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      state.setTheme(nextTheme);
    });
  }
}

function setupSaveStatusObserver() {
  const saveDot = document.getElementById('saveDot');
  const saveText = document.getElementById('saveText');

  state.subscribe((event, status) => {
    if (event !== 'save_status_changed') return;

    if (!saveDot || !saveText) return;

    if (status === 'saved') {
      saveDot.className = 'status-indicator-dot success';
      saveText.textContent = 'Saqlangan';
    } else if (status === 'saving') {
      saveDot.className = 'status-indicator-dot saving';
      saveText.textContent = 'Saqlanmoqda...';
    } else if (status === 'error') {
      saveDot.className = 'status-indicator-dot error';
      saveText.textContent = 'Xatolik (Qayta urinish)';
    }
  });
}

export function getTashkentDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

let isDayRolloverRunning = false;
export async function checkAndTriggerDayRollover() {
  if (isDayRolloverRunning) return;
  const currentTashkentDate = getTashkentDateString();
  if (state.currentReport && state.currentReport.reportDate && state.currentReport.reportDate !== currentTashkentDate) {
    isDayRolloverRunning = true;
    try {
      console.log(`[Day Rollover] New day detected (${currentTashkentDate}). Transitioning from ${state.currentReport.reportDate} to clean 0 counters.`);
      const res = await api.getTodayReport(state.operatorName);
      if (res.data) {
        state.setCurrentReport(res.data);
        state.setSaveStatus('saved');
      }
    } catch (err) {
      console.error('Failed to load new day report:', err);
    } finally {
      isDayRolloverRunning = false;
    }
  }
}

function updateLiveClock() {
  const dateEl = document.getElementById('headerDate');
  const timeEl = document.getElementById('headerTime');

  const now = new Date();
  const timeZone = 'Asia/Tashkent';

  try {
    const dateFormatter = new Intl.DateTimeFormat('uz-UZ', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    if (dateEl) dateEl.textContent = dateFormatter.format(now);
    if (timeEl) timeEl.textContent = timeFormatter.format(now);
  } catch {
    if (dateEl) dateEl.textContent = now.toLocaleDateString();
    if (timeEl) timeEl.textContent = now.toLocaleTimeString();
  }

  // Check if calendar day rolled over in Asia/Tashkent
  checkAndTriggerDayRollover();
}

async function boot() {
  setupTheme();
  setupTabs();
  setupSaveStatusObserver();

  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  window.addEventListener('focus', checkAndTriggerDayRollover);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndTriggerDayRollover();
    }
  });

  // Initialize submodules
  initDashboard();
  initHistory();
  initSettings();

  // Load initial application data
  try {
    // 1. Load active settings & operator name
    const settingsRes = await api.getSettings();
    if (settingsRes.data?.default_operator_name) {
      state.setOperatorName(settingsRes.data.default_operator_name);
    }

    // 2. Load today's report
    const todayRes = await api.getTodayReport(state.operatorName);
    if (todayRes.data) {
      state.setCurrentReport(todayRes.data);
      state.setSaveStatus('saved');
    }
  } catch (err) {
    console.error('Boot error:', err);
    state.setSaveStatus('error');
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
