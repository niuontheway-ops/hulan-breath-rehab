import test from 'node:test';
import assert from 'node:assert/strict';
import { INHALER_CATALOG } from '../inhaler-catalog.mjs';
import { INHALER_MARKET, INHALER_UNCONFIRMED_MARKET } from '../inhaler-market.mjs';

const byId = id => INHALER_CATALOG.find(item => item.id === id);
const text = item => [item.breathCue, ...item.steps, ...item.preparation, ...item.firstUse, ...item.cleaning, ...item.warnings].join(' ');

test('the catalogue keeps identified domestic products and does not promote unconfirmed overseas families', () => {
  assert.equal(new Set(INHALER_CATALOG.map(item => item.id)).size, INHALER_CATALOG.length);
  for (const id of Object.keys(INHALER_MARKET)) assert.ok(byId(id), `Identified product omitted: ${id}`);
  for (const id of Object.keys(INHALER_UNCONFIRMED_MARKET)) assert.ok(!byId(id), `Unconfirmed family promoted: ${id}`);
});

test('a missing proprietary method remains explicit instead of inheriting another brand instructions', () => {
  for (const item of INHALER_CATALOG.filter(item => item.teachingStatus === 'needs-device-review')) {
    assert.equal(item.steps.length, 0);
    assert.equal(item.video, null);
    assert.match(item.missingReason, /专属|本品牌/);
    assert.match(text(item), /不.*套用|不能.*套用|不.*照抄/);
  }
});

test('capsule devices retain their different inhalation actions and cannot be swallowed', () => {
  assert.match(text(byId('handihaler')), /缓慢.*深/);
  assert.match(text(byId('breezhaler')), /快速.*深/);
  assert.match(text(byId('pingshi')), /DPI-C3/);
  for (const item of INHALER_CATALOG.filter(item => item.type === 'capsule')) assert.match(text(item), /不能吞|不吞|不.*吞服/);
});

test('solution pMDIs do not inherit the suspension shaking and washing rules', () => {
  assert.match(text(byId('breztri')), /摇匀/);
  assert.match(text(byId('pmdi-salbutamol')), /摇匀/);
  for (const id of ['pmdi-foster', 'pmdi-trimbow']) {
    assert.match(text(byId(id)), /不.*套用.*摇匀|无需.*摇匀/);
    assert.match(byId(id).cleaning.join(' '), /不水洗|不得用水/);
  }
});

test('mixed medication families explain which contain ICS without imposing a universal drug dose', () => {
  const ellipta = text(byId('ellipta'));
  assert.match(ellipta, /欧乐欣不含 ICS/);
  assert.match(ellipta, /全再乐含 ICS/);
  assert.match(text(byId('breezhaler')), /恩明润.*恩卓润含/);
  for (const item of INHALER_CATALOG) assert.doesNotMatch(item.steps.join(' '), /每日.*\d.*(揿|喷|吸)|早晚.*\d/);
});

test('video audit level, language and off-site limitations stay visible in the data', () => {
  for (const item of INHALER_CATALOG) {
    for (const video of [item.video, ...item.videoOptions].filter(Boolean)) {
      assert.equal(new URL(video.url).protocol, 'https:');
      assert.ok(video.language && video.provider && video.sourceUrl && video.note);
      assert.notEqual(new URL(video.url).pathname, '/');
      if (video.url.includes('youtube.com')) {
        assert.equal(video.playbackVerified, false);
        assert.match(video.note, /无法|受限/);
      }
    }
  }
  assert.notEqual(byId('ellipta').video?.url, byId('accuhaler').video?.url, 'A title mentioning two devices is insufficient to share a model-specific demonstration.');
});
