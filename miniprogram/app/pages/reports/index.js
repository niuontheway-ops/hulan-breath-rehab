const { reports } = require('../../utils/reports');
const { refresh, notice, today } = require('../../utils/presentation');

Page({
  data: { senior: false, reducedMotion: false, storageError: '', reportError: '', items: [], busy: false },
  onLoad() { this._alive = true; },
  onShow() { this._alive = true; refresh(this); this.refreshReports(); },
  onUnload() { this._alive = false; reports.cancelPending(); },
  refreshReports() {
    const result = reports.list();
    this.setData({ reportError: result.ok ? '' : result.message, items: result.items.map(item => ({ id: item.id, name: item.name, typeLabel: item.type === 'pdf' ? 'PDF' : '图片', sizeLabel: item.size < 1024 * 1024 ? Math.ceil(item.size / 1024) + ' KB' : (item.size / 1024 / 1024).toFixed(1) + ' MB', dateLabel: today(item.createdAt) })) });
  },
  async add(event) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    const result = await reports.chooseAndAdd(event.currentTarget.dataset.kind);
    if (!this._alive) return;
    this.setData({ busy: false }); this.refreshReports();
    if (result.ok) wx.showToast({ title: '已保存到本机', icon: 'success' });
    else notice(result.message, '材料未保存');
  },
  async view(event) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    const result = await reports.view(event.currentTarget.dataset.id);
    if (!this._alive) return;
    this.setData({ busy: false });
    if (!result.ok) notice(result.message, '暂时无法查看');
  },
  async remove(event) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    const result = await reports.remove(event.currentTarget.dataset.id);
    if (!this._alive) return;
    this.setData({ busy: false }); this.refreshReports();
    if (result.ok) wx.showToast({ title: '已删除本机副本', icon: 'success' });
    else if (!result.cancelled) notice(result.message, '删除未完成');
  },
  openAssessment() { wx.navigateTo({ url: '/pages/assessment/index' }); },
  openSettings() { wx.navigateTo({ url: '/pages/settings/index' }); },
});
