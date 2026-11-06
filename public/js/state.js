/**
 * State store for Operator Daily Report
 */

class AppState {
  constructor() {
    this.currentReport = null;
    this.categories = [];
    this.allCategories = [];
    this.operatorName = 'Rahmatillo';
    this.saveStatus = 'saved'; // 'saved' | 'saving' | 'error'
    this.lastSavedAt = null;
    this.activeTab = 'dashboard';
    this.theme = localStorage.getItem('odr_theme') || 'light';
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, data) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data, this);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('odr_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify('theme_changed', theme);
  }

  setSaveStatus(status) {
    this.saveStatus = status;
    if (status === 'saved') {
      this.lastSavedAt = new Date();
    }
    this.notify('save_status_changed', status);
  }

  setOperatorName(name) {
    this.operatorName = name;
    this.notify('operator_changed', name);
  }

  setCurrentReport(report) {
    this.currentReport = report;
    if (report?.operatorName) {
      this.operatorName = report.operatorName;
    }
    this.notify('report_updated', report);
  }

  updateCategoryCountOptimistic(categoryId, newCount) {
    if (!this.currentReport || !this.currentReport.entries) return;

    const entry = this.currentReport.entries.find((e) => e.category_id === categoryId);
    if (!entry) return;

    const oldCount = entry.count;
    entry.count = Math.max(0, newCount);

    // Recalculate client total optimistically
    this.currentReport.totalCount = this.currentReport.entries.reduce(
      (sum, item) => sum + (Number(item.count) || 0),
      0
    );

    this.notify('count_optimistic_updated', { categoryId, newCount, oldCount });
  }

  rollbackCategoryCount(categoryId, originalCount) {
    if (!this.currentReport || !this.currentReport.entries) return;

    const entry = this.currentReport.entries.find((e) => e.category_id === categoryId);
    if (entry) {
      entry.count = originalCount;
      this.currentReport.totalCount = this.currentReport.entries.reduce(
        (sum, item) => sum + (Number(item.count) || 0),
        0
      );
      this.notify('count_rollback', { categoryId, originalCount });
    }
  }
}

export const state = new AppState();
