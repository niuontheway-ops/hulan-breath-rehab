const QUESTIONS = [
  { key: 'chestPain', label: '现在有胸痛吗？' },
  { key: 'severeBreathlessness', label: '气促到难以说完整句子吗？' },
  { key: 'fainting', label: '现在有晕厥或接近晕倒吗？' },
  { key: 'hemoptysis', label: '现在有咯血吗？' },
  { key: 'dizziness', label: '现在有头晕吗？' },
  { key: 'worseSymptoms', label: '今天的症状比平常更差吗？' },
  { key: 'clinicianCleared', label: '医护已允许目前的轻量居家训练吗？' },
];
const MESSAGES = ['很好，保持舒适的节奏。', '慢慢来，随时可以休息。', '这一轮结束后，先感受一下身体。', '身体舒适，比完成数字更重要。'];
const MODES = [
  { id: 'demonstration', label: '跟着示范' },
  { id: 'stairs', label: '想象台阶' },
  { id: 'meadow', label: '草地慢行' },
];
const clone = value => JSON.parse(JSON.stringify(value));
const emptyChecks = () => QUESTIONS.reduce((result, item) => { result[item.key] = null; return result; }, {});
const chinaDay = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
const urgentMessage = '立即停止，获得医疗帮助。持续胸痛、严重气促、晕厥或明显咯血时拨打 120；不要依靠训练处理急性症状。';

function deriveTrainingView(frame, mode, reducedMotion, game, meditation) {
  const pose = game.getPatientAnimationFrame(frame, { reducedMotion });
  const scene = meditation.getMeditationFrame(frame, mode, { reducedMotion });
  const running = frame.status === 'running';
  const awaiting = frame.status === 'awaiting-confirmation';
  const paused = frame.status === 'paused';
  const complete = frame.status === 'completed';
  const stopped = frame.status === 'stopped';
  const phaseLabel = paused ? '已暂停' : awaiting ? '这一轮舒服吗？' : complete ? '本次引导已结束' : stopped ? '已停止' : frame.phase === 'inhale' ? '轻柔吸气' : frame.phase === 'exhale' ? '缓慢呼气' : '先坐稳，放松肩部';
  const phaseHint = awaiting ? '身体舒适，再确认这一轮；有不适请停止。' : paused ? '休息一下，重新确认状态后再继续。' : complete ? '谢谢你的认真练习，先休息一会儿。' : stopped ? '先恢复自然呼吸，不必追赶进度。' : frame.phase === 'inhale' ? '轻柔鼻吸，不追求深吸。' : frame.phase === 'exhale' ? '嘴唇轻拢，慢慢呼气，不强吹。' : '按医护确认的安排练习，不屏息。';
  const totalSteps = frame.totalCycles * (mode === 'stairs' ? 3 : 6);
  const distanceRatio = reducedMotion ? 0 : Math.min(1, scene.position / Math.max(1, totalSteps));
  const stride = reducedMotion ? 0 : Math.sin(scene.stride * Math.PI * 2);
  const movement = reducedMotion ? 0 : pose.breathLevel;
  const lipRoundness = reducedMotion ? 0 : pose.lipRoundness;
  const lipOpening = reducedMotion ? 0.8 : pose.lipOpening;
  return {
    running, awaiting, paused, complete, stopped, hasSession: frame.status !== 'idle', phaseLabel, phaseHint,
    phaseSeconds: running || paused ? String(Math.max(1, Math.ceil(frame.remainingMs / 1000))) : '—',
    completedCycles: frame.completedCycles, totalCycles: frame.totalCycles,
    guidanceSeconds: Math.round(frame.activeGuidanceSeconds),
    progressPercent: Math.round(frame.completedCycles / frame.totalCycles * 100),
    encouragement: MESSAGES[frame.completedCycles % MESSAGES.length],
    ringStyle: 'transform:scale(' + (1 + movement * 0.19).toFixed(3) + ')',
    bellyStyle: 'transform:scaleX(' + pose.abdomenScaleX.toFixed(3) + ') scaleY(' + pose.abdomenScaleY.toFixed(3) + ')',
    handStyle: 'transform:translate(' + (movement * 15).toFixed(2) + 'rpx,' + (movement * -3).toFixed(2) + 'rpx)',
    forearmStyle: 'transform:rotate(' + (-10 - movement * 3).toFixed(2) + 'deg) scaleX(' + (1 + movement * 0.05).toFixed(3) + ')',
    chestStyle: 'transform:translateX(' + pose.chestHandOffsetX.toFixed(2) + 'rpx)',
    mouthStyle: 'width:' + (22 - lipRoundness * 11).toFixed(2) + 'rpx;height:' + (3 + lipOpening * 1.6).toFixed(2) + 'rpx;border-radius:' + (3 + lipRoundness * 7).toFixed(2) + 'rpx',
    inhale: frame.phase === 'inhale', exhale: frame.phase === 'exhale',
    imagineCount: Math.floor(scene.position),
    markerStyle: 'left:' + (17 + distanceRatio * 64).toFixed(2) + '%;bottom:' + (mode === 'stairs' ? 12 + distanceRatio * 57 : 24 + distanceRatio * 3).toFixed(2) + '%',
    leftLegStyle: 'transform:rotate(' + (stride * 18).toFixed(2) + 'deg)',
    rightLegStyle: 'transform:rotate(' + (-stride * 18).toFixed(2) + 'deg)',
    modeInstruction: mode === 'stairs' ? '吸气想象上 1 级，呼气想象上 2 级。' : '吸气 2 秒想象走 2 步，呼气 4 秒想象走 4 步。',
    motionLabel: reducedMotion ? '减少动效已开启：画面保持静止，按文字节拍练习。' : '动作是引导示意，不代表测到了你的呼吸或步数。',
  };
}

