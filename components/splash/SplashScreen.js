// components/splash/SplashScreen.js
//
// The brand intro that plays when someone opens the site: the ring draws
// itself, "Heritage" writes in left to right, "OF FAITH" settles, then
// "Raising Stronger Believers" rises underneath. About 2.4s, then it fades
// out to reveal the page, which has been loading underneath the whole time.
//
// It is deliberately NOT a client component. The animation is pure CSS in
// globals.css ("Splash screen"), so it starts on the very first paint instead
// of waiting ~2-3s for the JS bundles to download and hydrate. It never
// delays the real content either: the page renders underneath it.
//
// SPLASH_SCRIPT (inlined in <head> by app/layout.js) decides, before the body
// paints, whether it plays at all:
//   - once per tab: a repeat load in the same tab skips it
//   - skipped for crawlers, so search engines index the page, not the intro
//   - a tap, click or key press skips it early
//   - add ?splash to any URL to force it (for showing it off / testing)
// It flags the result on <html data-fh-splash="skip|off">; the CSS does the rest.
// If JS is off entirely, the CSS still plays it once and fades it away.

import { RING_D, SCRIPT_D, SUB_D, COVER_D } from "./logo-paths";

const VIEWBOX = "0 0 208 146";

export const SPLASH_SCRIPT = `(function(){
var d=document.documentElement,k='fh-splash-seen',done=0;
function off(){d.setAttribute('data-fh-splash','off')}
try{
if(!/[?&]splash(=|&|$)/.test(location.search)){
if(/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent)||sessionStorage.getItem(k)){off();return}
}
sessionStorage.setItem(k,'1')
}catch(e){}
var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function unbind(){removeEventListener('pointerdown',skip,true);removeEventListener('keydown',skip,true)}
function skip(){if(done)return;done=1;unbind();d.setAttribute('data-fh-splash','skip');setTimeout(off,320)}
addEventListener('pointerdown',skip,true);
addEventListener('keydown',skip,true);
setTimeout(function(){if(done)return;done=1;unbind();off()},reduced?1600:2500);
})();`;

export default function SplashScreen() {
  return (
    <div className="fh-splash" aria-hidden="true">
      <div className="fh-splash__inner">
        <div className="fh-splash__logo">
          <svg className="fh-splash__layer" viewBox={VIEWBOX} focusable="false">
            <path d={RING_D} fill="currentColor" fillRule="evenodd" />
            <path className="fh-splash__cover" d={COVER_D} />
          </svg>
          <div className="fh-splash__layer fh-splash__script">
            <svg viewBox={VIEWBOX} focusable="false">
              <path d={SCRIPT_D} fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
          <div className="fh-splash__layer fh-splash__sub">
            <svg viewBox={VIEWBOX} focusable="false">
              <path d={SUB_D} fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
        </div>
        <span className="fh-splash__rule" />
        <p className="fh-splash__tag">
          <span>Raising</span> <span>Stronger</span> <span>Believers</span>
        </p>
      </div>
    </div>
  );
}
