/**
 * API client module for Operator Daily Report
 */

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;

  const defaultHeaders = {
    Accept: 'application/json',
  };

  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    throw new ApiError('Server bilan ulanishda tarmoq xatosi (Network Error)', 0, netErr);
  }

  // Handle binary streams like PDF or SQLite
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/x-sqlite3')) {
    if (!response.ok) {
      throw new ApiError(`Faylni yuklab bo‘lmadi (HTTP ${response.status})`, response.status);
    }
    return response.blob();
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Xatolik yuz berdi (HTTP ${response.status})`;
    throw new ApiError(errorMsg, response.status, data?.error?.details);
  }

  return data;
}

export const api = {
  // Health
  getHealth: () => request('/api/health'),

  // Categories
  getCategories: (includeInactive = false) =>
    request(`/api/categories${includeInactive ? '?all=true' : ''}`),
  createCategory: (data) =>
    request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleCategory: (id) =>
    request(`/api/categories/${id}/toggle`, { method: 'PATCH' }),
  deleteCategory: (id) =>
    request(`/api/categories/${id}`, { method: 'DELETE' }),

  // Reports
  getTodayReport: (operator = null) =>
    request(`/api/reports/today${operator ? `?operator=${encodeURIComponent(operator)}` : ''}`),
  saveEntry: ({ reportId, categoryId, count, notes = null }) =>
    request('/api/reports/entry', {
      method: 'POST',
      body: JSON.stringify({
        report_id: reportId,
        category_id: categoryId,
        count,
        notes,
      }),
    }),
  saveReport: (reportData) =>
    request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    }),
  getReportHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);
    return request(`/api/reports/history?${query.toString()}`);
  },
  getReportById: (id) => request(`/api/reports/${id}`),

  // Settings
  getSettings: () => request('/api/settings'),
  updateOperator: (operatorName) =>
    request('/api/settings/operator', {
      method: 'PATCH',
      body: JSON.stringify({ operator_name: operatorName }),
    }),
  getDiagnostics: () => request('/api/settings/diagnostics'),

  // Backup & Restore
  restoreBackup: (bufferOrBlob) =>
    request('/api/backup/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sqlite3',
      },
      body: bufferOrBlob,
    }),
};
