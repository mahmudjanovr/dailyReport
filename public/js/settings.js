import { api } from './api.js';
import { state } from './state.js';

let selectedBackupFile = null;

export function initSettings() {
  const operatorForm = document.getElementById('operatorSettingsForm');
  const inputOperator = document.getElementById('inputOperatorName');
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  const btnSelectFile = document.getElementById('btnSelectBackupFile');
  const fileInput = document.getElementById('backupFileInput');
  const btnExecuteRestore = document.getElementById('btnExecuteRestore');
  const selectedFileNameEl = document.getElementById('selectedFileName');

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
    const res = await api.getCategories(true); // get all including inactive
    const categories = res.data || [];

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

          <label class="switch" title="Ko‘rinishini o‘zgartirish">
            <input
              type="checkbox"
              class="cat-toggle-checkbox"
              data-cat-id="${cat.id}"
              ${cat.is_active === 1 ? 'checked' : ''}
            >
            <span class="slider"></span>
          </label>
        </div>
      `
      )
      .join('');

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
  } catch (err) {
    container.innerHTML = `<div class="error">Toifalarni yuklashda xatolik: ${escapeHtml(err.message)}</div>`;
  }
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
