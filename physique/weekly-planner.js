/* FORGE 1.4 — Local seven-day gym planner. No account or server required.
   Assigns supported upper-body A/B and a symptom-conscious movement session.
   Existing logged exercises are protected when the week is rearranged. */
(()=>{
'use strict';
const app=window.FORGE, enhancement=window.ForgeEnhancements;
const mount=document.getElementById('forge-week-planner');
if(!app||!enhancement||!mount)return;
const TODAY=localDate(new Date());
const short=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)};
function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function monday(s){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return localDate(d)}
function datesFor(s){return Array.from({length:7},(_,i)=>addDays(s,i))}
function formatDate(s,opt){return new Date(s+'T12:00:00').toLocaleDateString('en-GB',opt)}
function labelFor(t){return t===1?'Upper body A':t===5?'Upper body B':t===3?'Movement + rehab':t===2?'Optional light gym / recovery':'Recovery day'}
function typeFor(t){return t===1||t===5?'strength':t===3?'rehab':t===2?'light':'rest'}
function hasHistory(s){const d=app.state().days[s];return Boolean(d&&(Object.values(d.exercises||{}).some(Boolean)||(d.tasks?.plan&&(app.planFor(s).type==='strength'||app.planFor(s).type==='rehab'))))}
function isLocked(s){return hasHistory(s)}
function plannedDefault(week){return [addDays(week,0),addDays(week,2),addDays(week,4)]}
function storedSelection(week){const stored=app.state().weekPlans?.[week];if(stored&&Array.isArray(stored.gymDays))return stored.gymDays.filter(s=>datesFor(week).includes(s));return plannedDefault(week)}
function assign(selected){
 const days=[...selected].sort();const out={};
 if(!days.length)return out;
 days.forEach(d=>out[d]=2);
 if(days.length===1){out[days[0]]=1;return out}
 if(days.length===2){out[days[0]]=1;const diff=Math.round((new Date(days[1]+'T12:00:00')-new Date(days[0]+'T12:00:00'))/86400000);out[days[1]]=diff<2?3:5;return out}
 out[days[0]]=1;out[days[days.length-1]]=5;
 out[days[Math.floor((days.length-1)/2)]]=3;
 return out;
}
const thisWeek=monday(TODAY);
let active=addDays(thisWeek,7),selection=new Set(storedSelection(active)),dirty=false;
function lockedGym(s){return isLocked(s)&&['strength','rehab'].includes(app.planFor(s).type)}
function bringLockedIn(){for(const day of datesFor(active))if(lockedGym(day))selection.add(day)}
bringLockedIn();
function switchWeek(next){if(dirty&&!confirm('Discard unsaved changes to this week?'))return;active=next;selection=new Set(storedSelection(active));bringLockedIn();dirty=false;app.renderPlan()}
function previewAssignments(){const draft=assign(selection);for(const date of datesFor(active)){if(isLocked(date))draft[date]=app.templateFor(date)}return draft}
function isSaved(){return !!app.state().weekPlans?.[active]}
function warningMessage(chosen,assigned){
 if(!chosen.length)return 'A recovery week is valid. You can change it later.';
 if(chosen.length===1)return 'One quality upper-body session this week is better than forcing extra sessions.';
 if(chosen.length===2&&Object.values(assigned).filter(n=>n===5).length===0)return 'Your two chosen days are consecutive, so the second is a lighter movement session, not another hard upper-body workout.';
 if(chosen.length>3)return 'Extra selected days are light optional gym/recovery days — not extra heavy sessions while leg symptoms persist.';
 return 'Upper body A and B are separated where possible, with an easier movement/rehab session between.';
}
function renderPicker(){
 const dates=datesFor(active),draft=previewAssignments(),stored=isSaved(),past=active<thisWeek;
 const chosen=[...selection].sort();const aCount=Object.values(draft).filter(n=>n===1||n===5).length;
 const changeLabel=stored?(dirty?'Unsaved changes':'Week saved'):'Not saved yet';
 const subtitle= `${formatDate(active,{day:'numeric',month:'short'})} – ${formatDate(addDays(active,6),{day:'numeric',month:'short',year:'numeric'})}`;
 mount.innerHTML=`<section class="card pad fw-wrap" aria-label="Plan your gym days">
 <div class="fw-title-line"><div><span class="eyebrow">YOUR WEEK, YOUR SCHEDULE</span><h2 class="fw-title">Pick your gym days</h2><p class="small muted" style="margin:5px 0 0">Choose the days you can make it. FORGE arranges the sessions around them.</p></div><span class="fw-status ${stored&&!dirty?'saved':''}">${changeLabel}</span></div>
 <div class="fw-toolbar"><button type="button" class="fw-arrow" data-fw-nav="prev" aria-label="Previous week">‹</button><div class="fw-period"><strong>${subtitle}</strong><span>${active===thisWeek?'This week':active===addDays(thisWeek,7)?'Next week':'Selected week'}</span></div><button type="button" class="fw-arrow" data-fw-nav="next" aria-label="Following week">›</button></div>
 <div class="fw-shortcuts"><button type="button" class="fw-shortcut ${active===thisWeek?'active':''}" data-fw-week="this">This week</button><button type="button" class="fw-shortcut ${active===addDays(thisWeek,7)?'active':''}" data-fw-week="next">Next week</button><button type="button" class="fw-shortcut" data-fw-reset ${past?'disabled':''}>Usual Mon/Wed/Fri</button></div>
 <div class="fw-days" role="group" aria-label="Gym day picker">${dates.map((s,i)=>{const checked=selection.has(s),locked=isLocked(s),disabled=past||locked;return `<button type="button" class="fw-day ${checked?'chosen':''} ${locked?'locked':''}" data-fw-date="${s}" aria-pressed="${checked}" aria-label="${formatDate(s,{weekday:'long',day:'numeric',month:'long'})}, ${checked?'gym day':'not selected'}${locked?', completed session locked':''}" ${disabled?'disabled':''}><span class="fw-weekday">${short[i]}</span><span class="fw-number">${new Date(s+'T12:00:00').getDate()}</span><span class="fw-mark">${locked?'🔒':checked?'✓':'+'}</span></button>`}).join('')}</div>
 <div class="fw-summary"><div><strong>${chosen.length}</strong><span>Gym days</span></div><div><strong>${aCount}</strong><span>Strength sessions</span></div><div><strong>${Object.values(draft).filter(n=>n===3).length}</strong><span>Movement / rehab</span></div></div>
 <p class="fw-note">${warningMessage(chosen,draft)} ${past?'Past weeks are read-only.':''}</p>
 <div class="fw-preview-title"><strong>Proposed weekly programme</strong><span class="tiny muted">${dirty?'Preview — save to apply':stored?'Your saved plan':'Preview — not saved yet'}</span></div>
 <div class="fw-preview">${dates.map((s,i)=>{const t=draft[s]??0,selected=selection.has(s),locked=isLocked(s);return `<div class="fw-preview-row"><div class="fw-preview-date">${short[i]} <span>${formatDate(s,{day:'numeric',month:'short'})}</span></div><span class="fw-preview-name ${typeFor(t)}">${labelFor(t)}</span>${locked?'<span class="fw-locked">Logged</span>':selected?'<span class="fw-gym-dot">Gym</span>':''}</div>`}).join('')}</div>
 <div class="fw-bottom"><button type="button" class="save fw-save" data-fw-save ${past?'disabled':''}>${stored?'Save changes':'Build my week'}</button><span class="small muted">Only this week changes. Previous checklists stay saved.</span></div>
 </section>`;
}
function saveWeek(){
 if(active<thisWeek){app.toast('Past weeks cannot be edited');return}
 const selected=[...selection].sort();const assignments=assign(selected);
 const lockedDays=datesFor(active).filter(isLocked);
 for(const s of lockedDays){assignments[s]=app.templateFor(s);if(lockedGym(s)&&!selection.has(s))selected.push(s)}
 const st=app.state();st.weekPlans ||= {};
 st.weekPlans[active]={gymDays:[...new Set(selected)].sort(),assignments,updatedAt:localDate(new Date())};
 app.persist();selection=new Set(st.weekPlans[active].gymDays);dirty=false;
 app.renderToday();app.renderPlan();app.toast('Gym days scheduled — your week is ready');
}
const originalRenderPlan=enhancement.renderPlan;
window.ForgeWeekPlanner={activeWeek:()=>active,getPreview:()=>previewAssignments,assign};
enhancement.renderPlan=function(){renderPicker();originalRenderPlan()};
mount.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn||btn.disabled)return;
 if(btn.dataset.fwNav){switchWeek(addDays(active,btn.dataset.fwNav==='next'?7:-7));return}
 if(btn.dataset.fwWeek){switchWeek(btn.dataset.fwWeek==='this'?thisWeek:addDays(thisWeek,7));return}
 if(btn.hasAttribute('data-fw-reset')){if(active<thisWeek)return;selection=new Set(plannedDefault(active));bringLockedIn();dirty=true;app.renderPlan();return}
 if(btn.dataset.fwDate){if(active<thisWeek||isLocked(btn.dataset.fwDate))return;if(selection.has(btn.dataset.fwDate))selection.delete(btn.dataset.fwDate);else selection.add(btn.dataset.fwDate);dirty=true;app.renderPlan();return}
 if(btn.hasAttribute('data-fw-save')){saveWeek();return}
});
const style=document.createElement('style');style.textContent=`
.fw-wrap{margin-bottom:21px;background:linear-gradient(143deg,#1b2920,#171d19 53%);border-color:#466044}
.fw-title-line{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.fw-title{font-size:25px;letter-spacing:-.04em;margin:6px 0}.fw-status{font-size:10px;letter-spacing:.025em;white-space:nowrap;background:#354037;color:#cbd9c8;border-radius:25px;padding:6px 9px;font-weight:800}.fw-status.saved{background:#34513c;color:var(--lime)}
.fw-toolbar{display:flex;align-items:center;gap:10px;justify-content:space-between;margin:19px 0 8px}.fw-arrow{width:40px;height:40px;background:#26362a;border:1px solid #4a604b;border-radius:12px;color:var(--text);font-size:23px}.fw-period{display:flex;flex-direction:column;align-items:center;gap:1px}.fw-period strong{font-size:14px}.fw-period span{font-size:11px;color:var(--lime)}
.fw-shortcuts{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 16px}.fw-shortcut{background:#28372c;border:1px solid #435846;color:#dbe5d6;border-radius:20px;padding:7px 11px;font-weight:750;font-size:11px}.fw-shortcut.active{background:#d1efb3;color:#1b2a1a;border-color:#d1efb3}
.fw-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.fw-day{background:#1d2821;color:#b9c8bc;border:1px solid #405347;border-radius:14px;min-height:89px;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;padding:9px 3px}.fw-day.chosen{background:var(--lime);color:#162315;border-color:var(--lime)}.fw-day.locked{opacity:.88;border-style:dashed}.fw-weekday{font-size:11px;font-weight:800}.fw-number{font-size:22px;font-weight:850;line-height:1.1}.fw-mark{font-size:12px;min-height:15px;font-weight:900}.fw-day.chosen .fw-mark{color:#2b5429}.fw-day:disabled{cursor:not-allowed}
.fw-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.fw-summary>div{padding:13px 8px;background:#25352a;border:1px solid #405344;border-radius:12px;text-align:center;display:grid;gap:1px}.fw-summary strong{font-size:23px;line-height:1.2}.fw-summary span{font-size:10px;color:#c6d4c6}.fw-note{font-size:12px;color:#d6e3cf;background:#27382c;border:1px solid #425b46;padding:10px 12px;border-radius:10px;margin:13px 0 19px}
.fw-preview-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;margin-bottom:8px}.fw-preview{border:1px solid var(--line);background:#141b16;border-radius:13px;overflow:hidden}.fw-preview-row{display:flex;align-items:center;gap:8px;padding:11px 12px;border-top:1px solid var(--line);font-size:12px}.fw-preview-row:first-child{border-top:0}.fw-preview-date{min-width:68px;color:#cbd9c8;font-weight:750}.fw-preview-date span{color:var(--muted);font-weight:400;margin-left:4px}.fw-preview-name{flex:1}.fw-preview-name.strength{color:var(--lime);font-weight:750}.fw-preview-name.rehab{color:#b3d8ef;font-weight:750}.fw-preview-name.light{color:#d9dec0}.fw-preview-name.rest{color:var(--muted)}.fw-locked,.fw-gym-dot{border-radius:99px;padding:3px 7px;background:#2c402e;font-size:10px;color:#cae6b9}.fw-locked{background:#493d2c;color:#f0ce9e}.fw-bottom{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:17px}.fw-save{min-width:150px}
@media(max-width:450px){.fw-title{font-size:22px}.fw-title-line{flex-direction:column}.fw-days{gap:4px}.fw-day{border-radius:10px;min-height:80px}.fw-number{font-size:18px}.fw-weekday{font-size:10px}.fw-preview-row{padding:9px 8px}.fw-preview-date{min-width:60px}}
`;document.head.append(style);
app.renderPlan();
})();