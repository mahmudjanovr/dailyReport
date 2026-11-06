import { state } from './state.js';
import { api } from './api.js';
import { normalizeCategoryKey } from './categoryKey.js';

let debounceTimers = new Map();

export function initDashboard() {
  const btnDownloadPdf = document.getElementById('btnDownloadTodayPdf');
  const btnRefresh = document.getElementById('btnRefreshToday');

  setupAddCategoryModal();

  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
      window.location.href = '/api/reports/today/pdf';
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      try {
        const res = await api.getTodayReport(state.operatorName);
        if (res.data) {
          state.setCurrentReport(res.data);
          showToast('Ma‘lumotlar yangilandi', 'success');
        }
      } catch (err) {
        showToast(`Xatolik: ${err.message}`, 'error');
      } finally {
        btnRefresh.disabled = false;
      }
    });
  }

  // Subscribe to state changes to re-render
  state.subscribe((event, data) => {
    if (event === 'report_updated' || event === 'count_optimistic_updated' || event === 'count_rollback') {
      renderDashboard();
    }
    if (event === 'operator_changed') {
      updateWelcomeText();
    }
  });

  // Initial render
  renderDashboard();
}

export function updateWelcomeText() {
  const el = document.getElementById('welcomeOperator');
  if (el) {
    el.textContent = `Operator: ${state.operatorName || 'Rahmatillo'}`;
  }
}

export function renderDashboard() {
  const report = state.currentReport;
  if (!report) return;

  updateWelcomeText();

  // Update KPIs
  const kpiTotal = document.getElementById('kpiTotalCount');
  const kpiDate = document.getElementById('kpiReportDate');
  const lastSavedTime = document.getElementById('lastSavedTime');

  if (kpiTotal) kpiTotal.textContent = String(report.totalCount || 0);
  if (kpiDate) kpiDate.textContent = report.reportDate || '—';

  if (lastSavedTime && state.lastSavedAt) {
    const timeStr = state.lastSavedAt.toLocaleTimeString('en-GB', { hour12: false });
    lastSavedTime.textContent = `Oxirgi marta saqlandi: ${timeStr}`;
  }

  // Render Category Counter Cards
  const grid = document.getElementById('countersGrid');
  if (!grid) return;

  const entries = report.entries || [];
  const total = report.totalCount || 0;

  const badge = document.getElementById('dashCategoriesBadge');
  if (badge) {
    badge.textContent = `${entries.length} ta toifa`;
  }

  grid.innerHTML = entries
    .map((entry) => {
      const count = Number(entry.count) || 0;

      return `
      <div class="counter-row" data-cat-id="${entry.category_id}">
        <span class="counter-label">${escapeHtml(entry.category_label)}</span>

        <div class="counter-control-group">
          <button
            type="button"
            class="btn-counter btn-decrement"
            data-cat-id="${entry.category_id}"
            ${count <= 0 ? 'disabled' : ''}
            title="Kamaytirish (-1)"
            aria-label="${escapeHtml(entry.category_label)} kamaytirish"
          >-</button>

          <input
            type="number"
            min="0"
            step="1"
            class="counter-input"
            data-cat-id="${entry.category_id}"
            value="${count}"
            aria-label="${escapeHtml(entry.category_label)} miqdori"
          >

          <button
            type="button"
            class="btn-counter btn-increment"
            data-cat-id="${entry.category_id}"
            title="Qo‘shish (+1)"
            aria-label="${escapeHtml(entry.category_label)} qo‘shish"
          >+</button>
        </div>
      </div>
    `;
    })
    .join('');

  attachCounterListeners(grid);
}

function attachCounterListeners(container) {
  // Decrement buttons
  container.querySelectorAll('.btn-decrement').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = Number.parseInt(btn.getAttribute('data-cat-id'), 10);
      modifyCount(catId, -1);
    });
  });

  // Increment buttons
  container.querySelectorAll('.btn-increment').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = Number.parseInt(btn.getAttribute('data-cat-id'), 10);
      modifyCount(catId, 1);
    });
  });

  // Quick add pills
  container.querySelectorAll('.btn-quick-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = Number.parseInt(btn.getAttribute('data-cat-id'), 10);
      const addVal = Number.parseInt(btn.getAttribute('data-add'), 10) || 1;
      modifyCount(catId, addVal);
    });
  });

  // Numerical direct inputs
  container.querySelectorAll('.counter-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const catId = Number.parseInt(input.getAttribute('data-cat-id'), 10);
      let parsed = Number.parseInt(e.target.value, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        parsed = 0;
      }
      setCountDirect(catId, parsed);
    });

    // Select all on focus for quick overwrite
    input.addEventListener('focus', () => input.select());
  });
}

