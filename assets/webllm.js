(function(){
'use strict';
class TXLocalAI{
  constructor(){this.mod=null;this.engine=null;this.model='';this.progress='Not loaded';}
  supported(){return !!navigator.gpu}
  async loadLibrary(){
    if(this.mod)return this.mod;
    if(!navigator.onLine)throw new Error('First-time WebLLM library loading requires an internet connection.');
    this.mod=await import('https://esm.run/@mlc-ai/web-llm');
    return this.mod;
  }
  async models(){
    const m=await this.loadLibrary();
    const list=(m.prebuiltAppConfig?.model_list||[]).map(x=>x.model_id).filter(Boolean);
    const score=id=>{let s=50;const v=id.toLowerCase();if(/0\.5b|0_5b/.test(v))s=1;else if(/1b|1\.0b/.test(v))s=2;else if(/1\.5b|1_5b/.test(v))s=3;else if(/2b/.test(v))s=4;else if(/3b/.test(v))s=5;else if(/4b/.test(v))s=6;else if(/7b|8b/.test(v))s=10;if(/instruct/.test(v))s-=.2;return s};
    return [...new Set(list)].sort((a,b)=>score(a)-score(b)||a.localeCompare(b));
  }
  async init(modelId,onProgress=()=>{}){
    if(!this.supported())throw new Error('WebGPU is unavailable in this browser/device. Use the deterministic planner fallback instead.');
    const m=await this.loadLibrary();
    this.model=modelId;
    this.engine=await m.CreateMLCEngine(modelId,{initProgressCallback:p=>{this.progress=p.text||String(p);onProgress(this.progress)}});
    return this.engine;
  }
  async ask(prompt,context=''){
    if(!this.engine)throw new Error('Initialize a local model first.');
    const system=`You are the local planning assistant inside the Texas Household Resilience & Insurance OS. Provide educational planning support, not legal, insurance, claims, financial, engineering, medical, or contractor determinations. Distinguish verified facts from user-entered assumptions and modeled scenarios. Do not claim a policy covers a loss without exact policy wording. Prefer safety, privacy, official verification, and cross-domain coordination. Use the supplied context only; state when more verification is required.`;
    const r=await this.engine.chat.completions.create({messages:[{role:'system',content:system},{role:'user',content:`CONTEXT:\n${context.slice(0,12000)}\n\nREQUEST:\n${prompt.slice(0,6000)}`}],temperature:0.2,max_tokens:900});
    return r.choices?.[0]?.message?.content||'No local model response.';
  }
  fallback(prompt,context={}){
    const p=String(prompt||'').toLowerCase();const items=[];
    items.push('1. Separate the question into hazard, physical vulnerability, insurance transfer, cash/liquidity, documentation, and recovery continuity.');
    if(/flood|water/.test(p))items.push('2. Verify flood versus plumbing/sewer/roof-water causes separately; standard home coverage and flood coverage are not interchangeable.');
    if(/hail|roof|wind/.test(p))items.push('2. Record roof age/material/condition, translate any wind/hail percentage deductible into dollars, and compare maintenance or hardening candidates before assuming an insurance benefit.');
    if(/freeze|pipe/.test(p))items.push('2. Map shutoffs, insulation/heating continuity, vulnerable plumbing, emergency drying, and temporary-housing cash needs.');
    if(/wildfire|fire/.test(p))items.push('2. Coordinate evacuation, ember-entry reduction, immediate-zone maintenance, documentation, and policy verification.');
    if(/outage|power|medical/.test(p))items.push('2. Treat power as a health/water/communications dependency; identify critical loads, safe backup options, fuel/charging, and accessible transport contingencies.');
    items.push('3. Identify the highest likely deductible plus immediate non-covered cash needs; compare that liquidity need with available reserves.');
    items.push('4. Create a dated evidence packet: policy declarations/endorsements, photos, inventory, receipts, maintenance records, estimates, and official hazard/resource links.');
    items.push('5. For shared work, disclose only the coordination fields teammates need; keep policy numbers, income, claim details, inventory values, and household-sensitive records local unless intentionally shared through a more secure channel.');
    items.push('6. Assign owners and review dates across the relevant domains (insurance literacy, housing/construction, water, energy, health, mobility, emergency management, finance).');
    items.push('7. Verify consequential conclusions with the insurer/TDI, local officials, qualified contractors/engineers, health professionals, or other appropriate experts.');
    return `Deterministic local planner (no model loaded)\n\n${items.join('\n')}`;
  }
}
window.TXLocalAI=new TXLocalAI();
})();
