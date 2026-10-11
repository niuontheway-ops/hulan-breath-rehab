const MODES = new Set(['demonstration', 'stairs', 'meadow']);

export function normalizeActivityMode(mode) {
  return MODES.has(mode) ? mode : 'demonstration';
}

/** Imagined travel follows the guide's clock; it is not a movement measurement. */
export function getMeditationFrame(state, mode, { reducedMotion = false } = {}) {
  const stepsPerRound = mode === 'stairs' ? 3 : 6;
  const inhaleSteps = mode === 'stairs' ? 1 : 2;
  const exhaleSteps = mode === 'stairs' ? 2 : 4;
  const progress = Number.isFinite(state.phaseProgress) ? Math.min(1, Math.max(0, state.phaseProgress)) : 0;
  const phase = state.status === 'stopped' ? state.roundProgress >= 1 ? 'confirm' : state.roundElapsedMs > state.phaseElapsedMs ? 'exhale' : 'inhale' : state.phase;
  let roundSteps = 0;
  if (phase === 'inhale') roundSteps = inhaleSteps * progress;
  else if (phase === 'exhale') roundSteps = inhaleSteps + exhaleSteps * progress;
  else if (phase === 'confirm' || state.status === 'awaiting-confirmation') roundSteps = stepsPerRound;
  // A static scene is kept throughout a phase; text and the remaining seconds still update.
  if (reducedMotion) roundSteps = 0;
  const position = (state.completedCycles || 0) * stepsPerRound + roundSteps;
  const stride = position - Math.floor(position);
  return {
    position,
    roundSteps,
    stepsPerRound,
    inhaleSteps,
    exhaleSteps,
    stride,
    lift: reducedMotion ? 0 : Math.sin(stride * Math.PI) * (mode === 'stairs' ? 11 : 5),
    motion: reducedMotion ? 'reduced' : state.status === 'running' ? 'active' : state.status === 'paused' ? 'paused' : 'rest',
  };
}