function modifyCount(categoryId, delta) {
  const report = state.currentReport;
  if (!report || !report.entries) return;

  const entry = report.entries.find((e) => e.category_id === categoryId);
  if (!entry) return;

  const oldCount = entry.count;
  const newCount = Math.max(0, oldCount + delta);
  if (newCount === oldCount) return;

  // Optimistic UI update
  state.updateCategoryCountOptimistic(categoryId, newCount);

  // Queue autosave
  queueEntrySave(categoryId, newCount, oldCount);
}

function setCountDirect(categoryId, newCount) {
  const report = state.currentReport;
  if (!report || !report.entries) return;

  const entry = report.entries.find((e) => e.category_id === categoryId);
  if (!entry) return;

  const oldCount = entry.count;
  const clamped = Math.max(0, newCount);

  // Optimistic UI update
  state.updateCategoryCountOptimistic(categoryId, clamped);

  // Debounced queue autosave
  queueEntrySave(categoryId, clamped, oldCount, 400);
}

function queueEntrySave(categoryId, count, originalCount, delayMs = 300) {
  state.setSaveStatus('saving');

  if (debounceTimers.has(categoryId)) {
    clearTimeout(debounceTimers.get(categoryId));
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(categoryId);

    try {
      const res = await api.saveEntry({
        reportId: state.currentReport.id,
        categoryId,
        count,
      });

      if (res.data) {
        state.setCurrentReport(res.data);
        state.setSaveStatus('saved');
      }
    } catch (err) {
      console.error('Failed to autosave counter:', err);
      // Rollback on server error
      state.rollbackCategoryCount(categoryId, originalCount);
      state.setSaveStatus('error');
      showToast(`Saqlashda xatolik: ${err.message}`, 'error');
    }
  }, delayMs);

  debounceTimers.set(categoryId, timer);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

export function openAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  const input = document.getElementById('inputCategoryLabel');
  const preview = document.getElementById('previewCategoryKey');
  const errorEl = document.getElementById('addCategoryError');
  const submitBtn = document.getElementById('btnAddCategorySubmit');

  if (!modal) return;

  if (input) input.value = '';
  if (preview) preview.textContent = '—';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Qo‘shish';
  }

  modal.classList.remove('hidden');
  setTimeout(() => input?.focus(), 50);
}

export function closeAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function setupAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  const form = document.getElementById('addCategoryForm');
  const input = document.getElementById('inputCategoryLabel');
  const preview = document.getElementById('previewCategoryKey');
  const errorEl = document.getElementById('addCategoryError');
  const closeBtn = document.getElementById('btnAddCategoryClose');
  const cancelBtn = document.getElementById('btnAddCategoryCancel');
  const submitBtn = document.getElementById('btnAddCategorySubmit');
  const openBtn = document.getElementById('btnOpenAddCategory');

  if (openBtn) {
    openBtn.addEventListener('click', openAddCategoryModal);
  }

  if (closeBtn) closeBtn.addEventListener('click', closeAddCategoryModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAddCategoryModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAddCategoryModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeAddCategoryModal();
    }
  });

  if (input) {
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
      }
      if (preview) {
        preview.textContent = val ? normalizeCategoryKey(val) || 'toifa' : '—';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawLabel = input.value;
      const label = rawLabel.trim();

      if (!label) {
        if (errorEl) {
          errorEl.textContent = 'Toifa nomi kiritilishi shart!';
          errorEl.classList.remove('hidden');
        }
        input.focus();
        return;
      }

      // Case-insensitive duplicate check against currently loaded categories
      const currentEntries = state.currentReport?.entries || [];
      const isDuplicate = currentEntries.some(
        (ent) => ent.category_label?.trim().toLowerCase() === label.toLowerCase()
      );
      if (isDuplicate) {
        if (errorEl) {
          errorEl.textContent = `"${label}" nomli toifa allaqachon mavjud!`;
          errorEl.classList.remove('hidden');
        }
        input.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Qo‘shilmoqda...';
      }

      try {
        const res = await api.createCategory({ label });
        closeAddCategoryModal();
        showToast(`Yangi toifa qo‘shildi: ${res.data?.label || label}`, 'success');

        // Immediately refresh today's report
        const todayRes = await api.getTodayReport(state.operatorName);
        if (todayRes.data) {
          state.setCurrentReport(todayRes.data);
        }
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || 'Toifani saqlashda xatolik yuz berdi';
          errorEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Qo‘shish';
        }
      }
    });
  }
}
