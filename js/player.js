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
const PLAYLIST_URI='';          // e.g. 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
const TRACKS=[];                // e.g. ['spotify:track:...', 'spotify:track:...']
const PLAYLIST_NAME='[playlist name]';
const SONG_COUNT='[n]';

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
