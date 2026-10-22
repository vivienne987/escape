import {createRoom} from './room.js';
import {createGame} from './game.js';
import {portraits} from './portrait-assets.js';
import {deskPapers,paperImage} from './documents.js';
const paperImages=deskPapers.map((_,i)=>paperImage(i));
import {introHtml,learningHtml,debriefHtml,reflectionText,sourcesHtml} from './content.js';
const $=id=>document.getElementById(id);
const modal=$('modal');
let room=null,target=null,starting=false,previousCoins=new Set(),safeFlags=[false,false],lastFocus=null;
const held=new Set();
const game=createGame({onChange:renderState,onEvent:event=>{
 if(starting)return;
 if(event.kind==='win'||event.kind==='loss'){
  show(event.title,event.html+debriefHtml+sourcesHtml,[['Play again',restart,'primary'],['Reflection draft',showReflection]],'AFTER THE ROOM');
 }else if(event.kind==='desk'){
  const positions=[[5,7,-8],[29,3,7],[66,5,-7],[48,44,8],[7,48,10],[75,43,-9],[28,49,-5]];
  show(event.title,`${event.html}<div class="desk-sheets" aria-label="Seven loose papers on the writing desk">${deskPapers.map((_,i)=>`<button class="paper-choice" data-paper="${i}" aria-label="Examine loose paper ${i+1}" style="left:${positions[i][0]}%;top:${positions[i][1]}%;--paper-angle:${positions[i][2]}deg"><img src="${paperImages[i]}" alt="" draggable="false"></button>`).join('')}</div><p class="note">Select a sheet to take a closer look.</p>`,[['Back to room',close]],'THE WRITING DESK');
  modal.classList.add('desk-modal');
  for(const button of modal.querySelectorAll('[data-paper]'))button.onclick=()=>game.interact('paper'+button.dataset.paper);
 }else if(event.kind==='paper'){
  show(event.title,`<div class="document-view"><img src="${paperImages[event.paperIndex]}" alt="${event.paperIndex===3?'A worn handwritten memorandum with the marks △ ○ ☆ □.':deskPapers[event.paperIndex].description}"></div>${event.html}`,[['Back to papers',()=>game.interact('desk'),'primary'],['Back to room',close]],'LOOSE PAPER');
 }else if(event.kind==='portrait'){
  const i=event.portraitIndex;const painting=portraits[i];
  show(painting.title,`<div class="portrait-layout"><div><div class="painting-viewport" id="paintingViewport"><img src="${painting.src}" alt="${painting.description}" draggable="false"></div><button id="magnifyPainting" class="magnify" type="button" aria-pressed="false">Magnify painting</button><p class="note">Fictional artwork created for this game.</p></div><div class="observation"><p>Study the scene and its objects. A small colored detail echoes one of the symbols on the desk paper.</p>${event.html}<form id="observationForm"><label for="observedShape">What shape do you notice?</label><select id="observedShape" required><option value="">Choose a shape…</option><option value="triangle">△ Triangle</option><option value="circle">○ Circle</option><option value="star">☆ Star</option><option value="square">□ Square</option></select><label for="observedColor">What color is that detail?</label><select id="observedColor" required><option value="">Choose a color…</option>${['green','purple','blue','yellow','red','brown'].map(c=>`<option value="${c}">${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select><button class="primary" type="submit">Record observation</button></form><p class="note">The paint has faded. Look for the underlying color, not its brightness. Magnify to inspect the brushwork; scroll inside the enlarged painting to explore.</p></div></div>`,[['Back to room',close]],'LOOK CLOSER');
  modal.classList.add('portrait-modal');
  $('observationForm').onsubmit=e=>{e.preventDefault();game.submitObservation(i,$('observedShape').value,$('observedColor').value);};
  $('magnifyPainting').onclick=()=>{const zoomed=$('paintingViewport').classList.toggle('is-zoomed');$('magnifyPainting').textContent=zoomed?'Show whole painting':'Magnify painting';$('magnifyPainting').setAttribute('aria-pressed',String(zoomed));};
 }else if(event.kind==='code'){
  show(event.title,event.html+`<form id="codeForm"><div class="code-row">${[1,2,3,4].map(n=>`<label>Dial ${n}<select aria-label="Color ${n}" id="dial${n}"><option value="">Choose…</option>${['green','purple','blue','yellow','red','orange'].map(c=>`<option value="${c}">${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select></label>`).join('')}</div><button class="primary" type="submit">Unlock safe</button></form>`,[['Back to room',close]],'LITERACY · SAFE ONE');
  $('codeForm').onsubmit=e=>{e.preventDefault();game.submitCode([1,2,3,4].map(n=>$('dial'+n).value));};
 }else{
  show(event.title,event.html,[['Back to room',close,'primary'],['Clue notebook',showJournal]],'DISCOVERY');
 }
}});
function renderState(s){
 $('app').classList.toggle('title-mode',s.status==='ready');
 $('titleScreen').hidden=s.status!=='ready';
 $('timer').textContent=String(Math.floor(s.seconds/60)).padStart(2,'0')+':'+String(s.seconds%60).padStart(2,'0');
 document.querySelector('.clock').classList.toggle('urgent',s.seconds<=120);
 $('coinCount').textContent=`${s.coins.size} / 5 COINS`;
 $('keyCount').textContent=`${s.keys} / 2 KEYS`;
 if(room){
  for(const id of s.coins)if(!previousCoins.has(id))room.setCollected(id);
  if(s.safe1&&!safeFlags[0])room.setSafeOpen(1);
  if(s.safe2&&!safeFlags[1])room.setSafeOpen(2);
 }
 previousCoins=new Set(s.coins);safeFlags=[s.safe1,s.safe2];
}
function release(){for(const code of held)room?.setKey(code,false);held.clear();}
function show(title,html,actions=[],tag='FIELD NOTES'){
 release();modal.classList.remove('portrait-modal','desk-modal');if(!modal.open)lastFocus=document.activeElement;
 $('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalTag').textContent=tag;
 $('modalActions').replaceChildren();
 for(const [label,fn,cls] of actions){const b=document.createElement('button');b.textContent=label;b.className=cls||'';b.onclick=fn;$('modalActions').append(b);}
 $('close').hidden=false;
 if(!modal.open)modal.showModal();else $('modalTitle').scrollIntoView({block:'nearest'});
 modal.scrollTop=0;
}
function close(){modal.close();if(lastFocus&&lastFocus!==document.body)lastFocus.focus();else $('world').focus({preventScroll:true});}
$('close').onclick=close;
modal.addEventListener('cancel',e=>{e.preventDefault();close();});
function start(){room?.reset();starting=true;game.start();starting=false;close();toast('Explore the room. Drag to look around.');}
function restart(){show('Start a new attempt?', '<p>This resets the timer, clues, coins, and keys.</p>',[['Restart room',()=>{room?.reset();previousCoins=new Set();safeFlags=[false,false];game.reset();welcome();},'primary'],['Keep exploring',close]]);}
function welcome(){if(modal.open)modal.close();if(room){room.camera.position.set(2.5,1.9,3.3);room.camera.lookAt(-1,1.65,-2);}$('app').classList.add('title-mode');$('titleScreen').hidden=false;$('startGame').focus({preventScroll:true});}
function howTo(){show('Find your way out.',`<div class="brief"><p>01 &nbsp; Look closely at four old paintings and decode the paper.</p><p>02 &nbsp; Find five coins and open the resource safe.</p><p>03 &nbsp; Take both keys to the exit before 15 minutes run out.</p></div><p><strong>Move:</strong> W A S D or on-screen arrows. <strong>Look:</strong> drag the room, or use arrow keys. Aim the crosshair at an object, move close, then press E or Inspect.</p><p>The timer begins when you start and continues while you read. Your clue notebook saves discoveries, and Hint can help you find your next step.</p>`,[['Back to menu',close,'primary']],'HOW TO PLAY');}
$('startGame').onclick=start;$('howTo').onclick=howTo;$('titleAbout').onclick=showAbout;
function showJournal(){
 const s=game.state;
 show('Your clue notebook',`<p>Everything you have discovered so far stays here.</p><div class="clue"><strong>Desk paper</strong>${s.paper?'<p class="symbols">△ ○ ☆ □</p>':'<p>Not found. Search the loose desk papers.</p>'}</div><div class="clue"><strong>Decoding legend</strong><p>${s.legend?'Look for familiar shapes in the paintings’ scenes and objects. Compare their colors with the marks on the papers.':'Not found. Look under the chair.'}</p></div><div class="clue"><strong>Wall pictures</strong><p>${[0,1,2,3].map(i=>s.portraits.has(i)?`${i+1}: ${['△ GREEN','○ PURPLE','☆ BLUE','□ YELLOW'][i]}`:`${i+1}: not yet identified`).join('<br>')}</p></div><div class="clue"><strong>Resources & keys</strong><p>${s.coins.size}/5 coins · ${s.keys}/2 keys<br>Safe One: ${s.safe1?'open':'locked'} · Safe Two: ${s.safe2?'open':'locked'}</p></div>`,[['Back to room',close,'primary']]);
}
function showReflection(){show('Game creation reflection',`<p class="note">207-word draft. Personalize this to reflect your own experience before submitting.</p>${reflectionText.split('\n\n').map(p=>`<p>${p}</p>`).join('')}`,[['Back to room',close],['Learning & sources',showAbout]],'ASSIGNMENT · INDIVIDUAL REFLECTION');}
function showAbout(){show('History through interaction',introHtml+learningHtml+debriefHtml+sourcesHtml,[[game.state.status==='ready'?'Back to menu':'Back to room',close,'primary'],['Reflection draft',showReflection]],'DIGITAL HUMANITIES');}
let toastTimeout;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
$('journal').onclick=showJournal;$('hint').onclick=()=>game.hint();$('about').onclick=showAbout;$('restart').onclick=restart;
$('inspect').onclick=()=>{if(!modal.open)room?.interact();};
window.addEventListener('keydown',e=>{
 if(modal.open||game.state.status!=='playing')return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyE','Space'].includes(e.code)){
  e.preventDefault();if(e.code==='KeyE'||e.code==='Space'){if(!e.repeat)room?.interact();return;}
  held.add(e.code);room?.setKey(e.code,true);
 }
 if(e.code==='KeyJ')showJournal();
});
window.addEventListener('keyup',e=>{held.delete(e.code);room?.setKey(e.code,false);});
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
let drag=null;
$('world').addEventListener('pointerdown',e=>{if(modal.open||game.state.status!=='playing')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||modal.open)return;room?.setLook(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(event,()=>drag=null);
for(const b of document.querySelectorAll('[data-key]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(modal.open)return;b.setPointerCapture(e.pointerId);held.add(b.dataset.key);room?.setKey(b.dataset.key,true);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{held.delete(b.dataset.key);room?.setKey(b.dataset.key,false);});
}
try{
 room=createRoom({canvas:$('world'),onInteract:id=>game.interact(id),onTarget:obj=>{target=obj;$('targetText').textContent=obj?obj.label:'Move closer to an object';$('inspect').disabled=!obj;}});
 $('loading').hidden=true;renderState(game.state);welcome();
 let prev=performance.now();
 function frame(now){const dt=Math.min((now-prev)/1000,.05);prev=now;game.tick();room.update(dt,game.state.status==='playing'&&!modal.open);requestAnimationFrame(frame);}
 requestAnimationFrame(frame);window.addEventListener('resize',()=>room.resize());
}catch(err){$('loading').hidden=true;show('The 3D room could not start',`<p>This game requires a browser with WebGL enabled. Try a current Chrome, Edge, Firefox, or Safari browser with hardware acceleration.</p><p id="errorDetail"></p>`);$('errorDetail').textContent=err.message;console.error(err);}
