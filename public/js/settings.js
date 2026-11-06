import { api } from './api.js';
import { state } from './state.js';
import { openAddCategoryModal } from './dashboard.js';

let selectedBackupFile = null;
let pendingDeleteCat = null;

export function initSettings() {
  const operatorForm = document.getElementById('operatorSettingsForm');
  const inputOperator = document.getElementById('inputOperatorName');
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  const btnSelectFile = document.getElementById('btnSelectBackupFile');
  const fileInput = document.getElementById('backupFileInput');
  const btnExecuteRestore = document.getElementById('btnExecuteRestore');
  const selectedFileNameEl = document.getElementById('selectedFileName');
  const btnAddCatSettings = document.getElementById('btnOpenAddCategorySettings');

  if (btnAddCatSettings) {
    btnAddCatSettings.addEventListener('click', openAddCategoryModal);
  }

  setupDeleteCategoryModal();

  // Load operator name into input
  if (inputOperator) {
    inputOperator.value = state.operatorName || 'Rahmatillo';
  }

  // Operator name update
  if (operatorForm) {
    operatorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = inputOperator.value.trim();
      if (!newName) return;

      try {
        const res = await api.updateOperator(newName);
        if (res.data) {
          state.setOperatorName(res.data.operatorName);
          showToast('Operator ismi muvaffaqiyatli saqlandi', 'success');
        }
      } catch (err) {
        showToast(`Ismni saqlashda xatolik: ${err.message}`, 'error');
      }
    });
  }

  // Backup Download
  if (btnDownloadBackup) {
    btnDownloadBackup.addEventListener('click', () => {
      window.location.href = '/api/backup/download';
    });
  }

  // File Picker for Restore
  if (btnSelectFile && fileInput) {
    btnSelectFile.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        selectedBackupFile = file;
        if (selectedFileNameEl) {
          selectedFileNameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }
        if (btnExecuteRestore) btnExecuteRestore.disabled = false;
      }
    });
  }

  // Execute Restore
  if (btnExecuteRestore) {
    btnExecuteRestore.addEventListener('click', async () => {
      if (!selectedBackupFile) return;

      const confirmed = window.confirm(
        'DIQQAT! Ushbu zaxira faylidan tiklash joriy ma‘lumotlar bazasini almashtiradi. Davom etasizmi?'
      );
      if (!confirmed) return;

      btnExecuteRestore.disabled = true;
      btnExecuteRestore.textContent = '⏳ Tiklanmoqda...';

      try {
        const buffer = await selectedBackupFile.arrayBuffer();
        const res = await api.restoreBackup(buffer);

        showToast('Ma‘lumotlar bazasi zaxiradan muvaffaqiyatli qayta tiklandi!', 'success');

        // Re-load app state
        const reportRes = await api.getTodayReport();
        if (reportRes.data) {
          state.setCurrentReport(reportRes.data);
        }
        await loadSettingsPage();
      } catch (err) {
        showToast(`Tiklashda xatolik yuz berdi: ${err.message}`, 'error');
      } finally {
        btnExecuteRestore.disabled = false;
        btnExecuteRestore.textContent = '⚠️ Tanlangan zaxirani tiklash';
      }
    });
  }
}

export async function loadSettingsPage() {
  await Promise.all([
    loadCategoriesManager(),
    loadDiagnostics(),
  ]);

  const inputOperator = document.getElementById('inputOperatorName');
  if (inputOperator) {
    inputOperator.value = state.operatorName || 'Rahmatillo';
  }
}

