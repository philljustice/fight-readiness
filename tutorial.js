/* Read-only guided tour. State lives with the local profile, not in a global first-run flag. */
(function(root) {
  'use strict';
  const STEPS = [
    ['dash','#heroScore','Your readiness at a glance','Score brings your recent check-ins together. Early scores build as you log more days; use them to start a conversation with your coach.'],
    ['dash','#todayTrain',"Today’s training",'See the sessions planned for today and how many you’ve completed. Your schedule sets this list.'],
    ['log','#tiles','A little each morning and evening','Morning: sleep, pee colour and how you feel. Evening: nutrition, training, screen time and family. Completed tiles turn green with ✓ LOGGED. Everything saves as you go.'],
    ['plan','#view > .card:nth-child(2)','Your week, laid out','Schedule shows your planned sessions. Change your regular training week in Setup → Edit profile & training schedule.'],
    ['report','#view > .card','Keep your coach in the loop','Coach Report brings your trends and check-ins together. Review it, then use the share controls when you’re ready. This tour sends nothing.'],
    ['setup','#exportBtn','Make this phone yours','Setup holds your profile, reminders and watch choice. Export a backup regularly: your logs live on this phone. Restore a backup when you change phones.'],
    ['help','#replayTutorial','Help is always here','Find explanations and safety guidance here. Tap Replay tutorial any time for another quick look around.']
  ];
  const shouldStart = (profile, state, blocked) => !!profile && state === 'pending' && !blocked;
  function create(api) {
    let active = false, index = 0, layer, ring, panel, target, origin, originTab, originScroll, inert = [];
    const vv = () => { const v = window.visualViewport;
      const css = layer && typeof getComputedStyle === 'function' ? getComputedStyle(layer) : null;
      const safe = side => css ? parseFloat(css.getPropertyValue('--tour-'+side)) || 0 : 0;
      const l=safe('left'), r=safe('right'), t=safe('top'), b=safe('bottom');
      return {x:(v?v.offsetLeft:0)+l,y:(v?v.offsetTop:0)+t,w:(v?v.width:innerWidth)-l-r,h:(v?v.height:innerHeight)-t-b}; };
    function position() {
      if (!active) return;
      const v = vv(), pad = 12, r = target && target.isConnected ? target.getBoundingClientRect() : null;
      panel.style.width = Math.max(0, Math.min(360,v.w-24))+'px'; panel.style.maxHeight = Math.max(80,v.h-24)+'px';
      const h = panel.getBoundingClientRect().height, x = v.x+Math.max(pad,Math.min(v.w-panel.offsetWidth-pad,r ? r.left-v.x : pad));
      let y = r ? r.bottom+12 : v.y+pad;
      if (y+h > v.y+v.h-pad) y = r && r.top-h-12 >= v.y+pad ? r.top-h-12 : v.y+v.h-h-pad;
      panel.style.left=x+'px'; panel.style.top=Math.max(v.y+pad,y)+'px';
      ring.hidden = !r;
      if (r) { const left=Math.max(v.x+4,r.left-4), top=Math.max(v.y+4,r.top-4), right=Math.min(v.x+v.w-4,r.right+4), bottom=Math.min(v.y+v.h-4,r.bottom+4);
        Object.assign(ring.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'}); }
    }
    function render() {
      const [tab,selector,title,text] = STEPS[index]; api.navigate(tab);
      target = document.querySelector(selector) || document.querySelector('#tabs [data-v="'+tab+'"]');
      if (target) target.scrollIntoView({block:'center',behavior:'instant'});
      panel.innerHTML = '<p class="tour-count" aria-live="polite">Quick tour · '+(index+1)+' of '+STEPS.length+'</p><h2 id="tourTitle" tabindex="-1"></h2><p id="tourText"></p><div class="tour-controls"><button type="button" data-tour="skip">Skip</button><button type="button" data-tour="back" '+(!index?'disabled':'')+'>Back</button><button type="button" data-tour="next">'+(index===STEPS.length-1?'Finish':'Next')+'</button></div>';
      panel.querySelector('h2').textContent=title; panel.querySelector('#tourText').textContent=text;
      position(); panel.querySelector('h2').focus({preventScroll:true}); requestAnimationFrame(position);
    }
    function stop(state) {
      if (!active) return;
      active=false; api.mark(state); layer.remove(); inert.forEach(([el,was])=>{el.inert=was;}); inert=[];
      window.removeEventListener('resize',position); window.removeEventListener('scroll',position);
      if (window.visualViewport) { visualViewport.removeEventListener('resize',position); visualViewport.removeEventListener('scroll',position); }
      api.navigate(originTab); window.scrollTo(0,originScroll);
      const focus = origin && origin.isConnected && origin !== document.body ? origin : document.querySelector(origin && origin.id ? '#'+origin.id : '#tabs [data-v="'+originTab+'"]');
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
      layer.append(ring,panel); document.body.append(layer);
      inert=Array.from(document.querySelectorAll('body > header, #view, #tabs')).map(el=>[el,el.inert]); inert.forEach(([el])=>{el.inert=true;});
      layer.addEventListener('click',e=>{ const b=e.target.closest('[data-tour]'); if(!b)return; e.stopPropagation(); const action=b.dataset.tour;
        if(action==='skip')stop('skipped'); else if(action==='back' && index>0){index--;render();} else if(action==='next'){if(index===STEPS.length-1)stop('completed');else {index++;render();}} });
      layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();stop('skipped');}
        if(e.key==='Tab'){const bs=Array.from(panel.querySelectorAll('button:not(:disabled)')); const first=bs[0],last=bs[bs.length-1]; if(e.shiftKey && (document.activeElement===first || document.activeElement.tagName==='H2')){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}} });
      window.addEventListener('resize',position); window.addEventListener('scroll',position,{passive:true});
      if(window.visualViewport){visualViewport.addEventListener('resize',position);visualViewport.addEventListener('scroll',position);}
      render();
    }
    return {start, get active(){return active;}};
  }
  const api={STEPS,shouldStart,create}; if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.FRTutorial=api;
})(typeof window!=='undefined'?window:globalThis);