function natureDefs(id) {
  return `<defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#e6f0dc"/><stop offset=".54" stop-color="#f7f6df"/><stop offset="1" stop-color="#a5c886"/></linearGradient><linearGradient id="${id}-grass" x2=".35" y2="1"><stop stop-color="#93bc70"/><stop offset="1" stop-color="#527a49"/></linearGradient><linearGradient id="${id}-stone" x2=".15" y2="1"><stop stop-color="#fff5d5"/><stop offset="1" stop-color="#d7d3a8"/></linearGradient><linearGradient id="${id}-trail" x2=".3" y2="1"><stop stop-color="#e5e3ad"/><stop offset="1" stop-color="#f7e9bf"/></linearGradient><radialGradient id="${id}-sun"><stop stop-color="#fff9d8"/><stop offset="1" stop-color="#fff8d2" stop-opacity="0"/></radialGradient><radialGradient id="${id}-glow"><stop stop-color="#fffcdf"/><stop offset=".4" stop-color="#fff2b0" stop-opacity=".72"/><stop offset="1" stop-color="#fff7c8" stop-opacity="0"/></radialGradient><filter id="${id}-soft"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
}

function natureBackground(id) {
  const grass = Array.from({ length: 45 }, (_, i) => {
    const x = (i * 193 + 31) % 960;
    const y = 408 + (i * 29) % 122;
    const h = 10 + (i % 4) * 5;
    return `<path d="M${x} ${y}q-6 -${h} -12 -${h + 4}M${x} ${y}q1 -${h + 2} 5 -${h + 8}M${x} ${y}q8 -${h - 3} 15 -${h}"/>`;
  }).join('');
  return `<rect width="960" height="560" fill="url(#${id}-sky)"/><circle cx="638" cy="136" r="145" fill="url(#${id}-sun)"/><circle cx="638" cy="136" r="31" fill="#fcf7d4" opacity=".88"/><path d="M0 288Q110 147 238 211T460 201Q568 109 685 202T960 217V560H0Z" fill="#c0d5a8"/><path d="M0 324Q113 237 259 288T520 243Q723 229 960 308V560H0Z" fill="#a2be89"/><path d="M0 379Q178 298 324 346T611 330Q790 281 960 329V560H0Z" fill="url(#${id}-grass)"/><path d="M24 362Q43 287 50 204M49 260Q26 236 11 216M49 280Q79 244 109 223" fill="none" stroke="#617c4a" stroke-width="10" stroke-linecap="round"/><g fill="#62824d"><ellipse cx="43" cy="207" rx="49" ry="57"/><ellipse cx="95" cy="227" rx="46" ry="51"/><ellipse cx="2" cy="230" rx="42" ry="52"/></g><g fill="#87a663" opacity=".8"><ellipse cx="39" cy="184" rx="33" ry="31"/><ellipse cx="100" cy="207" rx="30" ry="31"/></g><path d="M837 339Q848 280 863 233M855 270L891 242" fill="none" stroke="#6b824f" stroke-width="8" stroke-linecap="round"/><g fill="#779658"><ellipse cx="860" cy="220" rx="53" ry="48"/><ellipse cx="908" cy="239" rx="44" ry="37"/></g><path d="M160 113q12 -13 24 0M203 87q9 -10 18 0" fill="none" stroke="#879879" stroke-width="2" opacity=".6"/><path d="M0 498Q161 441 284 490T539 477Q778 455 960 498V560H0Z" fill="#577b49" opacity=".62"/><g fill="none" stroke="#a7c37a" stroke-width="1.7" stroke-linecap="round" opacity=".75">${grass}</g><g fill="#f4eed0"><circle cx="80" cy="468" r="3"/><circle cx="817" cy="426" r="3"/><circle cx="849" cy="451" r="2.5"/><circle cx="792" cy="454" r="2"/></g>`;
}

function markerMarkup(id) {
  return `<g data-meditation-marker><ellipse cx="0" cy="13" rx="21" ry="7" fill="#3e6642" opacity=".2"/><circle r="44" fill="url(#${id}-glow)"/><circle r="11" fill="#fff5c1" stroke="#fffdf0" stroke-width="2"/><circle cx="-2" cy="-3" r="4" fill="#fffefa" opacity=".88"/></g>`;
}

export function meditationMarkup(id, cycles = 10) {
  const levelCount = Math.min(200, Math.max(36, cycles * 3 + 12));
  let stairs = '';
  for (let i = 0; i < levelCount; i++) {
    const x = 160 + i * 36;
    const y = 387 - i * 18;
    stairs += `<path d="M${x} ${y}l36 -18 69 22 -36 18Z" fill="url(#${id}-stairs-stone)" stroke="#fff6db" stroke-width="1.2"/><path d="M${x} ${y}l69 22v16l-69 -22Z" fill="#a4ae85"/><path d="M${x + 69} ${y + 22}l36 -18v16l-36 18Z" fill="#bec6a1"/><path d="M${x + 7} ${y + 1}l55 18" stroke="#faf4d6" stroke-width="1" opacity=".7"/>`;
  }
  return `<section class="game-meditation" data-game-meditation hidden aria-label="坐位或卧位的呼吸想象引导"><div class="game-meditation-heading"><span class="game-imagine-chip">闭目也可 · 仅作想象</span><h4 data-meditation-title>想象一段安静的阶梯</h4><p data-meditation-summary>坐稳或舒适卧位，想象前进，不需要起身。</p></div><div class="game-meditation-stage"><svg data-meditation-scene="stairs" viewBox="0 0 960 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="暖绿山林中的虚构阶梯，光点随呼吸引导前进">${natureDefs(`${id}-stairs`)}<title>想象阶梯</title>${natureBackground(`${id}-stairs`)}<g data-meditation-world="stairs">${stairs}${markerMarkup(`${id}-stairs`)}</g><path d="M0 530Q94 474 162 522T307 548V560H0Z" fill="#466d42"/><g fill="#8fae60"><ellipse cx="54" cy="520" rx="13" ry="39" transform="rotate(-35 54 520)"/><ellipse cx="94" cy="536" rx="11" ry="31" transform="rotate(22 94 536)"/><ellipse cx="889" cy="528" rx="17" ry="44" transform="rotate(35 889 528)"/></g></svg><svg data-meditation-scene="meadow" hidden viewBox="0 0 960 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="绿草、远山和林间小路，光点与想象脚印随呼吸引导前进">${natureDefs(`${id}-meadow`)}<title>草地慢走想象</title>${natureBackground(`${id}-meadow`)}<path d="M504 305C507 331 563 339 578 365S574 425 737 451Q815 472 864 560H357Q403 497 454 464C527 423 501 405 469 378S465 321 493 305Z" fill="url(#${id}-meadow-trail)"/><path d="M504 305C492 332 528 355 528 386S579 450 633 480L637 560" fill="none" stroke="#d1cf9c" stroke-width="2" stroke-dasharray="3 8" opacity=".55"/><g data-meditation-footprints fill="#66854e" opacity=".64"><path data-meditation-foot="left" d="M-12 -9q-7 -9 -9 0l2 16q7 8 10 -1Z"/><path data-meditation-foot="right" d="M12 6q7 -9 9 0l-2 16q-7 8 -10 -1Z"/></g>${markerMarkup(`${id}-meadow`)}<g fill="#f0edc5"><circle cx="186" cy="443" r="4"/><circle cx="209" cy="461" r="3"/><circle cx="268" cy="428" r="3"/></g><path d="M0 553Q66 505 171 540M760 544Q850 514 960 531" fill="none" stroke="#91ad65" stroke-width="4"/></svg></div><div class="game-meditation-caption"><strong data-meditation-cue>吸气想象 1 阶，呼气想象 2 阶</strong><span data-meditation-position>准备好，再开始</span></div><p class="game-meditation-note" data-meditation-note>保持轻柔呼吸，不屏息，不勉强跟拍。</p></section>`;
}

