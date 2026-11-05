/* Read-only guided tour. State lives with the local profile, not in a global first-run flag. */
(function(root) {
  'use strict';
  const STEPS = [
    ['dash','#heroScore','Your readiness at a glance','Score brings your recent check-ins together. Early scores build as you log more days; use them to start a conversation with your coach.'],
    ['dash','#todayTrain',"Today’s training",'See the sessions planned for today and how many you’ve completed. Your schedule sets this list.'],
    ['log','#tiles','A little each morning and evening','Morning: sleep, pee colour and how you feel. Evening: nutrition, training, screen time and family. Completed tiles turn green with ✓ LOGGED. Everything saves as you go.'],
    ['plan','#view > .card:nth-child(2)','Your week, laid out','Schedule shows your planned sessions. Change your regular training week in Setup → Edit profile & training schedule.'],
    ['report','#coachReportTitle','Keep your coach in the loop','Coach Report brings your trends and check-ins together. Review it, then use the share controls when you’re ready. This tour sends nothing.'],
    ['setup','#exportBtn','Make this phone yours','Setup holds your profile, reminders and watch choice. Export a backup regularly: your logs live on this phone. Restore a backup when you change phones.'],
    ['help','#replayTutorial','Help is always here','Find explanations and safety guidance here. Tap Replay tutorial any time for another quick look around.']
  ];
  const shouldStart = (profile, state, blocked) => !!profile && state === 'pending' && !blocked;
  // Intersect the visual viewport with the layout viewport's safe rectangle.
  function safeViewport(visual, width, height, safe) {
    const left=Math.max(visual.x,safe.left||0), top=Math.max(visual.y,safe.top||0);
    const right=Math.min(visual.x+visual.w,width-(safe.right||0));
    const bottom=Math.min(visual.y+visual.h,height-(safe.bottom||0));
    return {x:left,y:top,w:Math.max(0,right-left),h:Math.max(0,bottom-top)};
  }
  // Stable bottom docking: scrolling the target must never flip the tooltip above it.
  function layout(v, r, height) {
    const pad=Math.min(12,v.h/8), gap=16, available=Math.max(0,v.h-2*pad);
    const reserve=r ? Math.min(r.height || r.bottom-r.top, available*.3) : 0;
    const h=Math.min(height, Math.max(0,available-(r?reserve+gap:0)));
    const top=Math.max(v.y+pad,v.y+v.h-pad-h);
    return {top,height:h,scroll:r ? r.top-(top-gap-reserve) : 0};
  }
  function create(api) {
    let active = false, index = 0, layer, ring, panel, target, origin, originTab, originScroll, inert = [], probe, observer, frame = null;
    const vv = () => {
      const v=window.visualViewport;
      // Read real computed padding lengths, not custom-property env() token strings.
      const css=probe && typeof getComputedStyle==='function' ? getComputedStyle(probe) : null;
      const safe=side=>css ? parseFloat(css['padding'+side])||0 : 0;
      return safeViewport({x:v?v.offsetLeft:0,y:v?v.offsetTop:0,w:v?v.width:innerWidth,h:v?v.height:innerHeight},
        innerWidth,innerHeight,{left:safe('Left'),right:safe('Right'),top:safe('Top'),bottom:safe('Bottom')});
    };
    function schedule() {
      if(!active || frame!==null)return;
      frame=true; requestAnimationFrame(()=>{frame=null;position();});
    }
    function position() {
      if (!active) return;
      const v = vv(), pad = 12, r = target && target.isConnected ? target.getBoundingClientRect() : null;
      panel.style.width = Math.max(0, Math.min(360,v.w-24))+'px'; panel.style.maxHeight = Math.max(0,v.h-24)+'px';
      const fit=layout(v,r,Math.max(panel.scrollHeight || 0,panel.getBoundingClientRect().height));
      panel.style.maxHeight=fit.height+'px';
      const x=v.x+Math.max(pad,Math.min(v.w-panel.offsetWidth-pad,r?r.left-v.x:pad));
      panel.style.left=x+'px'; panel.style.top=fit.top+'px';
      // Scrolling the document moves the highlighted content into the reserved strip.
      if(r && Math.abs(fit.scroll)>1) { window.scrollBy(0,fit.scroll); }
      ring.hidden = !r;
      if (r) { const left=Math.max(v.x+4,r.left-4), top=Math.max(v.y+4,r.top-4), right=Math.min(v.x+v.w-4,r.right+4), bottom=Math.min(v.y+v.h-4,r.bottom+4);
        Object.assign(ring.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'}); }
    }
    function render() {
      const [tab,selector,title,text] = STEPS[index]; api.navigate(tab);
      target = document.querySelector(selector) || document.querySelector('#tabs [data-v="'+tab+'"]');
      if (target) target.scrollIntoView({block:'center',behavior:'instant'});
      panel.scrollTop=0;
      panel.innerHTML = '<p class="tour-count" aria-live="polite">Quick tour · '+(index+1)+' of '+STEPS.length+'</p><h2 id="tourTitle" tabindex="-1"></h2><p id="tourText"></p><div class="tour-controls"><button type="button" data-tour="skip">Skip</button><button type="button" data-tour="back" '+(!index?'disabled':'')+'>Back</button><button type="button" data-tour="next">'+(index===STEPS.length-1?'Finish':'Next')+'</button></div>';
      panel.querySelector('h2').textContent=title; panel.querySelector('#tourText').textContent=text;
      position(); panel.querySelector('h2').focus({preventScroll:true}); schedule();
    }
    function stop(state) {
      if (!active) return;
      active=false; api.mark(state); layer.remove(); inert.forEach(([el,was])=>{el.inert=was;}); inert=[];
      window.removeEventListener('resize',schedule); window.removeEventListener('scroll',schedule);
      if(observer)observer.disconnect();
      if (window.visualViewport) { window.visualViewport.removeEventListener('resize',schedule); window.visualViewport.removeEventListener('scroll',schedule); }
      const destination=state==='completed'?'dash':originTab;
      api.navigate(destination); window.scrollTo(0,state==='completed'?0:originScroll);
      const focus = state==='completed' ? document.querySelector('#tabs [data-v="dash"]') : origin && origin.isConnected && origin !== document.body ? origin : document.querySelector(origin && origin.id ? '#'+origin.id : '#tabs [data-v="'+originTab+'"]');
      if (focus && focus.focus) focus.focus({preventScroll:true});
    }
    async function start(manual) {
      await api.ready();
      if (active || !api.profile() || api.blocked() || (!manual && !shouldStart(api.profile(),api.state(),false))) return;
      origin=document.activeElement; originTab=api.tab(); originScroll=window.scrollY;
      // A refresh during the tour must not reopen an interruption.
      api.mark('skipped'); active=true; index=0;
      layer=document.createElement('div'); layer.className='tour-layer';
      ring=document.createElement('div'); ring.className='tour-ring'; ring.setAttribute('aria-hidden','true');
      panel=document.createElement('section'); panel.className='tour-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','tourTitle'); panel.setAttribute('aria-describedby','tourText');
      probe=document.createElement('div'); probe.className='tour-safe-probe'; probe.setAttribute('aria-hidden','true');
      layer.append(ring,panel,probe); document.body.append(layer);
      inert=Array.from(document.querySelectorAll('body > header, #view, #tabs')).map(el=>[el,el.inert]); inert.forEach(([el])=>{el.inert=true;});
      layer.addEventListener('click',e=>{ const b=e.target.closest('[data-tour]'); if(!b)return; e.stopPropagation(); const action=b.dataset.tour;
        if(action==='skip')stop('skipped'); else if(action==='back' && index>0){index--;render();} else if(action==='next'){if(index===STEPS.length-1)stop('completed');else {index++;render();}} });
      layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();stop('skipped');}
        if(e.key==='Tab'){const bs=Array.from(panel.querySelectorAll('button:not(:disabled)')); const first=bs[0],last=bs[bs.length-1]; if(e.shiftKey && (document.activeElement===first || document.activeElement.tagName==='H2')){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}} });
      window.addEventListener('resize',schedule); window.addEventListener('scroll',schedule,{passive:true});
      if(window.visualViewport){window.visualViewport.addEventListener('resize',schedule);window.visualViewport.addEventListener('scroll',schedule);}
      if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(schedule);observer.observe(panel);}
      if(document.fonts && document.fonts.ready)document.fonts.ready.then(schedule);
      render();
    }
    return {start, get active(){return active;}};
  }
  const api={STEPS,shouldStart,safeViewport,layout,create}; if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.FRTutorial=api;
})(typeof window!=='undefined'?window:globalThis);