async function loadCategoriesManager() {
  const container = document.getElementById('categoryToggleList');
  if (!container) return;

  try {
    const res = await api.getCategories(true); // get all active + inactive (non-deleted)
    const categories = res.data || [];

    const badge = document.getElementById('settingsCategoriesBadge');
    if (badge) {
      badge.textContent = `${categories.length} ta toifa`;
    }

    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-state-notice">Hozircha hech qanday toifa mavjud emas. Yuqoridagi "+ Yangi toifa" tugmasi orqali toifa qo‘shishingiz mumkin.</div>';
      return;
    }

    container.innerHTML = categories
      .map(
        (cat, idx) => `
        <div class="category-toggle-item" data-cat-id="${cat.id}">
          <div class="cat-toggle-info">
            <span class="counter-seq">${idx + 1}</span>
            <div>
              <span class="cat-toggle-title">${escapeHtml(cat.label)}</span>
              <span class="cat-toggle-code">(${escapeHtml(cat.key)})</span>
            </div>
          </div>

          <div class="cat-toggle-actions">
            <label class="switch" title="Ko‘rinishini o‘zgartirish">
              <input
                type="checkbox"
                class="cat-toggle-checkbox"
                data-cat-id="${cat.id}"
                ${cat.is_active === 1 ? 'checked' : ''}
              >
              <span class="slider"></span>
            </label>

            <button
              type="button"
              class="btn-delete-cat"
              data-cat-id="${cat.id}"
              data-cat-label="${escapeHtml(cat.label)}"
              title="Toifani o‘chirish"
              aria-label="${escapeHtml(cat.label)} toifasini o‘chirish"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      `
      )
      .join('');

    // Attach Toggle Listeners
    container.querySelectorAll('.cat-toggle-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const catId = Number.parseInt(checkbox.getAttribute('data-cat-id'), 10);
        checkbox.disabled = true;

        try {
          const res = await api.toggleCategory(catId);
          showToast(res.message || 'Toifa holati o‘zgartirildi', 'success');

          // Refresh today's report
          const todayRes = await api.getTodayReport(state.operatorName);
          if (todayRes.data) {
            state.setCurrentReport(todayRes.data);
          }
        } catch (err) {
          checkbox.checked = !checkbox.checked; // rollback switch
          showToast(`Toifani o‘zgartirishda xatolik: ${err.message}`, 'error');
        } finally {
          checkbox.disabled = false;
        }
      });
    });

    // Attach Delete Listeners
    container.querySelectorAll('.btn-delete-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = Number.parseInt(btn.getAttribute('data-cat-id'), 10);
        const catLabel = btn.getAttribute('data-cat-label') || 'toifa';
        openDeleteCategoryModal(catId, catLabel);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="error">Toifalarni yuklashda xatolik: ${escapeHtml(err.message)}</div>`;
  }
}

function setupDeleteCategoryModal() {
  const modal = document.getElementById('deleteCategoryModal');
  const btnClose = document.getElementById('btnDeleteCategoryClose');
  const btnCancel = document.getElementById('btnDeleteCategoryCancel');
  const btnConfirm = document.getElementById('btnDeleteCategoryConfirm');
  const labelEl = document.getElementById('deleteCategoryTargetLabel');
  const errEl = document.getElementById('deleteCategoryError');

  if (!modal || !btnConfirm) return;

  function closeModal() {
    modal.classList.add('hidden');
    pendingDeleteCat = null;
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'O‘chirish';
  }

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Confirm delete
  btnConfirm.addEventListener('click', async () => {
    if (!pendingDeleteCat) return;

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'O‘chirilmoqda...';
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }

    try {
      const res = await api.deleteCategory(pendingDeleteCat.id);
      showToast(res.message || 'Toifa muvaffaqiyatli o‘chirildi', 'success');

      closeModal();

      // Refresh categories manager and settings badge
      await loadCategoriesManager();

      // Refresh today's report and dashboard
      const todayRes = await api.getTodayReport(state.operatorName);
      if (todayRes.data) {
        state.setCurrentReport(todayRes.data);
      }
    } catch (err) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'O‘chirish';
      const msg = err.message || 'Toifani o‘chirishda xatolik yuz berdi';
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      showToast(`Xatolik: ${msg}`, 'error');
    }
  });
}

export function openDeleteCategoryModal(catId, catLabel) {
  const modal = document.getElementById('deleteCategoryModal');
  const labelEl = document.getElementById('deleteCategoryTargetLabel');
  const errEl = document.getElementById('deleteCategoryError');
  const btnConfirm = document.getElementById('btnDeleteCategoryConfirm');

  if (!modal) return;

  pendingDeleteCat = { id: catId, label: catLabel };

  if (labelEl) {
    labelEl.textContent = catLabel;
  }
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'O‘chirish';
  }

  modal.classList.remove('hidden');
}

async function loadDiagnostics() {
  try {
    const res = await api.getDiagnostics();
    const stats = res.data;
    if (!stats) return;

    const elSize = document.getElementById('diagDbSize');
    const elReports = document.getElementById('diagReportsCount');
    const elCalls = document.getElementById('diagTotalCalls');
    const elUptime = document.getElementById('diagUptime');

    if (elSize) {
      const kb = (stats.dbSizeBytes / 1024).toFixed(1);
      elSize.textContent = `${kb} KB`;
    }
    if (elReports) elReports.textContent = String(stats.reportsCount);
    if (elCalls) elCalls.textContent = String(stats.totalCalls);
    if (elUptime) {
      const mins = Math.floor(stats.uptimeSeconds / 60);
      const secs = stats.uptimeSeconds % 60;
      elUptime.textContent = `${mins}m ${secs}s`;
    }
  } catch (err) {
    console.error('Diagnostics load error:', err);
  }
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
