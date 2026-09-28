(function(){
'use strict';
async function getJSON(url,opts={}){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),opts.timeout||12000);
  try{
    const r=await fetch(url,{headers:{Accept:'application/geo+json, application/json'},signal:ctrl.signal,cache:'no-store'});
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return await r.json();
  }finally{clearTimeout(t)}
}
async function nwsTexasAlerts(){
  const url='https://api.weather.gov/alerts/active?area=TX';
  const j=await getJSON(url,{timeout:15000});
  return {source:'NOAA / National Weather Service',retrieved:new Date().toISOString(),url,items:(j.features||[]).slice(0,60).map(f=>({id:f.id||f.properties?.id||'',event:f.properties?.event||'Alert',headline:f.properties?.headline||'',severity:f.properties?.severity||'Unknown',urgency:f.properties?.urgency||'Unknown',certainty:f.properties?.certainty||'Unknown',areaDesc:f.properties?.areaDesc||'',effective:f.properties?.effective||'',expires:f.properties?.expires||'',instruction:f.properties?.instruction||'',description:f.properties?.description||'',web:f.id||''}))};
}
async function femaTexasDeclarations(){
  const endpoint="https://www.fema.gov/api/open/v1/DisasterDeclarationsSummaries?$filter=state%20eq%20%27TX%27&$orderby=declarationDate%20desc&$top=25";
  const j=await getJSON(endpoint,{timeout:15000});
  const rows=j.DisasterDeclarationsSummaries||j.DisasterDeclarationSummaries||j.items||[];
  return {source:'FEMA OpenFEMA',retrieved:new Date().toISOString(),url:'https://www.fema.gov/about/openfema/data-sets',items:rows.map(x=>({disasterNumber:x.disasterNumber,title:x.declarationTitle||x.incidentType||'Federal declaration',declarationType:x.declarationType||'',incidentType:x.incidentType||'',declarationDate:x.declarationDate||'',incidentBeginDate:x.incidentBeginDate||'',incidentEndDate:x.incidentEndDate||'',ihProgramDeclared:!!x.ihProgramDeclared,iaProgramDeclared:!!x.iaProgramDeclared,paProgramDeclared:!!x.paProgramDeclared,hmProgramDeclared:!!x.hmProgramDeclared,designatedArea:x.designatedArea||''}))};
}
async function localJSON(path,fallback){try{const r=await fetch(path,{cache:'no-store'});if(r.ok)return await r.json()}catch{}return fallback}
window.TXDataSources={nwsTexasAlerts,femaTexasDeclarations,localJSON};
})();
