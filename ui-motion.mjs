/** Feedback is decorative; native controls retain their values and keyboard behavior. */
export function mountUIMotion() {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const targets='.wizard-choice, .home-tool, .btn-primary, .btn-secondary, .edu-topic-picker button, .music-track';
  const pressed=new Set(),animations=new Set();
  function surface(target) {
    const el=target instanceof Element?target.closest(targets):null;
    return el&&!el.matches(':disabled')&&!el.querySelector('input:disabled')?el:null;
  }
  function release() {for(const el of pressed)delete el.dataset.pressing;pressed.clear();}
  function animate(el,frames,options) {
    if(reduced.matches||!el?.animate)return;
    const animation=el.animate(frames,options);animations.add(animation);
    animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
  }
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const el=surface(event.target);if(!el)return;
    el.dataset.pressing='true';pressed.add(el);
  });
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,release);
  window.addEventListener('blur',release);
  document.addEventListener('keydown',event=>{
    if(event.repeat||![' ','Enter'].includes(event.key))return;
    const el=surface(event.target);if(el){el.dataset.pressing='true';pressed.add(el);}
  });
  document.addEventListener('keyup',release);
  document.addEventListener('change',event=>{
    if(event.target instanceof HTMLSelectElement) {
      const field=event.target.closest('.field');
      field?.classList.toggle('field-picked',Boolean(event.target.value));
      if(event.target.value)animate(event.target,[{boxShadow:'0 0 0 0 #124c4630'},{boxShadow:'0 0 0 8px #124c4600'}],{duration:380,easing:'ease-out'});
    }
  });
  document.addEventListener('rehab:step',event=>{
    const step=event.target;
    animate(step,[{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
  function clear() {release();for(const animation of animations)animation.cancel();animations.clear();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  reduced.addEventListener('change',clear);
  window.addEventListener('pagehide',clear);
}
