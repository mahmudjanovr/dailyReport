import { api } from './api.js';

let activeHistoryModalReport = null;

export function initHistory() {
  const form = document.getElementById('historyFilterForm');
  const btnReset = document.getElementById('btnResetFilters');
  const modal = document.getElementById('reportDetailModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalDownloadPdf = document.getElementById('btnModalDownloadPdf');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      loadHistory();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      document.getElementById('filterFromDate').value = '';
      document.getElementById('filterToDate').value = '';
      document.getElementById('filterSearch').value = '';
      loadHistory();
    });
  }

  // Modal close handlers
  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (btnModalDownloadPdf) {
    btnModalDownloadPdf.addEventListener('click', () => {
      if (activeHistoryModalReport) {
        window.location.href = `/api/reports/${activeHistoryModalReport.id}/pdf`;
      }
    });
  }
}

export async function loadHistory() {
  const from = document.getElementById('filterFromDate')?.value || '';
  const to = document.getElementById('filterToDate')?.value || '';
  const search = document.getElementById('filterSearch')?.value || '';

  const tbody = document.getElementById('historyTableBody');
  const emptyState = document.getElementById('historyEmptyState');
  const totalCountEl = document.getElementById('historyTotalCount');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tarix yuklanmoqda...</td></tr>';
  }

  try {
    const res = await api.getReportHistory({ from, to, search, limit: 100 });
    const reports = res.data || [];

    if (totalCountEl) totalCountEl.textContent = String(res.totalCount || reports.length);

    if (reports.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (tbody) {
      tbody.innerHTML = reports
        .map((r) => {
          const createdFormatted = r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—';

          return `
          <tr data-report-id="${r.id}">
            <td><strong>${escapeHtml(r.report_date)}</strong></td>
            <td>${escapeHtml(r.operator_name)}</td>
            <td><strong style="color: var(--primary); font-family: var(--font-mono);">${r.total_count} ta</strong></td>
            <td><span class="badge-status ${r.status}">${r.status === 'submitted' ? 'Yuborilgan' : 'Qoralama'}</span></td>
            <td><span style="font-size: 0.75rem; color: var(--text-muted);">${createdFormatted}</span></td>
            <td class="text-right">
              <button type="button" class="btn btn-secondary btn-sm btn-view-report" data-id="${r.id}">Ko‘rish</button>
              <a href="/api/reports/${r.id}/pdf" class="btn btn-primary btn-sm" download title="PDF yuklab olish">PDF</a>
            </td>
          </tr>
        `;
        })
        .join('');

      tbody.querySelectorAll('.btn-view-report').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number.parseInt(btn.getAttribute('data-id'), 10);
          openReportDetail(id);
        });
      });
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center error">Tarixni yuklashda xatolik: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

async function openReportDetail(id) {
  const modal = document.getElementById('reportDetailModal');
  if (!modal) return;

  try {
    const res = await api.getReportById(id);
    const report = res.data;
    if (!report) return;

    activeHistoryModalReport = report;

    document.getElementById('modalTitle').textContent = `Hisobot — ${report.reportDate}`;
    document.getElementById('modalSubtitle').textContent = `Operator: ${report.operatorName} • ID: #${report.id}`;
    document.getElementById('modalOperator').textContent = report.operatorName;
    document.getElementById('modalDate').textContent = report.reportDate;
    document.getElementById('modalTotal').textContent = `${report.totalCount} ta`;

    const entriesBody = document.getElementById('modalEntriesBody');
    const entries = report.entries || [];
    const total = report.totalCount || 0;

    entriesBody.innerHTML = entries
      .map((e, idx) => {
        const count = Number(e.count) || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';

        return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(e.category_label)}</strong></td>
          <td><code>${escapeHtml(e.category_key)}</code></td>
          <td class="text-right"><strong>${count}</strong></td>
          <td class="text-right">${pct}</td>
        </tr>
      `;
      })
      .join('');

    modal.classList.remove('hidden');
  } catch (err) {
    alert(`Hisobotni ochishda xatolik: ${err.message}`);
  }
}

function closeModal() {
  const modal = document.getElementById('reportDetailModal');
  if (modal) modal.classList.add('hidden');
  activeHistoryModalReport = null;
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
