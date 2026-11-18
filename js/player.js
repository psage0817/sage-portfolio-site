/* player.js: the record player in the "now playing" window at the bottom of every page.

   TO CONNECT YOUR PLAYLIST
   1. In Spotify: right-click your playlist > Share > Copy Spotify URI. Paste it as PLAYLIST_URI below.
   2. Fill in PLAYLIST_NAME and SONG_COUNT, and replace the "[playlist name]" / "[n] songs" text in the HTML.
   3. Optional: paste each song's Spotify URI into TRACKS to make the skip buttons work
      (Spotify's embed can't skip by itself, so the buttons load the songs you list here).

   Until PLAYLIST_URI is set, the play button just says the playlist is coming soon.
   Visitors who aren't logged in to Spotify hear 30-second previews. */
(()=>{
'use strict';
const PLAYLIST_URI='https://open.spotify.com/playlist/3pZaGmMg3EJnSGUQdhoiOf?si=_JIUerj-R5SgQRLim0lylA';          // e.g. 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
const TRACKS= ['https://open.spotify.com/track/1efF91lBrpztvLSEEB6wPB?si=4e445be7b9864266]','https://open.spotify.com/track/7zkLpY72g6lKQbiHDqri1S?si=93ff1e2fdce34778','https://open.spotify.com/track/26qigRagi9CRNhbGYajKOS?si=d555c8b093464961','https://open.spotify.com/track/6a3PAfOxDpgBv0ZdJuH5Eo?si=e25f068d900b4e71','https://open.spotify.com/track/4VwkODja7853Fz1FWzp126?si=d66db80b386745ca','https://open.spotify.com/track/4BE1OloRc9xwjyqA4wFFuN?si=5d26be211f314eee','https://open.spotify.com/track/5yxghrFKJbU7pcaUFEv1Sg?si=d2548374b6da49de','https://open.spotify.com/track/4s5B70nF4StXSaCwP6C0AU?si=96c6707459d240ce','https://open.spotify.com/track/02KRPJcx4TJFLCXt9qwEUE?si=1632e53522524a6e','https://open.spotify.com/track/4W6yulge3h7FSy0zGFrNKs?si=1557794b03ba4507','https://open.spotify.com/track/0QltPqkR4dnhbINyBOU5SY?si=6bd0120510104c0f','https://open.spotify.com/track/1Pu3xgGv05MYxJzHROokRJ?si=d4ec869f910b40ca','https://open.spotify.com/track/6Ql76QUTIXajTh9cVjrAZl?si=208911c373da4312','https://open.spotify.com/track/55pBIZO1cqoldeqpp5WR7H?si=65d5e9ba06d34c43','https://open.spotify.com/track/1a19jsjG2DvbN1fVJonKUU?si=ac999d2f0c414f76','https://open.spotify.com/track/4D2DFuqs2PwLiHbcf6CX47?si=843fa6386bed402d','https://open.spotify.com/track/24rDDbSlFY9OHrlJb48CRh?si=ddb5ab8ecf714a96','https://open.spotify.com/track/6dGsBRuavumBs5BghcXF3D?si=61078a26fc5a492e','https://open.spotify.com/track/46wDG6evLn2iPoQ0F8CUWk?si=0770c56ed6a34887','https://open.spotify.com/track/5SmXEPnevlRjBPWBG7oKIi?si=b0357c09c2f2407e','https://open.spotify.com/track/3RwWW7KeVhHGayYJgUL5eZ?si=12507673380645c2']                // e.g. ['spotify:track:...', 'spotify:track:...']
const PLAYLIST_NAME='[s.park record]';
const SONG_COUNT='[21]';

const views=[...document.querySelectorAll('.np')];
if(!views.length)return;
let ctrl=null,loading=false,state='idle',trackIdx=0;

const set=s=>{state=s;views.forEach(v=>{v.dataset.state=s;v.classList.toggle('playing',s==='playing');v.querySelectorAll('[data-record]').forEach(b=>b.setAttribute('aria-pressed',String(s==='playing')))})};
const mmss=ms=>{const t=Math.max(0,Math.floor((ms||0)/1000));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const progress=(p,pos,dur)=>views.forEach(v=>{const b=v.querySelector('.pl-bar i');if(b)b.style.width=Math.max(0,Math.min(1,p))*100+'%';const a=v.querySelector('[data-pl-time]');if(a&&pos!=null)a.textContent=mmss(pos);const z=v.querySelector('[data-pl-dur]');if(z&&dur)z.textContent=mmss(dur)});
const toast=m=>window.SP&&window.SP.toast(m);

// Spotify loads only when someone presses play (no third-party scripts until then)
function load(then){
  if(loading)return;loading=true;
  let slot=document.getElementById('embed-slot');
  if(!slot){slot=document.createElement('div');slot.id='embed-slot';slot.className='embed-slot';document.body.appendChild(slot)}
  window.onSpotifyIframeApiReady=api=>{
    api.createController(slot,{uri:PLAYLIST_URI,width:320,height:80},c=>{
      ctrl=c;
      c.addListener('ready',()=>then&&then());
      c.addListener('playback_update',e=>{
        const d=e.data||{};set(d.isPaused?'paused':'playing');
        progress(d.duration?d.position/d.duration:0,d.position,d.duration);
      });
    });
  };
  const s=document.createElement('script');s.src='https://open.spotify.com/embed/iframe-api/v1';s.async=true;
  s.onerror=()=>{loading=false;toast("couldn't reach Spotify right now")};
  document.body.appendChild(s);
}

function toggle(){
  if(!PLAYLIST_URI){toast('my playlist is coming soon');return}
  if(!ctrl){set('playing');load(()=>ctrl.togglePlay());return}
  ctrl.togglePlay();
}
function skip(dir){
  if(!PLAYLIST_URI){toast('my playlist is coming soon');return}
  if(!TRACKS.length){if(ctrl)ctrl.seek(0);return}
  trackIdx=(trackIdx+dir+TRACKS.length)%TRACKS.length;
  const go=()=>{ctrl.loadUri(TRACKS[trackIdx]);setTimeout(()=>ctrl.play(),400)};
  if(ctrl)go();else{set('playing');load(go)}
}

views.forEach(v=>{
  v.querySelectorAll('.pl-name').forEach(n=>n.textContent=PLAYLIST_NAME);
  v.querySelectorAll('.pl-sub').forEach(n=>n.textContent=`${SONG_COUNT} songs · made for this site`);
  v.querySelectorAll('[data-record]').forEach(b=>b.addEventListener('click',toggle));
  const sk=v.querySelectorAll('[data-juke] .orb:not(.big)');
  if(sk[0])sk[0].addEventListener('click',()=>skip(-1));
  if(sk[1])sk[1].addEventListener('click',()=>skip(1));
  if(!TRACKS.length)sk.forEach(b=>{b.style.opacity='.5';b.title='skip buttons turn on once the song list is added'});
});
})();
