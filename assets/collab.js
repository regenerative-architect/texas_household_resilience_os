(function(){
'use strict';
const ALLOWED_TYPES=new Set(['shared-task','comment','evidence','decision','incident']);
const localListeners=new Set();
let bc=null;
if('BroadcastChannel' in window){
  bc=new BroadcastChannel('tx-resilience-collab-v1');
  bc.onmessage=e=>{for(const fn of localListeners)fn(e.data,'local')};
}
function cleanText(v,max=2000){return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max)}
function httpUrl(v){try{const u=new URL(cleanText(v,800),location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function sanitizeEvent(evt){
  if(!evt||!ALLOWED_TYPES.has(evt.type))throw new Error('Unsupported shared event type');
  const b={id:cleanText(evt.id||crypto.randomUUID?.()||Date.now(),80),type:evt.type,created:cleanText(evt.created||new Date().toISOString(),40)};
  if(evt.type==='shared-task')Object.assign(b,{title:cleanText(evt.title,240),domain:cleanText(evt.domain,80),owner:cleanText(evt.owner,120),status:cleanText(evt.status,40),due:cleanText(evt.due,30),note:cleanText(evt.note,1200)});
  if(evt.type==='comment')Object.assign(b,{targetId:cleanText(evt.targetId,80),text:cleanText(evt.text,1800)});
  if(evt.type==='evidence')Object.assign(b,{title:cleanText(evt.title,240),url:httpUrl(evt.url),source:cleanText(evt.source,180),grade:cleanText(evt.grade,8),note:cleanText(evt.note,1200)});
  if(evt.type==='decision')Object.assign(b,{question:cleanText(evt.question,600),decision:cleanText(evt.decision,1500),evidenceIds:Array.isArray(evt.evidenceIds)?evt.evidenceIds.slice(0,20).map(x=>cleanText(x,80)):[],revisitDate:cleanText(evt.revisitDate,30)});
  if(evt.type==='incident')Object.assign(b,{kind:cleanText(evt.kind,80),title:cleanText(evt.title,240),note:cleanText(evt.note,1500),status:cleanText(evt.status,60),eventTime:cleanText(evt.eventTime||new Date().toISOString(),40)});
  return b;
}
class TXCollabClient{
  constructor(){this.ws=null;this.room='';this.name='';this.role='';this.server='';this.listeners=new Set();this.presence=new Map();this.status='offline';localListeners.add((msg,mode)=>{if(msg?.room===this.room&&msg?.senderId!==this.senderId)this._emit(msg.event||msg,mode)});this.senderId=crypto.randomUUID?.()||Math.random().toString(36).slice(2)}
  on(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  _emit(msg,mode='remote'){for(const fn of this.listeners)fn(msg,mode)}
  connect({server,room,name,role}){
    this.disconnect();this.server=server;this.room=cleanText(room,64);this.name=cleanText(name||'Participant',120);this.role=cleanText(role||'Collaborator',120);
    if(!this.room)throw new Error('Room code required');
    if(!server){this.status='local';this._emit({type:'connection',status:'local',room:this.room},'system');return Promise.resolve('local')}
    return new Promise((resolve,reject)=>{
      try{
        const u=new URL(server,location.href);u.searchParams.set('room',this.room);u.searchParams.set('name',this.name);u.searchParams.set('role',this.role);u.searchParams.set('senderId',this.senderId);
        const ws=new WebSocket(u);this.ws=ws;
        const timer=setTimeout(()=>{if(ws.readyState!==1){try{ws.close()}catch{};reject(new Error('WebSocket connection timed out'))}},8000);
        ws.onopen=()=>{clearTimeout(timer);this.status='remote';this._emit({type:'connection',status:'remote',room:this.room},'system');resolve('remote')};
        ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='presence'){this.presence=new Map((m.members||[]).map(x=>[x.senderId,x]));this._emit(m,'system')}else if(m.type==='snapshot'){for(const ev of (m.events||[]))this._emit(ev,'snapshot')}else if(m.type==='event')this._emit(m.event,'remote');else if(m.type==='error')this._emit(m,'system')}catch(err){this._emit({type:'error',message:'Invalid collaboration message'},'system')}};
        ws.onerror=()=>this._emit({type:'error',message:'WebSocket error'},'system');
        ws.onclose=()=>{this.status='local';this._emit({type:'connection',status:'local',room:this.room},'system')};
      }catch(e){reject(e)}
    })
  }
  send(evt){
    const event=sanitizeEvent(evt);const packet={type:'event',room:this.room,senderId:this.senderId,name:this.name,role:this.role,event};
    if(bc)bc.postMessage(packet);
    this._emit(event,'self');
    if(this.ws&&this.ws.readyState===1)this.ws.send(JSON.stringify({type:'event',event}));
    return event;
  }
  disconnect(){if(this.ws){try{this.ws.close()}catch{};this.ws=null}this.status='offline';this.presence.clear()}
}
window.TXCollabClient=TXCollabClient;
window.TXCollabSanitize=sanitizeEvent;
})();