function createTrainingPage({ store, clinical, daily, game, meditation, platform, now = Date.now, schedule = setInterval, cancel = clearInterval }) {
  return {
    data: {
      senior: false, reducedMotion: false, mode: 'demonstration', modes: clone(MODES),
      precheckOpen: true, needsPrecheck: true, questions: QUESTIONS.map(item => ({ ...item, value: null })),
      precheckIndex: 0, precheckTotal: QUESTIONS.length, precheckCount: 0, precheckQuestion: { ...QUESTIONS[0], value: null },
      gateAllowed: false, gateUrgent: false, gateTitle: '先完成健康评估', gateMessage: '训练前先核对状态。',
      hasProfile: false, storageUnavailable: false, hasUnsaved: false, saved: false, saveMessage: '', urgentBanner: '',
      running: false, paused: false, awaiting: false, complete: false, stopped: false, hasSession: false,
      phaseLabel: '先坐稳，放松肩部', phaseHint: '按医护确认的安排练习，不屏息。', phaseSeconds: '—',
      completedCycles: 0, totalCycles: 20, guidanceSeconds: 0, progressPercent: 0,
      encouragement: MESSAGES[0], ringStyle: 'transform:scale(1)', bellyStyle: 'transform:scale(1)',
      handStyle: 'transform:translate(0,0)', chestStyle: 'transform:translateX(0)', forearmStyle: 'transform:rotate(-10deg)',
      mouthStyle: 'width:22rpx;height:4rpx;border-radius:3rpx', markerStyle: 'left:17%;bottom:24%',
      leftLegStyle: 'transform:rotate(0deg)', rightLegStyle: 'transform:rotate(0deg)', imagineCount: 0,
      steps: Array.from({ length: 8 }, (_, index) => ({ id: index, style: 'left:' + (13 + index * 9) + '%;bottom:' + (8 + index * 8) + '%' })),
      grasses: Array.from({ length: 9 }, (_, index) => ({ id: index, style: 'left:' + (4 + index * 11) + '%;bottom:' + (6 + index % 3 * 5) + '%' })),
      motionLabel: '动作是引导示意，不代表测到了你的呼吸或步数。', modeInstruction: '',
    },
    onLoad() {
      this._visible = true;
      this._checks = emptyChecks();
      this._precheckValid = false;
      this._timer = null;
      this._session = null;
      this._pendingSummary = null;
      this._finishedId = null;
      this._storageEpoch = null;
    },
    onShow() {
      this._visible = true;
      this._stopTimer();
      if (this._session) this._session.pause('page-hidden');
      this._resetChecks();
      this._refreshGate();
      if (this._session) this._applyFrame(this._session.getState());
    },
    onHide() {
      this._visible = false;
      this._stopTimer();
      if (this._session) { this._session.pause('page-hidden'); this._applyFrame(this._session.getState()); }
      this._resetChecks();
      this._keepScreen(false);
    },
    onUnload() {
      this._visible = false;
      this._stopTimer();
      if (this._session) this._session.pause('page-unloaded');
      this._precheckValid = false;
      this._keepScreen(false);
    },
    _keepScreen(value) { if (platform && platform.setKeepScreenOn) platform.setKeepScreenOn({ keepScreenOn: value, fail() {} }); },
    _stopTimer() { if (this._timer !== null) { cancel(this._timer); this._timer = null; } },
    _resetChecks() {
      this._checks = emptyChecks(); this._precheckValid = false;
      this.setData({ needsPrecheck: true, precheckOpen: true, questions: QUESTIONS.map(item => ({ ...item, value: null })), precheckIndex: 0, precheckCount: 0, precheckQuestion: { ...QUESTIONS[0], value: null } });
    },
    _contextMatches(loaded) {
      if (!loaded.ok) return false;
      const epoch = typeof store.getEpoch === 'function' ? store.getEpoch() : 0;
      return this._storageEpoch === epoch && JSON.stringify(loaded.state.profile) === this._profileKey
        && clinical.createPlan(loaded.state.profile, new Date(now())).status === 'ready';
    },
    _invalidateSession(message) {
      this._stopTimer();
      if (this._session) this._session.pause('records-changed');
      this._session = null; this._pendingSummary = null; this._finishedId = null;
      this._sessionId = null; this._startedAt = null; this._storageEpoch = null; this._profileKey = null;
      this._resetChecks(); this._keepScreen(false);
      this.setData({ running: false, paused: false, awaiting: false, complete: false, stopped: false, hasSession: false, saved: false, hasUnsaved: false, saveMessage: message, guidanceSeconds: 0, completedCycles: 0, progressPercent: 0, phaseLabel: '先重新核对评估', phaseHint: '先前的引导已取消，不会重新写回本机记录。', phaseSeconds: '—' });
    },
    _refreshGate() {
      const loaded = store.load();
      if (!loaded.ok) {
        if (this._session || this._pendingSummary) this._invalidateSession('本机记录暂不可用，先前的引导已取消，未重新保存。请先核对本机数据。');
        this.setData({ gateAllowed: false, hasProfile: false, storageUnavailable: true, gateUrgent: false, gateTitle: '手机记录暂不可用', gateMessage: loaded.message || '请先到“我的记录”核对本机数据，暂不开放训练。' });
        return false;
      }
      const state = loaded.state;
      this.setData({ senior: state.settings.senior === true, reducedMotion: state.settings.reducedMotion === true, hasProfile: !!state.profile, storageUnavailable: false });
      const plan = clinical.createPlan(state.profile, new Date(now()));
      this._plan = plan;
      if ((this._session || this._pendingSummary) && !this._contextMatches(loaded)) {
        this._invalidateSession('评估或本机记录已改变，先前的引导已取消，不会重新保存。');
        this.setData({ gateAllowed: false, gateUrgent: plan.status === 'urgent', gateTitle: '评估资料或本机记录已改变', gateMessage: '请先核对新的评估结果，再重新开始。先前的记录不会被重新写回。', needsPrecheck: true, precheckOpen: true });
        return false;
      }
      if (plan.status !== 'ready') {
        this.setData({ gateAllowed: false, gateUrgent: plan.status === 'urgent', gateTitle: state.profile ? plan.title : '先完成健康评估', gateMessage: state.profile ? plan.reasons.join('；') || plan.subtitle : '填写年龄、已诊断疾病与当前状态后，再核对适合的练习。' });
        return false;
      }
      const records = Array.isArray(state.daily) ? state.daily.filter(record => record.day === chinaDay(now())) : [];
      for (const record of records) {
        const assessment = daily.evaluateDailyRecord(record);
        if (assessment.status === 'urgent' || assessment.status === 'review') {
          this.setData({ gateAllowed: false, gateUrgent: assessment.status === 'urgent', gateTitle: assessment.title, gateMessage: assessment.message + (assessment.reasons.length ? ' ' + assessment.reasons.join('；') : '') });
          return false;
        }
      }
      this.setData({ gateAllowed: true, gateUrgent: false, gateTitle: '按已确认的轻量安排练习', gateMessage: '坐稳或舒适躺好，先确认此刻的状态。', totalCycles: this._session ? this._session.getState().totalCycles : plan.breathing.cycles });
      return true;
    },
    _validateChecks() {
      if (['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis'].some(key => this._checks[key] === true)) return { allowed: false, status: 'urgent', message: urgentMessage };
      if (QUESTIONS.some(item => typeof this._checks[item.key] !== 'boolean')) return { allowed: false, status: 'incomplete', message: '请逐项确认此刻的状态；每项都需要选择。' };
      return clinical.assessTrainingReadiness(this._checks);
    },
    _tell(message, urgent) {
      this.setData({ urgentBanner: message });
      if (platform && platform.showModal) platform.showModal({ title: urgent ? '立即停止训练' : '先核对状态', content: message, showCancel: false });
    },
    onPrecheckChange(event) {
      const key = event.currentTarget.dataset.key;
      if (!QUESTIONS.some(item => item.key === key)) return;
      if (!['yes', 'no'].includes(event.detail.value)) return;
      this._checks[key] = event.detail.value === 'yes'; this._precheckValid = false;
      const questions = QUESTIONS.map(item => ({ ...item, value: this._checks[item.key] }));
      const index = QUESTIONS.findIndex(item => item.key === key);
      const risk = key !== 'clinicianCleared' && this._checks[key] === true || key === 'clinicianCleared' && this._checks[key] === false;
      const nextIndex = risk ? index : Math.min(QUESTIONS.length - 1, index + 1);
      this.setData({ questions, needsPrecheck: true, precheckCount: questions.filter(item => typeof item.value === 'boolean').length, precheckIndex: nextIndex, precheckQuestion: questions[nextIndex] });
      if (risk) {
        this._haltForGate();
        const urgent = ['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis'].includes(key);
        this._tell(urgent ? urgentMessage : key === 'clinicianCleared' ? '先请医护评估并允许目前的轻量居家训练。' : '现在有头晕或症状加重，请停止训练并联系医护评估。', urgent);
      }
    },
    onPrecheckBack() {
      const index = Math.max(0, this.data.precheckIndex - 1);
      this.setData({ precheckIndex: index, precheckQuestion: this.data.questions[index] });
    },
    onModeChange(event) {
      const mode = event.currentTarget.dataset.mode;
      if (!MODES.some(item => item.id === mode)) return;
      if (this._session && !['completed', 'stopped'].includes(this._session.getState().status)) {
        this._tell('先结束当前引导，再切换场景。', false); return;
      }
      this.setData({ mode });
      if (this._session) this._applyFrame(this._session.getState());
    },
    onStart() {
      if (!this._visible) return;
      if (this.data.hasUnsaved) { this._tell('上一次记录尚未保存，请先重试保存。', false); return; }
      if (!this._refreshGate()) { this._haltForGate(); return; }
      const readiness = this._validateChecks();
      if (!readiness.allowed) { this._haltForGate(); this._tell(readiness.message, readiness.status === 'urgent'); return; }
      this._precheckValid = true;
      this.setData({ needsPrecheck: false, precheckOpen: false, urgentBanner: '' });
      if (!this._session || ['completed', 'stopped'].includes(this._session.getState().status)) {
        const loaded = store.load();
        if (!loaded.ok) { this._tell(loaded.message || '本机记录暂不可用。', false); return; }
        this._profileKey = JSON.stringify(loaded.state.profile);
        this._storageEpoch = typeof store.getEpoch === 'function' ? store.getEpoch() : 0;
        this._session = game.createBreathingSession(this._plan.breathing, { now });
        this._startedAt = new Date(now()).toISOString();
        this._sessionId = 'breathing-' + now() + '-' + Math.random().toString(36).slice(2, 9);
        this._finishedId = null; this._pendingSummary = null;
        this.setData({ saved: false, saveMessage: '', hasUnsaved: false });
        this._session.start();
      } else if (this._session.getState().status === 'paused') this._session.resume();
      this._applyFrame(this._session.getState());
      this._startTimer();
    },
    _startTimer() {
      this._stopTimer();
      if (!this._session || this._session.getState().status !== 'running') return;
      this._keepScreen(true);
      this._timer = schedule(() => {
        if (!this._visible || !this._session) { this._stopTimer(); return; }
        this._applyFrame(this._session.getState());
      }, 100);
    },
    _haltForGate() {
      this._stopTimer();
      if (this._session) { this._session.pause('safety-check'); this._applyFrame(this._session.getState()); }
      this._precheckValid = false;
      this.setData({ needsPrecheck: true, precheckOpen: true });
      this._keepScreen(false);
    },
    _applyFrame(frame) {
      this.setData(deriveTrainingView(frame, this.data.mode, this.data.reducedMotion, game, meditation));
      if (frame.status !== 'running') { this._stopTimer(); this._keepScreen(false); }
      if (frame.status === 'completed' && this._finishedId !== this._sessionId) this._finish(frame, 'completed');
    },
    onPause() {
      if (!this._session) return;
      this._session.pause('manual'); this._stopTimer();
      this._applyFrame(this._session.getState()); this._resetChecks(); this._keepScreen(false);
    },
    onConfirm() {
      if (!this._visible || !this._session) return;
      if (!this._refreshGate()) { this._haltForGate(); return; }
      if (!this._precheckValid) { this._tell('请先重新确认此刻状态，再确认这一轮。', false); return; }
      if (!this._session.confirm()) return;
      this._applyFrame(this._session.getState()); this._startTimer();
    },
    onStop() {
      if (!this._session) return;
      if (!this._session.stop('manual')) return;
      this._stopTimer(); this._keepScreen(false);
      const frame = this._session.getState(); this._applyFrame(frame); this._finish(frame, 'stopped'); this._resetChecks();
    },
    onEmergencyStop() {
      if (this._session && this._session.stop('discomfort')) {
        const frame = this._session.getState(); this._applyFrame(frame); this._finish(frame, 'stopped');
      }
      this._stopTimer(); this._resetChecks(); this._keepScreen(false);
      this._tell('先停止并恢复自然呼吸，联系医护评估。持续胸痛、严重气促、晕厥或明显咯血时拨打 120；不要自行调药或调氧。', true);
    },
    _finish(frame, status) {
      if (this._finishedId === this._sessionId) return;
      this._finishedId = this._sessionId;
      this._pendingSummary = { id: this._sessionId, startedAt: this._startedAt, endedAt: new Date(now()).toISOString(), mode: this.data.mode, completedCycles: frame.completedCycles, elapsedMs: Math.round(frame.activeDurationMs), status };
      this._savePending();
      this._resetChecks();
    },
    _savePending() {
      if (!this._pendingSummary) return;
      const loaded = store.load();
      if (!loaded.ok) {
        this.setData({ hasUnsaved: true, saved: false, saveMessage: loaded.message || '本机记录暂不可用，本次尚未保存。' }); return;
      }
      if (!this._contextMatches(loaded)) {
        this._invalidateSession('评估或本机记录已改变，先前的引导已取消，未重新写回。请重新核对评估。');
        this.setData({ gateAllowed: false, gateTitle: '请重新核对评估', gateMessage: '先前的引导不会恢复已清除的记录。' }); return;
      }
      const result = store.saveSession(this._pendingSummary);
      if (!result.ok) {
        this.setData({ hasUnsaved: true, saved: false, saveMessage: result.message || '本机保存失败，记录仍在当前页面，可重试。' }); return;
      }
      this._pendingSummary = null;
      this.setData({ hasUnsaved: false, saved: true, saveMessage: '已保存到这台手机。轮数为你主动确认的引导轮数。' });
    },
    onRetrySave() { this._savePending(); },
    onGoAssessment() { if (platform && platform.navigateTo) platform.navigateTo({ url: '/pages/assessment/index' }); },
    onGoRecords() { if (platform && platform.switchTab) platform.switchTab({ url: '/pages/records/index' }); },
  };
}

module.exports = { createTrainingPage, deriveTrainingView };
