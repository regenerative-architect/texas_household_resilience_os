(function(){
'use strict';
/* Upgrade layer: preserves the original local-first OS and adds explicitly shareable multiplayer records,
   live official-data adapters, cross-domain coordination, local AI, and diagnostics. */
APP.version='2.0.0';APP.schema=Math.max(APP.schema||1,4);APP.updated='2026-09-28';
const EXTRA_ROUTES=[
  ['collaboration','Collaboration Hub','Collaboration','◎'],
  ['cross-domain','Cross-Domain Studio','Collaboration','⇄'],
  ['live-data','Texas Live Context','Research','◉'],
  ['source-library','Source Library','Research','⌘'],
  ['local-ai','Local AI Lab','Research','✦'],
  ['diagnostics','Diagnostics','System','✓']
].map(([id,title,group,icon])=>({id,title,group,icon}));
for(const r of EXTRA_ROUTES)if(!ROUTES.some(x=>x.id===r.id))ROUTES.push(r);
for(const id of ['collaboration','live-data','local-ai'])if(!TOP.includes(id))TOP.push(id);
Object.assign(ES_ROUTE,{
  'Collaboration Hub':'Centro de colaboración','Cross-Domain Studio':'Estudio interdisciplinario','Texas Live Context':'Contexto en vivo de Texas','Source Library':'Biblioteca de fuentes','Local AI Lab':'Laboratorio de IA local','Diagnostics':'Diagnósticos','Collaboration':'Colaboración'
});

const FALLBACK_CONTEXT={
 market_snapshot_2025:{active_homeowners_policies:8233096,average_annual_homeowners_premium_usd:3489,total_insured_value_usd:2404731301000,direct_written_premium_usd:19750000000,companies:157,groups:81,source:'Texas Department of Insurance',source_url:'https://tdi.texas.gov/general/texas-homeowners-insurance-market-overview.html',evidence_class:'A',notes:'2025 statewide homeowners market context; total insured value is identified by TDI as preliminary.'},
 loss_snapshot_2025:{paid_losses_major_perils_usd:8740000000,wind_hail_average_share_since_2019_pct:62,source:'Texas Department of Insurance',source_url:'https://www.tdi.texas.gov/news/2026/tdi06222026.html',evidence_class:'A'},
 rate_filing_context_2026:{avg_filed_rate_request_30_day_august_pct:-0.8,avg_filed_rate_request_90_day_june_august_pct:-1.8,source:'Texas Department of Insurance',source_url:'https://tdi.texas.gov/general/texas-homeowners-insurance-market-overview.html',evidence_class:'A'},
 flood_planning:{state_plan_year:2024,regional_flood_planning_groups:15,planning_group_members_over:350,public_meetings_over:550,source:'Texas Water Development Board',source_url:'https://www.twdb.texas.gov/flood/planning/sfp/2024/index.asp',evidence_class:'A'},
 nfip_waiting_period:{general_days:30,source:'National Flood Insurance Program',source_url:'https://www.floodsmart.gov/get-insured/buy-a-policy',evidence_class:'A',notes:'General NFIP rule with listed exceptions; private flood products may differ.'},
 wildfire:{firewise_sites_texas_over:100,immediate_noncombustible_zone_feet:'0–5',source:'Texas A&M Forest Service',source_url:'https://tfsweb.tamu.edu/wildfire-and-other-disasters/communities-prevention-and-preparedness/firewise-usa-program/',evidence_class:'C'},
 regions:[]
};
const FALLBACK_INTEGRATION={domains:['household','insurance-literacy','housing','construction','water','energy','health','mobility','emergency-management','finance','social-services','research','municipal-planning','wildfire','flood'],roles:['Household lead','Renter','Homeowner','Housing counselor','Emergency manager','Municipal planner','Water specialist','Energy specialist','Health continuity specialist','Accessibility advocate','Contractor / building specialist','Insurance educator','Nonprofit coordinator','Researcher','Community volunteer'],templates:[
 {id:'freeze-burst',name:'Freeze → pipe burst → displacement',domains:['water','housing','insurance-literacy','energy','health'],tasks:['Locate and label water shutoff','Review plumbing/freeze policy language','Map safe heat continuity','Document vulnerable plumbing','Plan temporary lodging and accessibility needs','Track repair scope and receipts']},
 {id:'hail-roof',name:'Hail + aging roof + high deductible',domains:['housing','construction','insurance-literacy','finance'],tasks:['Record roof age/material/warranty','Inspect or document current condition','Translate percentage deductible to dollars','Compare resilient roof options','Plan reserve contribution','Verify insurer mitigation documentation requirements']},
 {id:'flood-displacement',name:'Flood exposure + displacement continuity',domains:['water','housing','insurance-literacy','mobility','health','emergency-management'],tasks:['Check official flood-planning/map context','Verify flood coverage and waiting periods','Protect inventory/document backups','Plan evacuation and transport','Identify accessible/pet-capable temporary housing','Track local recovery resources']},
 {id:'medical-outage',name:'Extended outage + medical continuity',domains:['energy','health','mobility','emergency-management','insurance-literacy'],tasks:['List electricity-dependent medical needs','Build medically appropriate backup-power plan','Identify cooling/heating contingency','Set transport fallback','Record emergency contacts','Verify property/food-loss terms without assuming coverage']},
 {id:'wildfire-home',name:'Wildfire home-hardening working group',domains:['wildfire','housing','construction','emergency-management','insurance-literacy'],tasks:['Assess 0–5 foot immediate zone','Reduce ember-entry vulnerabilities','Document roof/vent/deck conditions','Coordinate evacuation plan','Review community Firewise/CWPP resources','Verify insurance documentation needs']},
 {id:'rural-continuity',name:'Rural well + septic + power continuity',domains:['water','energy','housing','health','mobility'],tasks:['Map well and pump dependencies','Map septic dependencies','Plan safe backup power','Maintain potable-water reserve','Plan contractor/service-distance contingencies','Document repair contacts and access constraints']}
]};
let contextData=FALLBACK_CONTEXT, integrationData=FALLBACK_INTEGRATION, resourceData=[];

state.collab=state.collab||{profile:{name:'',role:'Household lead'},room:'',server:'',sharedTasks:[],comments:[],pending:[],connectedMode:'offline'};
state.collab.pending=state.collab.pending||[];
state.sharedEvidence=state.sharedEvidence||[];
state.decisions=state.decisions||[];
state.incidents=state.incidents||[];
state.workingGroups=state.workingGroups||[];
state.upgradePrefs=state.upgradePrefs||{showSplash:true};

const collab=new TXCollabClient();
let installPrompt=null;
function fmt(n){return new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(Number(n)||0)}
function when(v){try{return new Date(v).toLocaleString()}catch{return v||''}}
function uniqueMerge(arr,item){const i=arr.findIndex(x=>x.id===item.id);if(i>=0)arr[i]={...arr[i],...item};else arr.push(item)}
async function persistUpgrade(){try{await save()}catch(e){console.error(e)}}
function statusDot(cls=''){return `<span class="live-dot ${cls}"></span>`}
function safeURL(url){try{const u=new URL(String(url||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function external(url,label){const href=safeURL(url);return href?`<a href="${safe(href)}" target="_blank" rel="noopener noreferrer">${safe(label)}</a>`:`<span class="tiny">${safe(label)} (invalid URL)</span>`}

function shareEvent(evt){
  const clean=TXCollabSanitize(evt);
  if(state.collab.room){
    uniqueMerge(state.collab.pending,clean);persistUpgrade();
    if(collab.status==='remote')return collab.send(clean);
    applySharedEvent(clean,'local-only');return clean;
  }
  applySharedEvent(clean,'local-only');return clean;
}
function flushPending(){if(collab.status!=='remote'||!state.collab.pending?.length)return;for(const evt of [...state.collab.pending])collab.send(evt)}
async function applySharedEvent(evt,mode){
  if(!evt||!evt.type)return;
  if(mode==='remote'&&evt.id&&state.collab.pending?.some(x=>x.id===evt.id))state.collab.pending=state.collab.pending.filter(x=>x.id!==evt.id);
  if(evt.type==='shared-task')uniqueMerge(state.collab.sharedTasks,evt);
  else if(evt.type==='comment')uniqueMerge(state.collab.comments,evt);
  else if(evt.type==='evidence')uniqueMerge(state.sharedEvidence,evt);
  else if(evt.type==='decision')uniqueMerge(state.decisions,evt);
  else if(evt.type==='incident')uniqueMerge(state.incidents,evt);
  else if(evt.type==='connection'){state.collab.connectedMode=evt.status||'offline';if(evt.status==='remote')setTimeout(flushPending,0)}
  else if(evt.type==='presence'){}
  else if(evt.type==='error'){toast(evt.message||'Collaboration error')}
  if(['shared-task','comment','evidence','decision','incident','connection'].includes(evt.type))await persistUpgrade();
  if(document.querySelector('[data-route="collaboration"].active'))renderCollaboration();
  if(document.querySelector('[data-route="cross-domain"].active'))renderCrossDomain();
}
collab.on((evt,mode)=>applySharedEvent(evt,mode));

function initSplash(){
  const s=$('#upgradeSplash');if(!s||state.upgradePrefs.showSplash===false)return;
  s.hidden=false;
  const close=()=>{s.classList.add('closing');setTimeout(()=>{s.hidden=true;s.classList.remove('closing')},380)};
  $('#splashClose')?.addEventListener('click',close,{once:true});
  setTimeout(close,matchMedia('(prefers-reduced-motion: reduce)').matches?650:1900);
}

function renderCollaboration(){
  const p=state.collab.profile||{};const serverDefault=location.protocol==='https:'?`wss://${location.host}/ws`:location.protocol==='http:'?`ws://${location.host}/ws`:'';
  $('#collabName').value=p.name||'';$('#collabRole').value=p.role||'Household lead';$('#collabRoom').value=state.collab.room||'';$('#collabServer').value=state.collab.server||serverDefault;
  const mode=collab.status==='remote'?'Remote multiplayer':collab.status==='local'?'Local room / cross-tab':'Offline records';
  const cls=collab.status==='remote'?'ok':collab.status==='local'?'warn':'';
  $('#collabStatus').innerHTML=`<span class="upgrade-badge">${statusDot(cls)} ${safe(mode)}</span> <span class="upgrade-badge">Room: ${safe(state.collab.room||'not joined')}</span> <span class="upgrade-badge">Pending sync: ${state.collab.pending?.length||0}</span>`;
  const members=[...collab.presence.values()];
  $('#presenceList').innerHTML=members.length?members.map(m=>`<span class="presence-chip">${safe(m.name||'Participant')} · ${safe(m.role||'')}</span>`).join(''):`<span class="presence-chip">${safe(p.name||'You')} · ${safe(p.role||'Household lead')}</span>`;
  renderTasks();renderComments();renderEvidence();renderDecisions();renderIncidents();
  const all=[...state.collab.sharedTasks.map(x=>({...x,_k:'Task'})),...state.collab.comments.map(x=>({...x,_k:'Comment'})),...state.sharedEvidence.map(x=>({...x,_k:'Evidence'})),...state.decisions.map(x=>({...x,_k:'Decision'})),...state.incidents.map(x=>({...x,_k:'Incident'}))].sort((a,b)=>String(b.created||b.eventTime||'').localeCompare(String(a.created||a.eventTime||''))).slice(0,40);
  $('#collabActivity').innerHTML=all.length?all.map(x=>`<div class="activity-item"><strong>${safe(x._k)}</strong> · ${safe(x.title||x.question||x.kind||x.text||'Update')}<div class="tiny">${safe(when(x.created||x.eventTime))}</div></div>`).join(''):'<div class="empty">No shared coordination activity yet.</div>';
}
function renderTasks(){
  const statuses=['Proposed','Active','Done'];const tasks=state.collab.sharedTasks||[];
  $('#taskBoard').innerHTML=statuses.map(st=>`<div class="kanban-col"><h3>${st} <span class="tag">${tasks.filter(t=>(t.status||'Proposed')===st).length}</span></h3>${tasks.filter(t=>(t.status||'Proposed')===st).map(taskCard).join('')||'<div class="tiny">No tasks</div>'}</div>`).join('');
}
function taskCard(t){const next=(t.status||'Proposed')==='Proposed'?'Active':(t.status==='Active'?'Done':'Proposed');return `<div class="task-card"><h4>${safe(t.title)}</h4><div class="task-meta"><span class="tag">${safe(t.domain||'cross-domain')}</span>${t.owner?`<span class="tag">${safe(t.owner)}</span>`:''}${t.due?`<span class="tag">Due ${safe(t.due)}</span>`:''}</div>${t.note?`<p class="tiny">${safe(t.note)}</p>`:''}<button data-task-next="${safe(t.id)}" data-next-status="${safe(next)}">Move to ${safe(next)}</button></div>`}
function renderComments(){const rows=(state.collab.comments||[]).slice().sort((a,b)=>String(b.created).localeCompare(String(a.created))).slice(0,30);$('#commentFeed').innerHTML=rows.length?rows.map(c=>`<div class="shared-note"><div>${safe(c.text)}</div><div class="tiny">${safe(when(c.created))}</div></div>`).join(''):'<div class="empty">No comments yet.</div>'}
function renderEvidence(){const rows=(state.sharedEvidence||[]).slice().sort((a,b)=>String(b.created).localeCompare(String(a.created))).slice(0,30);$('#sharedEvidenceList').innerHTML=rows.length?rows.map(v=>`<div class="decision-record"><div class="task-meta"><span class="tag evidence-${safe(v.grade||'C')}">${safe(v.grade||'C')}</span><span class="tag">${safe(v.source||'Source')}</span></div><strong>${safe(v.title)}</strong>${v.url?`<div>${external(v.url,'Open evidence')}</div>`:''}${v.note?`<p class="tiny">${safe(v.note)}</p>`:''}<div class="tiny">${safe(when(v.created))}</div></div>`).join(''):'<div class="empty">No shared evidence records yet.</div>'}
function renderDecisions(){const rows=(state.decisions||[]).slice().sort((a,b)=>String(b.created).localeCompare(String(a.created))).slice(0,25);$('#decisionList').innerHTML=rows.length?rows.map(d=>`<div class="decision-record"><strong>${safe(d.question)}</strong><p>${safe(d.decision)}</p><div class="tiny">Review: ${safe(d.revisitDate||'not set')} · ${safe(when(d.created))}</div></div>`).join(''):'<div class="empty">No shared decision records yet.</div>'}
function renderIncidents(){const rows=(state.incidents||[]).slice().sort((a,b)=>String(b.eventTime||b.created).localeCompare(String(a.eventTime||a.created))).slice(0,30);$('#incidentList').innerHTML=rows.length?rows.map(i=>`<div class="incident-strip"><strong>${safe(i.kind||'Incident')} · ${safe(i.title)}</strong><div>${safe(i.note||'')}</div><div class="tiny">${safe(i.status||'Open')} · ${safe(when(i.eventTime||i.created))}</div></div>`).join(''):'<div class="empty">Incident coordination is empty. Do not use this feature as a substitute for 911 or official emergency alerts.</div>'}

function connectCollab(){
  state.collab.profile={name:$('#collabName').value.trim()||'Participant',role:$('#collabRole').value};state.collab.room=$('#collabRoom').value.trim();state.collab.server=$('#collabServer').value.trim();persistUpgrade();
  collab.connect({server:state.collab.server,room:state.collab.room,name:state.collab.profile.name,role:state.collab.profile.role}).then(mode=>{state.collab.connectedMode=mode;persistUpgrade();if(mode==='remote')flushPending();toast(mode==='remote'?'Remote collaboration connected':'Local collaboration room active');renderCollaboration()}).catch(e=>{toast(`Remote sync unavailable: ${e.message}. Local records remain usable.`);collab.connect({server:'',room:state.collab.room,name:state.collab.profile.name,role:state.collab.profile.role});renderCollaboration()});
}
function randomRoom(){const a=new Uint8Array(4);crypto.getRandomValues(a);return 'TXR-'+[...a].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}
function addSharedTask(){const title=$('#sharedTaskTitle').value.trim();if(!title)return toast('Enter a task title');shareEvent({id:uid(),type:'shared-task',created:new Date().toISOString(),title,domain:$('#sharedTaskDomain').value,owner:$('#sharedTaskOwner').value.trim(),status:'Proposed',due:$('#sharedTaskDue').value,note:$('#sharedTaskNote').value.trim()});$('#sharedTaskTitle').value='';$('#sharedTaskNote').value=''}
function sendComment(){const text=$('#sharedComment').value.trim();if(!text)return;shareEvent({id:uid(),type:'comment',created:new Date().toISOString(),targetId:'workspace',text});$('#sharedComment').value=''}
function addEvidence(){const title=$('#evidenceTitle').value.trim(),url=$('#evidenceUrl').value.trim();if(!title)return toast('Enter an evidence title');shareEvent({id:uid(),type:'evidence',created:new Date().toISOString(),title,url,source:$('#evidenceSource').value.trim(),grade:$('#evidenceGrade').value,note:$('#evidenceNote').value.trim()});$('#evidenceTitle').value='';$('#evidenceUrl').value='';$('#evidenceNote').value=''}
function addDecision(){const question=$('#decisionQuestion').value.trim(),decision=$('#decisionText').value.trim();if(!question||!decision)return toast('Enter both the question and decision');shareEvent({id:uid(),type:'decision',created:new Date().toISOString(),question,decision,evidenceIds:[],revisitDate:$('#decisionReview').value});$('#decisionQuestion').value='';$('#decisionText').value=''}
function addIncident(){const title=$('#incidentTitle').value.trim();if(!title)return toast('Enter an incident title');shareEvent({id:uid(),type:'incident',created:new Date().toISOString(),eventTime:new Date().toISOString(),kind:$('#incidentKind').value,title,note:$('#incidentNote').value.trim(),status:$('#incidentStatus').value});$('#incidentTitle').value='';$('#incidentNote').value=''}
function exportHandoff(){const out={schema:'tx-resilience-shared-handoff-v1',exported:new Date().toISOString(),room:state.collab.room||null,privacy:'This file intentionally excludes policy numbers, income, claims, inventory values, household digital-twin fields and vault files.',shared:{tasks:state.collab.sharedTasks,evidence:state.sharedEvidence,decisions:state.decisions,incidents:state.incidents,comments:state.collab.comments}};download(`tx-resilience-shared-handoff-${today()}.json`,JSON.stringify(out,null,2),'application/json')}

const DOMAIN_DESC={
 'household':'Goals, dependents, pets, accessibility, documentation and recovery priorities.',
 'insurance-literacy':'Policy structure, deductibles, exclusions, documentation and official verification.',
 'housing':'Dwelling condition, displacement, habitability, maintenance and repair sequencing.',
 'construction':'Roof, envelope, drainage, structural, electrical, plumbing and resilient retrofit scope.',
 'water':'Flood, plumbing, shutoffs, well/pump, potable water and wastewater continuity.',
 'energy':'Grid outage, HVAC, refrigeration, backup power, fuel and critical loads.',
 'health':'Medication, medical devices, temperature exposure, disability/accessibility and continuity.',
 'mobility':'Evacuation, accessible transport, fuel/charging and repair/service access.',
 'emergency-management':'Warnings, evacuation, damage reporting, mass care and recovery coordination.',
 'finance':'Deductible reserve, liquidity, debt exposure, temporary housing and repair cashflow.',
 'social-services':'Shelter, nonprofit assistance, benefits navigation and vulnerable-household support.',
 'research':'Evidence quality, provenance, uncertainty, modeling assumptions and evaluation.',
 'municipal-planning':'Hazard mitigation, flood planning, permitting, infrastructure and public engagement.',
 'wildfire':'Embers, immediate zone, defensible space, evacuation and fire-adapted community work.',
 'flood':'Mapped and unmapped flood risk, drainage, rainfall, river/coastal flooding and mitigation.'
};
function renderCrossDomain(){
  $('#domainMatrix').innerHTML=(integrationData.domains||FALLBACK_INTEGRATION.domains).map(d=>`<div class="domain-card"><h3>${safe(d.replaceAll('-',' '))}</h3><p class="tiny">${safe(DOMAIN_DESC[d]||'Cross-domain planning and coordination.')}</p></div>`).join('');
  $('#templateGrid').innerHTML=(integrationData.templates||[]).map(t=>`<div class="template-card"><div><span class="tag">${t.domains.length} domains</span></div><h3>${safe(t.name)}</h3><p class="tiny">${safe(t.domains.join(' · '))}</p><button data-template="${safe(t.id)}">Create working-group tasks</button></div>`).join('');
  const groups=state.workingGroups||[];$('#workingGroupList').innerHTML=groups.length?groups.map(g=>`<div class="decision-record"><strong>${safe(g.name)}</strong><div class="tiny">${safe((g.domains||[]).join(' · '))} · created ${safe(when(g.created))}</div></div>`).join(''):'<div class="empty">Use a template to create an interdisciplinary working group and task set.</div>';
}
function createTemplate(id){const t=(integrationData.templates||[]).find(x=>x.id===id);if(!t)return;const group={id:uid(),name:t.name,domains:t.domains,created:new Date().toISOString()};state.workingGroups.push(group);for(const title of t.tasks)shareEvent({id:uid(),type:'shared-task',created:new Date().toISOString(),title,domain:t.domains.join(' + '),owner:'',status:'Proposed',due:'',note:`Working group: ${t.name}`});persistUpgrade();toast('Working-group tasks created');renderCrossDomain()}

function snapshotCards(){
 const m=contextData.market_snapshot_2025||FALLBACK_CONTEXT.market_snapshot_2025,l=contextData.loss_snapshot_2025||FALLBACK_CONTEXT.loss_snapshot_2025,r=contextData.rate_filing_context_2026||FALLBACK_CONTEXT.rate_filing_context_2026,f=contextData.flood_planning||FALLBACK_CONTEXT.flood_planning,w=contextData.wildfire||FALLBACK_CONTEXT.wildfire;
 const cards=[['Active homeowners policies',fmt(m.active_homeowners_policies),'2025 TDI statewide'],['Average annual homeowners premium',money(m.average_annual_homeowners_premium_usd),'2025 TDI statewide average'],['Direct written premium',money(m.direct_written_premium_usd),'2025 TDI'],['Homeowners insurers',fmt(m.companies),'2025 TDI companies'],['2025 paid losses',money(l.paid_losses_major_perils_usd),'Major perils reported by TDI'],['Wind/hail share',`${l.wind_hail_average_share_since_2019_pct}%`,'Average share of homeowners losses since 2019 per TDI'],['Aug. 2026 filed rate request',`${r.avg_filed_rate_request_30_day_august_pct}%`,'30-day market aggregate; not a household quote'],['Regional flood groups',fmt(f.regional_flood_planning_groups),'2024 State Flood Plan'],['Texas Firewise sites',`100+`,'Texas A&M Forest Service']];
 $('#snapshotGrid').innerHTML=cards.map(([a,b,c])=>`<div class="snapshot-card"><small>${safe(a)}</small><strong>${safe(b)}</strong><div class="source-line">${safe(c)}</div></div>`).join('');
}
async function loadNWS(){const box=$('#nwsAlerts');box.innerHTML='<div class="empty">Loading official NWS active alerts…</div>';try{const d=await TXDataSources.nwsTexasAlerts();box.dataset.retrieved=d.retrieved;box.innerHTML=d.items.length?d.items.map(a=>`<div class="alert-item" data-severity="${safe(a.severity)}"><strong>${safe(a.event)}</strong> <span class="tag">${safe(a.severity)}</span><p>${safe(a.headline||a.areaDesc)}</p><div class="tiny">${safe(a.areaDesc)} · expires ${safe(when(a.expires))}</div>${a.web?`<div>${external(a.web,'Official alert')}</div>`:''}</div>`).join(''):'<div class="empty">No active NWS alerts returned for Texas at retrieval time.</div>';$('#nwsFresh').textContent=`Retrieved ${when(d.retrieved)}`}catch(e){box.innerHTML=`<div class="callout warn">Live alert request failed: ${safe(e.message)}. Offline planning tools remain available. Use weather.gov or local authorities for current warnings.</div>`}}
async function loadFEMA(){const box=$('#femaDeclarations');box.innerHTML='<div class="empty">Loading OpenFEMA declarations…</div>';try{const d=await TXDataSources.femaTexasDeclarations();const seen=new Set();const rows=d.items.filter(x=>{const k=String(x.disasterNumber);if(seen.has(k))return false;seen.add(k);return true}).slice(0,15);box.innerHTML=rows.length?rows.map(x=>`<div class="declaration-item"><strong>DR/EM/FM ${safe(x.disasterNumber)} · ${safe(x.title)}</strong><div class="tiny">${safe(x.incidentType)} · declared ${safe((x.declarationDate||'').slice(0,10))}</div><div class="task-meta">${x.ihProgramDeclared?'<span class="tag">IH</span>':''}${x.iaProgramDeclared?'<span class="tag">IA</span>':''}${x.paProgramDeclared?'<span class="tag">PA</span>':''}${x.hmProgramDeclared?'<span class="tag">HM</span>':''}</div></div>`).join(''):'<div class="empty">No declaration records returned.</div>';$('#femaFresh').textContent=`Retrieved ${when(d.retrieved)}`}catch(e){box.innerHTML=`<div class="callout warn">OpenFEMA request failed: ${safe(e.message)}. Use FEMA/TDEM official sites for current disaster information.</div>`}}
function renderLiveData(){snapshotCards();$('#marketSource').innerHTML=`${external('https://tdi.texas.gov/general/texas-homeowners-insurance-market-overview.html','TDI market overview')} · ${external('https://www.tdi.texas.gov/consumer/homeowners-losses-by-county.html','TDI county losses')} · ${external('https://www.twdb.texas.gov/flood/planning/sfp/2024/index.asp','TWDB State Flood Plan')}`}

function renderSourceLibrary(){const q=($('#sourceLibrarySearch').value||'').toLowerCase();const all=(resourceData.length?resourceData:RESOURCES).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));$('#sourceLibraryGrid').innerHTML=all.map(r=>`<article class="source-entry"><div class="task-meta"><span class="tag evidence-${safe(r.grade||'C')}">${safe(r.grade||'C')}</span><span class="tag">${safe(r.freshness||'Unknown')}</span></div><h3>${safe(r.title)}</h3><div class="tiny">${safe(r.issuer||r.source||'')} · ${safe(r.date||'')}</div><p>${safe(r.relevance||r.why||'Official or institutional source for verification and planning.')}</p>${r.url?external(r.url,'Open official/source page'):''}</article>`).join('')||'<div class="empty">No sources match.</div>'}

async function renderLocalAI(){
 $('#webgpuStatus').innerHTML=TXLocalAI.supported()?`${statusDot('ok')} WebGPU detected`:`${statusDot('warn')} WebGPU not detected — deterministic planner remains available`;
 $('#aiModelState').textContent=TXLocalAI.engine?`Loaded: ${TXLocalAI.model}`:'No model initialized';
}
async function loadModelList(){const sel=$('#aiModel');sel.innerHTML='<option>Loading WebLLM model registry…</option>';try{const list=await TXLocalAI.models();sel.innerHTML=list.slice(0,80).map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');$('#aiLibraryState').textContent=`WebLLM loaded; ${list.length} registered model variants found.`;toast('WebLLM model registry loaded')}catch(e){sel.innerHTML='<option value="">Unavailable</option>';$('#aiLibraryState').textContent=e.message;toast('WebLLM library unavailable — fallback planner still works')}}
async function initAI(){const model=$('#aiModel').value;if(!model)return toast('Load and choose a model first');$('#aiInitProgress').textContent='Starting model download/load…';$('#aiRun').disabled=true;try{await TXLocalAI.init(model,t=>{$('#aiInitProgress').textContent=t});$('#aiModelState').textContent=`Loaded: ${model}`;toast('Local model ready')}catch(e){$('#aiInitProgress').textContent=e.message;toast('Local model initialization failed')}finally{$('#aiRun').disabled=false}}
function aiContext(){const parts=[];if($('#aiCtxTexas').checked)parts.push(`Texas context snapshot:\n${JSON.stringify(contextData,null,2)}`);if($('#aiCtxTwin').checked)parts.push(`User-selected private household context (kept in this browser for local inference):\n${JSON.stringify({twin:state.twin,risks:state.risks,roof:state.roof},null,2)}`);if($('#aiCtxProjects').checked)parts.push(`Projects and deliberately shared coordination records:\n${JSON.stringify({projects:state.projects,sharedTasks:state.collab.sharedTasks,decisions:state.decisions},null,2)}`);return parts.join('\n\n').slice(0,18000)}
async function runAI(useFallback=false){const prompt=$('#aiPrompt').value.trim();if(!prompt)return toast('Enter a planning question');const out=$('#aiOutput');out.textContent='Working locally…';try{out.textContent=useFallback?TXLocalAI.fallback(prompt):await TXLocalAI.ask(prompt,aiContext())}catch(e){out.textContent=`Local model unavailable: ${e.message}\n\n${TXLocalAI.fallback(prompt)}`}}

async function renderDiagnostics(){
 let estimate='unknown';try{if(navigator.storage?.estimate){const x=await navigator.storage.estimate();estimate=`${Math.round((x.usage||0)/1048576)} MB used / ${Math.round((x.quota||0)/1048576)} MB quota`}}catch{}
 const checks=[
 ['Secure context',window.isSecureContext,'Required for many advanced browser capabilities outside localhost.'],['Service worker API','serviceWorker'in navigator,'PWA caching uses the bundled service worker when hosted on HTTPS/localhost.'],['Service worker controlling',!!navigator.serviceWorker?.controller,'May require one reload after first installation.'],['IndexedDB','indexedDB'in window&&!db._fallback,'Primary structured local storage.'],['WebCrypto',!!crypto.subtle,'Used for encrypted backup and SHA-256 integrity digest.'],['BroadcastChannel','BroadcastChannel'in window,'Same-device cross-tab collaboration.'],['WebSocket','WebSocket'in window,'Remote room transport when the optional server is deployed.'],['WebGPU',!!navigator.gpu,'Required for WebLLM model inference.'],['Online',navigator.onLine,'Only affects optional live resources/model downloads; core tools remain local.'],['Storage estimate',true,estimate],['Multiplayer mode',collab.status!=='offline',`Current: ${collab.status}`]
 ];
 $('#diagGrid').innerHTML=checks.map(([n,ok,d])=>`<div class="diag"><strong>${safe(n)} <span class="${ok?'status-good':'status-warn'}">${ok?'✓':'△'}</span></strong><small>${safe(d)}</small></div>`).join('');
 $('#bundleVersion').textContent=`${APP.version} · schema ${APP.schema} · updated ${APP.updated}`;
}

function upgradePWASection(){const sec=document.querySelector('[data-route="pwa"]');if(!sec||sec.dataset.upgraded)return;sec.dataset.upgraded='1';sec.querySelector('.section-head h1').textContent='Installable bundle with explicit offline boundaries.';sec.querySelector('.notice .muted').innerHTML='This ZIP already includes <code>manifest.webmanifest</code>, icons, <code>sw.js</code>, an offline page, and automatic registration. Service workers require HTTPS or localhost and do not normally operate from <code>file://</code>. Live NWS/FEMA data and first-time WebLLM/model downloads remain online-only.';sec.insertAdjacentHTML('beforeend',`<div class="grid g2" style="margin-top:1rem"><div class="card"><h2>Bundle status</h2><p id="pwaStatus">Checking…</p><div class="toolbar"><button id="installPwaBtn" disabled>Install app</button><button data-go="diagnostics">Run diagnostics</button></div></div><div class="card"><h2>Offline contract</h2><ul><li>Cached core app, calculators, saved records and bundled reference snapshots: available after successful PWA cache installation.</li><li>Official external pages, NWS alerts, OpenFEMA updates and first-time AI downloads: online only.</li><li>Previously cached WebLLM model artifacts may remain available according to WebLLM/browser cache behavior, but storage eviction is possible.</li></ul></div></div>`);setTimeout(()=>{const b=$('#installPwaBtn');if(b)b.onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;b.disabled=true}}},0)}

const baseRenderRoute=renderRoute;
renderRoute=function(id){baseRenderRoute(id);if(id==='collaboration')renderCollaboration();if(id==='cross-domain')renderCrossDomain();if(id==='live-data')renderLiveData();if(id==='source-library')renderSourceLibrary();if(id==='local-ai')renderLocalAI();if(id==='diagnostics')renderDiagnostics();if(id==='pwa')upgradePWASection()};

function bindUpgrade(){
 document.addEventListener('click',e=>{
  if(e.target.id==='createRoom'){const code=randomRoom();$('#collabRoom').value=code;state.collab.room=code;persistUpgrade();toast('Room code created — share it only with intended collaborators')}
  if(e.target.id==='connectRoom')connectCollab();
  if(e.target.id==='disconnectRoom'){collab.disconnect();state.collab.connectedMode='offline';persistUpgrade();renderCollaboration()}
  if(e.target.id==='addSharedTask')addSharedTask();
  if(e.target.id==='sendSharedComment')sendComment();
  if(e.target.id==='addSharedEvidence')addEvidence();
  if(e.target.id==='addDecision')addDecision();
  if(e.target.id==='addIncident')addIncident();
  if(e.target.id==='exportHandoff')exportHandoff();
  if(e.target.matches('[data-task-next]')){const t=state.collab.sharedTasks.find(x=>x.id===e.target.dataset.taskNext);if(t)shareEvent({...t,type:'shared-task',status:e.target.dataset.nextStatus,created:new Date().toISOString()})}
  if(e.target.matches('[data-template]'))createTemplate(e.target.dataset.template);
  if(e.target.id==='loadNwsBtn')loadNWS();if(e.target.id==='loadFemaBtn')loadFEMA();
  if(e.target.id==='loadWebLLM')loadModelList();if(e.target.id==='initWebLLM')initAI();if(e.target.id==='aiRun')runAI(false);if(e.target.id==='aiFallback')runAI(true);
  if(e.target.id==='runDiagnostics')renderDiagnostics();
 });
 $('#sourceLibrarySearch')?.addEventListener('input',renderSourceLibrary);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('#installPwaBtn');if(b)b.disabled=false});
}

async function loadBundledData(){
 contextData=await TXDataSources.localJSON('./data/texas-context.json',FALLBACK_CONTEXT);integrationData=await TXDataSources.localJSON('./data/cross-domain-schema.json',FALLBACK_INTEGRATION);resourceData=await TXDataSources.localJSON('./data/resources.json',[]);
 // Extend the original search/resource index without replacing it.
 if(Array.isArray(resourceData))for(const r of resourceData)if(!RESOURCES.some(x=>x.url===r.url))RESOURCES.push({topic:(r.topics||[])[0]||'research',issuer:r.issuer,title:r.title,date:r.date,url:r.url,grade:r.grade,freshness:r.freshness,why:r.relevance});
}
async function bootUpgrade(){
 try{await loadBundledData()}catch(e){console.warn('Bundled data load fallback',e)}
 renderNav();bindUpgrade();initSplash();upgradePWASection();
 const start=location.hash.slice(1);if(EXTRA_ROUTES.some(r=>r.id===start))route(start);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bootUpgrade,0));else setTimeout(bootUpgrade,0);
})();
