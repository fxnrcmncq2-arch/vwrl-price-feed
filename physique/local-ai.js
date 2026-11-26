/* FORGE 1.3 — Optional zero-fee, on-device AI visual check-in. No photo is sent to a paid API. */
(()=>{
'use strict';
const pc=window.ForgePhotoCoach;
if(!pc)return;
const esc=window.FORGE.escapeHTML;
const KEY='forge-visual-ai-v1';
let worker=null,working=false,status='',report=load();
const labels={shoulders:'Shoulders',chest:'Chest',arms:'Arms',torso:'Torso definition'};
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&typeof x==='object'?x:null}catch{return null}}
function store(){try{localStorage.setItem(KEY,JSON.stringify(report))}catch{window.FORGE.toast('AI summary storage unavailable')}}
function matches(){const current=pc.getPhoto('front'),goal=pc.getPhoto('goal');return !!report&&!!current&&report.photoId===current.id&&report.goalId===(goal?.id||null)}
function parse(text){let x=String(text||'').replace(/\*/g,'').toUpperCase();let found={};for(const [field,key] of Object.entries({shoulders:'SHOULDERS',chest:'CHEST',arms:'ARMS',torso:'TORSO'})){
 const pattern=new RegExp('(?:^|\\n)\\s*'+key+'\\s*[:=-]\\s*(PROMINENT|MODERATE|UNCLEAR|DEFINED)','im');let m=x.match(pattern);if(m){const v=m[1].toLowerCase();if(field==='torso'&&v==='prominent')found[field]='defined';else if(field!=='torso'&&v==='defined')found[field]='prominent';else found[field]=v;}}
return found;
}
function suggestions(curr,goal){const picks=[];for(const area of ['shoulders','chest','arms']){
 if(curr[area]==='moderate'&&goal[area]==='prominent')picks.push(area);
}
if(curr.torso==='moderate'&&goal.torso==='defined')picks.push('definition');
return picks.slice(0,2);
}
function word(v){return ({prominent:'visibly prominent',moderate:'less prominent in this photo',defined:'definition visible',unclear:'not reliably visible'})[v]||'not assessed'}
function summaryBlock(title,x){const keys=Object.keys(labels);const detected=keys.filter(k=>!!x[k]).length;
return `<div class="fai-summary"><div class="fai-summary-title">${esc(title)} · ${detected}/4 labels recognised</div>${keys.map(k=>`<div class="fai-summary-line"><strong>${labels[k]}</strong><span>${esc(word(x[k]))}</span></div>`).join('')}</div>`;
}
function render(){const node=document.getElementById('pc-free-ai');if(!node)return;
 const current=pc.getPhoto('front'),goal=pc.getPhoto('goal');const fresh=matches();
 const available=!!navigator.gpu;
 node.innerHTML=`<div class="fai-top"><div><span class="eyebrow">FREE · ON-DEVICE AI</span><h2>Visual physique review</h2><p class="small muted">Uses a small open-source vision model to make cautious observations about your photo and inspiration picture. No subscription or API key.</p></div><span class="pill">£0 / REVIEW</span></div>
 <p class="small muted">The first review downloads model files (approximately 200 MB) over the internet. After loading, photos are processed <strong>on your device</strong>. Your phone needs enough free memory and WebGPU support. This is an experimental feature; model output can be mistaken.</p>
 ${!available?'<div class="callout warn">Your current browser does not report WebGPU support. The existing free pose scan and manual training adjustments still work.</div>':''}
 <button id="fai-run" type="button" class="save" ${!current||working||!available?'disabled':''}>${working?'Review in progress…':fresh?'Run another free AI review':'Analyse my photos for free'}</button>
 ${!current?'<p class="pc-disclaimer">Upload a front photo first. Add your inspiration photo to compare both.</p>':''}
 <div role="status" id="fai-status" class="fai-status">${esc(status)}</div>
 ${fresh?`<div class="fai-reports">${summaryBlock('Current appearance',report.current)}${report.goal?summaryBlock('Target appearance',report.goal):''}</div>
 <div class="pc-result" style="margin-top:12px"><span class="eyebrow">SUGGESTED TRAINING FOCUS</span>
 ${report.focus.length?`<h3>${esc(report.focus.map(k=>({shoulders:'Shoulders',chest:'Chest',arms:'Arms',definition:'Overall definition'})[k]).join(' + '))}</h3><p>These are possible priorities from photo comparison, <strong>not a measurement of muscle deficits</strong>. Training volume will still depend on completed sessions, sciatica symptoms and clinical clearance.</p><button type="button" class="secondary-button" id="fai-apply">Use these as my training priorities</button>`:'<p>No clear comparison-based priorities could be established. Keep your existing programme and selected focus areas.</p>'}
 </div>
 <details class="fai-raw"><summary>See original AI descriptions and limitations</summary><p class="pc-disclaimer">Small vision-language models can invent details. Treat these as tentative photo descriptions, not objective measurements.</p><p class="tiny muted"><strong>Progress picture:</strong> ${esc(report.currentRaw||'No description returned')}</p>${report.goalRaw?`<p class="tiny muted"><strong>Inspiration:</strong> ${esc(report.goalRaw)}</p>`:''}</details>`:
 report&&!fresh?'<p class="pc-disclaimer">Your photos have changed since the last AI analysis. Run it again for a current comparison.</p>':''}
 <p class="pc-disclaimer">Do not use AI photos to diagnose pain, estimate body fat, set a deadline, or increase weights through sciatica. A photo cannot reliably measure actual muscle gain. Compare photos every 4 weeks under similar lighting.</p>`;
}
function shrink(file){return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(file),im=new Image();
 im.onload=()=>{try{const max=640,scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));canvas.getContext('2d',{alpha:false}).drawImage(im,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.7);URL.revokeObjectURL(url);resolve(data)}catch(e){URL.revokeObjectURL(url);reject(e)}};
 im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Photo could not be opened'))};im.src=url;
})}
async function start(){if(working)return;const current=pc.getPhoto('front'),goal=pc.getPhoto('goal');if(!current)return;
 working=true;status='Preparing photos privately on this device…';render();let idCurrent=current.id,idGoal=goal?.id||null;
 try{
  const inputs=[{role:'current',data:await shrink(current.blob)}];if(goal)inputs.push({role:'goal',data:await shrink(goal.blob)});
  if(worker){worker.terminate();worker=null;}
  worker=new Worker('./local-ai-worker.js?v=1.3.0',{type:'module'});
  const result=await new Promise((resolve,reject)=>{
   let settled=false;const finish=(fn,data)=>{if(settled)return;settled=true;fn(data)};
   worker.onerror=e=>finish(reject,new Error('Could not start the local AI model on this device'));
   worker.onmessage=e=>{const data=e.data||{};if(data.kind==='status'){status=data.message||'Working on your photo…';const el=document.getElementById('fai-status');if(el)el.textContent=status;}
   if(data.kind==='error')finish(reject,new Error(data.message||'AI model failed'));
   if(data.kind==='result')finish(resolve,data.results||{});
   };
   worker.postMessage({kind:'analyse',images:inputs});
  });
  if(pc.getPhoto('front')?.id!==idCurrent||((pc.getPhoto('goal')?.id)||null)!==idGoal)throw Error('Photos changed during the review. Please run it again.');
  const c=parse(result.current),g=parse(result.goal),focus=result.goal?suggestions(c,g):[];
  if(Object.keys(c).length<2)throw Error('The free model could not give a usable description of this photo. Try a well-lit, straight-on image.');
  report={photoId:idCurrent,goalId:idGoal,current:c,goal:result.goal?g:null,focus,created:new Date().toISOString(),currentRaw:String(result.current||'').slice(0,1200),goalRaw:String(result.goal||'').slice(0,1200)};
  store();status='Review complete — inspect the observations before using any training suggestions.';
 }catch(e){status='Free AI review unavailable: '+String(e.message||e).slice(0,280)+'. Try again later, or use the existing photo scan; no payment is needed.';}
 finally{working=false;if(worker){worker.terminate();worker=null;}render();}
}
document.addEventListener('click',event=>{
 const el=event.target.closest('#fai-run,#fai-apply');if(!el)return;
 if(el.id==='fai-run')start();
 if(el.id==='fai-apply'&&matches()&&report?.focus?.length){
  if(!confirm('Use these tentative AI observations as your gym focus areas? This will never override flare-day restrictions or automatically add training volume.'))return;
  pc.applyFocus(report.focus);
  status='Training priorities updated. Exercise volume remains governed by symptoms and recorded sessions.';
  render();
 }
});
const css=document.createElement('style');css.textContent=`#pc-free-ai{margin:0 0 16px;border-color:#64805b}.fai-top{display:flex;align-items:start;justify-content:space-between;gap:10px}.fai-top h2{font-size:21px;letter-spacing:-.04em;margin:6px 0}.fai-top p{margin:7px 0}.fai-top .pill{white-space:nowrap}.fai-status{font-size:12px;color:#c6ee8d;margin-top:11px;white-space:normal;line-height:1.5}.fai-reports{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.fai-summary{background:#202c23;padding:13px;border:1px solid #456248;border-radius:13px}.fai-summary-title{font-size:12px;font-weight:800;color:var(--lime);margin-bottom:9px}.fai-summary-line{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #39473a;padding:8px 0;font-size:11px}.fai-summary-line span{text-align:right;color:#bccabd}.fai-raw{margin-top:14px;font-size:12px;color:#afc8b0}.fai-raw summary{cursor:pointer}@media(max-width:600px){.fai-reports{grid-template-columns:1fr}.fai-top{flex-direction:column}}`;
document.head.append(css);
document.addEventListener('forge:photos-rendered',render);
render();
})();