export function updateMeditationScene(container, state, mode, { reducedMotion = false } = {}) {
  const frame = getMeditationFrame(state, mode, { reducedMotion });
  const scene = container.querySelector(`[data-meditation-scene="${mode}"]`);
  if (!scene) return frame;
  scene.dataset.position = frame.position.toFixed(4);
  scene.dataset.motion = frame.motion;
  const marker = scene.querySelector('[data-meditation-marker]');
  if (mode === 'stairs') {
    const camera = Math.max(0, frame.position - 6);
    scene.querySelector('[data-meditation-world]').setAttribute('transform', `translate(${(-36 * camera).toFixed(3)} ${(18 * camera).toFixed(3)})`);
    marker.setAttribute('transform', `translate(${(193 + 36 * frame.position).toFixed(3)} ${(388 - 18 * frame.position - frame.lift).toFixed(3)})`);
  } else {
    // A gently winding lane is an imagined journey, without a real walking prescription.
    const routeLength = Math.max(6, (state.totalCycles || 10) * 6);
    const distance = frame.position / routeLength * 145;
    const y = 488 - Math.min(145, distance);
    const x = 528 + 105 * ((y - 343) / 145) ** 2;
    marker.setAttribute('transform', `translate(${x.toFixed(3)} ${(y - frame.lift).toFixed(3)})`);
    const footprints = scene.querySelector('[data-meditation-footprints]');
    footprints.setAttribute('transform', `translate(${x.toFixed(3)} ${(y + 22).toFixed(3)}) rotate(-12)`);
    footprints.querySelector('[data-meditation-foot="left"]').setAttribute('opacity', String(reducedMotion ? .7 : .35 + .45 * frame.stride));
    footprints.querySelector('[data-meditation-foot="right"]').setAttribute('opacity', String(reducedMotion ? .7 : .8 - .45 * frame.stride));
  }
  return frame;
}
