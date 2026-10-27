// components/splash/SplashScreen.js
//
// The brand intro that plays when someone opens the installed app. It starts
// on exactly what the phone's own launch screen shows (white, the navy logo,
// centred), so there's no blank moment and no jump: a pale light runs once
// round the ring, comes down as a line, and "Raising Stronger Believers" rises
// out of it. Then the logo glides up into its place in the Navbar and the page,
// which has been loading underneath the whole time, shows through. About 2.4s.
//
// It is deliberately NOT a client component. The animation is pure CSS in
// globals.css ("Splash screen"), so it starts on the very first paint instead
// of waiting for the JS bundles to download and hydrate.
//
// SPLASH_SCRIPT (inlined in <head> by app/layout.js) decides, before the body
// paints, whether it plays at all, and flags it on <html data-fh-splash>:
//   - only in the installed app (display-mode standalone, or iOS's
//     navigator.standalone); a normal website visit never sees it
//   - once per launch: a reload in the same session skips it
//   - a tap, click or key press skips it early
//   - add ?splash to any URL to force it, even in a browser tab
// Without JS it never shows (the CSS keeps it display:none).
//
// At 1.75s the script measures the first visible top-bar logo marked
// [data-splash-logo] (Navbar, ToolShell) and hands the glide its target; with
// no visible logo to land on, it just fades.

import { RING_D, SCRIPT_D, SUB_D, COVER_D } from "./logo-paths";

const VIEWBOX = "0 0 208 146";

export const SPLASH_SCRIPT = `(function(){
var d=document.documentElement,k='fh-splash-seen',done=0,force=/[?&]splash(=|&|$)/.test(location.search);
function set(v){d.setAttribute('data-fh-splash',v)}
try{
var installed=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
if(!force&&(!installed||sessionStorage.getItem(k)||/^\\/admin/.test(location.pathname))){set('off');return}
sessionStorage.setItem(k,'1')
}catch(e){if(!force){set('off');return}}
var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
set('play');
function unbind(){removeEventListener('pointerdown',skip,true);removeEventListener('keydown',skip,true)}
function finish(v,ms){if(done)return;done=1;unbind();set(v);setTimeout(function(){set('off')},ms)}
function skip(){finish('skip',320)}
function fly(){
var logo=document.querySelector('.fh-splash__logo'),a=logo&&logo.getBoundingClientRect(),b;
[].some.call(document.querySelectorAll('[data-splash-logo]'),function(t){var r=t.getBoundingClientRect();if(r.width&&r.bottom>0){b=r;return true}});
if(!a||!b||!a.width){skip();return}
logo.style.setProperty('--fh-tx',(b.left-a.left)+'px');
logo.style.setProperty('--fh-ty',(b.top-a.top)+'px');
logo.style.setProperty('--fh-ts',b.width/a.width);
finish('fly',700)
}
addEventListener('pointerdown',skip,true);
addEventListener('keydown',skip,true);
setTimeout(reduced?skip:fly,reduced?1300:1750);
})();`;

export default function SplashScreen() {
  return (
    <div className="fh-splash" aria-hidden="true">
      <div className="fh-splash__veil" />
      <div className="fh-splash__logo">
        <svg viewBox={VIEWBOX} focusable="false">
          <path d={RING_D} fill="currentColor" fillRule="evenodd" />
          <path d={SCRIPT_D} fill="currentColor" fillRule="evenodd" />
          <path d={SUB_D} fill="currentColor" fillRule="evenodd" />
          <path className="fh-splash__light" d={COVER_D} pathLength="1" />
        </svg>
      </div>
      <div className="fh-splash__tag">
        <p className="fh-splash__words">
          <span className="fh-splash__mask"><span className="fh-splash__word">Raising</span></span>
          <span className="fh-splash__mask"><span className="fh-splash__word">Stronger</span></span>
          <span className="fh-splash__mask"><span className="fh-splash__word">Believers</span></span>
        </p>
        <span className="fh-splash__rule" />
      </div>
    </div>
  );
}
