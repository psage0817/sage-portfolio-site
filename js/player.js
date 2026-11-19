/* player.js: the record player in the "now playing" window at the bottom of every page.

   YOUR PLAYLIST
   - PLAYLIST: your playlist. A Spotify link (Share > Copy link) or a URI (spotify:playlist:...) both work.
   - TRACKS: the songs, in order, for the previous/next buttons (Spotify's player can't skip on its own).
   - PLAYLIST_NAME and SONG_COUNT are shown in the window.

   Spotify's player loads as the record player comes into view, so pressing play starts at once.
   If a browser won't let it start from our button (iPhones are strict about this), Spotify's own
   little player appears in the window so the visitor can press play there.
   Visitors who aren't logged in to Spotify hear 30-second previews. */
(()=>{
'use strict';
const PLAYLIST='https://open.spotify.com/playlist/3pZaGmMg3EJnSGUQdhoiOf?si=_JIUerj-R5SgQRLim0lylA';
const TRACKS=[
  'spotify:track:1efF91lBrpztvLSEEB6wPB',
  'spotify:track:7zkLpY72g6lKQbiHDqri1S',
  'spotify:track:26qigRagi9CRNhbGYajKOS',
  'spotify:track:6a3PAfOxDpgBv0ZdJuH5Eo',
  'spotify:track:4VwkODja7853Fz1FWzp126',
  'spotify:track:4BE1OloRc9xwjyqA4wFFuN',
  'spotify:track:5yxghrFKJbU7pcaUFEv1Sg',
  'spotify:track:4s5B70nF4StXSaCwP6C0AU',
  'spotify:track:02KRPJcx4TJFLCXt9qwEUE',
  'spotify:track:4W6yulge3h7FSy0zGFrNKs',
  'spotify:track:0QltPqkR4dnhbINyBOU5SY',
  'spotify:track:1Pu3xgGv05MYxJzHROokRJ',
  'spotify:track:6Ql76QUTIXajTh9cVjrAZl',
  'spotify:track:55pBIZO1cqoldeqpp5WR7H',
  'spotify:track:1a19jsjG2DvbN1fVJonKUU',
  'spotify:track:4D2DFuqs2PwLiHbcf6CX47',
  'spotify:track:24rDDbSlFY9OHrlJb48CRh',
  'spotify:track:6dGsBRuavumBs5BghcXF3D',
  'spotify:track:46wDG6evLn2iPoQ0F8CUWk',
  'spotify:track:5SmXEPnevlRjBPWBG7oKIi',
  'spotify:track:3RwWW7KeVhHGayYJgUL5eZ'
];
const PLAYLIST_NAME='s.park record';
const SONG_COUNT='21';
const toUri=u=>{const m=String(u).match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|track|album|episode)\/([A-Za-z0-9]+)/);return m?`spotify:${m[1]}:${m[2]}`:String(u).trim()};
const PLAYLIST_URI=toUri(PLAYLIST), TRACK_URIS=TRACKS.map(toUri);
const views=[...document.querySelectorAll('.np')];
if(!views.length)return;
let ctrl=null,loading=false,state='idle',trackIdx=0;

const set=s=>{state=s;views.forEach(v=>{v.dataset.state=s;v.classList.toggle('playing',s==='playing');v.querySelectorAll('[data-record]').forEach(b=>b.setAttribute('aria-pressed',String(s==='playing')))})};
const mmss=ms=>{const t=Math.max(0,Math.floor((ms||0)/1000));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const progress=(p,pos,dur)=>views.forEach(v=>{const b=v.querySelector('.pl-bar i');if(b)b.style.clipPath='inset(0 '+(100-Math.max(0,Math.min(1,p))*100)+'% 0 0 round 99px)';const a=v.querySelector('[data-pl-time]');if(a&&pos!=null)a.textContent=mmss(pos);const z=v.querySelector('[data-pl-dur]');if(z&&dur)z.textContent=mmss(dur)});
const toast=m=>window.SP&&window.SP.toast(m);

// Spotify's player sits inside the window, invisible until it's needed
let ready=false,wantPlay=false,revealT=0,wrap=null;
function load(){
  if(loading||!PLAYLIST_URI)return;loading=true;
  wrap=document.createElement('div');wrap.className='np-embed';
  const slot=document.createElement('div');wrap.appendChild(slot);
  (views[0].querySelector('.np-body')||views[0]).appendChild(wrap);
  window.onSpotifyIframeApiReady=api=>{
    api.createController(slot,{uri:PLAYLIST_URI,width:'100%',height:80},c=>{
      ctrl=c;
      c.addListener('ready',()=>{ready=true;if(wantPlay){wantPlay=false;start()}});
      c.addListener('playback_update',e=>{
        const d=e.data||{};
        if(!d.isPaused&&!d.isBuffering)clearTimeout(revealT);
        set(d.isPaused?'paused':'playing');
        progress(d.duration?d.position/d.duration:0,d.position,d.duration);
      });
    });
  };
  const s=document.createElement('script');s.src='https://open.spotify.com/embed/iframe-api/v1';s.async=true;
  s.onerror=()=>{loading=false;set('idle');toast("couldn't reach Spotify right now")};
  document.body.appendChild(s);
}
// if the browser blocks starting it from our button, show Spotify's own player in the window
function watch(){
  clearTimeout(revealT);
  revealT=setTimeout(()=>{if(state!=='playing'&&wrap){wrap.classList.add('on');set('idle');toast('press play in the Spotify player')}},3500);
}
function start(){ctrl.play();watch()}

function toggle(){
  if(!PLAYLIST_URI){toast('my playlist is coming soon');return}
  if(!ready){wantPlay=true;set('playing');load();return}
  if(state==='playing')ctrl.pause();else start();
}
function skip(dir){
  if(!PLAYLIST_URI){toast('my playlist is coming soon');return}
  if(!TRACK_URIS.length){if(ctrl)ctrl.seek(0);return}
  trackIdx=(trackIdx+dir+TRACK_URIS.length)%TRACK_URIS.length;
  const go=()=>{ctrl.loadUri(TRACK_URIS[trackIdx]);setTimeout(start,500)};
  if(ready)go();else{wantPlay=false;load();const t=setInterval(()=>{if(ready){clearInterval(t);go()}},200)}
}

// load Spotify as the record player comes into view, so play starts straight from the click
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(en=>{if(en.some(x=>x.isIntersecting)){io.disconnect();load()}},{rootMargin:'600px 0px'});
  views.forEach(v=>io.observe(v));
}

views.forEach(v=>{
  v.querySelectorAll('.pl-name').forEach(n=>n.textContent=PLAYLIST_NAME);
  v.querySelectorAll('.pl-sub').forEach(n=>n.textContent=`${SONG_COUNT} songs · made for this site`);
  v.querySelectorAll('[data-record]').forEach(b=>b.addEventListener('click',toggle));
  const sk=v.querySelectorAll('[data-juke] .orb:not(.big)');
  if(sk[0])sk[0].addEventListener('click',()=>skip(-1));
  if(sk[1])sk[1].addEventListener('click',()=>skip(1));
  if(!TRACK_URIS.length)sk.forEach(b=>{b.style.opacity='.5';b.title='skip buttons turn on once the song list is added'});
});
})();
