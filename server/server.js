'use strict';
const http=require('http');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');

const PORT=Number(process.env.PORT||8787);
const ROOT=path.resolve(__dirname,'..');
const DATA_FILE=path.resolve(__dirname,process.env.DATA_FILE||'./data/rooms.json');
const ALLOWED_ORIGINS=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
const MAX_EVENTS=500, MAX_MESSAGE_BYTES=48*1024;
const WS_GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms=new Map();

function safeText(v,max=2000){return String(v??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max)}
function validRoom(v){return /^[A-Za-z0-9_-]{3,64}$/.test(v)}
function httpUrl(v){try{const u=new URL(safeText(v,800));return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function load(){try{const raw=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));for(const [k,v] of Object.entries(raw.rooms||{}))if(validRoom(k)&&Array.isArray(v.events))rooms.set(k,{events:v.events.slice(-MAX_EVENTS),clients:new Map()})}catch(e){if(e.code!=='ENOENT')console.error('room load failed',e.message)}}
let saveTimer=null;
function persistSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});const out={savedAt:new Date().toISOString(),rooms:{}};for(const [k,v] of rooms)out.rooms[k]={events:v.events.slice(-MAX_EVENTS)};const tmp=DATA_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(out,null,2));fs.renameSync(tmp,DATA_FILE)}catch(e){console.error('room save failed',e.message)}},250)}
function roomFor(code){if(!rooms.has(code))rooms.set(code,{events:[],clients:new Map()});return rooms.get(code)}
function allowOrigin(req){return !ALLOWED_ORIGINS.length||ALLOWED_ORIGINS.includes(req.headers.origin||'')}
function sanitizeEvent(evt){
 if(!evt||typeof evt!=='object')throw new Error('Event object required');
 const type=safeText(evt.type,40),base={id:safeText(evt.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`,80),type,created:safeText(evt.created||new Date().toISOString(),40)};
 if(type==='shared-task')return {...base,title:safeText(evt.title,240),domain:safeText(evt.domain,120),owner:safeText(evt.owner,120),status:safeText(evt.status,40),due:safeText(evt.due,30),note:safeText(evt.note,1200)};
 if(type==='comment')return {...base,targetId:safeText(evt.targetId,80),text:safeText(evt.text,1800)};
 if(type==='evidence')return {...base,title:safeText(evt.title,240),url:httpUrl(evt.url),source:safeText(evt.source,180),grade:safeText(evt.grade,8),note:safeText(evt.note,1200)};
 if(type==='decision')return {...base,question:safeText(evt.question,600),decision:safeText(evt.decision,1500),evidenceIds:Array.isArray(evt.evidenceIds)?evt.evidenceIds.slice(0,20).map(x=>safeText(x,80)):[],revisitDate:safeText(evt.revisitDate,30)};
 if(type==='incident')return {...base,kind:safeText(evt.kind,80),title:safeText(evt.title,240),note:safeText(evt.note,1500),status:safeText(evt.status,60),eventTime:safeText(evt.eventTime||new Date().toISOString(),40)};
 throw new Error('Unsupported shared event type');
}
function presence(room){return [...room.clients.values()].map(c=>({senderId:c.senderId,name:c.name,role:c.role,joined:c.joined}))}

function frame(opcode,payload=Buffer.alloc(0)){
 if(!Buffer.isBuffer(payload))payload=Buffer.from(payload);
 const n=payload.length;let head;
 if(n<126){head=Buffer.alloc(2);head[1]=n}
 else if(n<=65535){head=Buffer.alloc(4);head[1]=126;head.writeUInt16BE(n,2)}
 else{head=Buffer.alloc(10);head[1]=127;head.writeBigUInt64BE(BigInt(n),2)}
 head[0]=0x80|opcode;return Buffer.concat([head,payload]);
}
function sendJSON(socket,obj){if(!socket.destroyed)socket.write(frame(0x1,Buffer.from(JSON.stringify(obj))))}
function sendControl(socket,opcode,payload=Buffer.alloc(0)){if(!socket.destroyed)socket.write(frame(opcode,payload))}
function closeSocket(client,code=1000,reason=''){try{const r=Buffer.from(String(reason).slice(0,120));const p=Buffer.alloc(2+r.length);p.writeUInt16BE(code,0);r.copy(p,2);sendControl(client.socket,0x8,p)}catch{};client.socket.end()}
function broadcast(room,obj,except=null){for(const c of room.clients.values())if(c!==except)sendJSON(c.socket,obj)}

function handleText(client,text){
 try{
  if(Date.now()-client.windowStart>60000){client.windowStart=Date.now();client.count=0}client.count++;if(client.count>60)throw new Error('Rate limit exceeded');
  const msg=JSON.parse(text);if(msg.type!=='event')return;
  const event=sanitizeEvent(msg.event),enriched={...event,serverTime:new Date().toISOString(),actor:{name:client.name,role:client.role,senderId:client.senderId}};
  const idx=client.room.events.findIndex(x=>x.id===enriched.id);if(idx>=0)client.room.events[idx]=enriched;else client.room.events.push(enriched);if(client.room.events.length>MAX_EVENTS)client.room.events.splice(0,client.room.events.length-MAX_EVENTS);persistSoon();broadcast(client.room,{type:'event',event:enriched});
 }catch(e){sendJSON(client.socket,{type:'error',message:safeText(e.message,200)})}
}
function consumeFrames(client,chunk){
 client.buffer=Buffer.concat([client.buffer,chunk]);
 while(client.buffer.length>=2){
  const b0=client.buffer[0],b1=client.buffer[1],fin=!!(b0&0x80),opcode=b0&0x0f,masked=!!(b1&0x80);let len=b1&0x7f,off=2;
  if(len===126){if(client.buffer.length<4)return;len=client.buffer.readUInt16BE(2);off=4}
  else if(len===127){if(client.buffer.length<10)return;const big=client.buffer.readBigUInt64BE(2);if(big>BigInt(MAX_MESSAGE_BYTES)){closeSocket(client,1009,'Message too large');return}len=Number(big);off=10}
  if(!masked){closeSocket(client,1002,'Client frames must be masked');return}
  if(len>MAX_MESSAGE_BYTES){closeSocket(client,1009,'Message too large');return}
  if(client.buffer.length<off+4+len)return;
  const mask=client.buffer.subarray(off,off+4);off+=4;const payload=Buffer.from(client.buffer.subarray(off,off+len));client.buffer=client.buffer.subarray(off+len);for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
  if(opcode===0x8){closeSocket(client);return}
  if(opcode===0x9){sendControl(client.socket,0xA,payload);continue}
  if(opcode===0xA){client.alive=true;continue}
  if(opcode===0x2){closeSocket(client,1003,'Binary unsupported');return}
  if(opcode===0x1){client.fragment=payload;if(fin){handleText(client,client.fragment.toString('utf8'));client.fragment=null}continue}
  if(opcode===0x0&&client.fragment){client.fragment=Buffer.concat([client.fragment,payload]);if(client.fragment.length>MAX_MESSAGE_BYTES){closeSocket(client,1009,'Message too large');return}if(fin){handleText(client,client.fragment.toString('utf8'));client.fragment=null}continue}
  closeSocket(client,1002,'Unsupported frame');return;
 }
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function securityHeaders(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()')}
function serve(req,res){
 securityHeaders(res);const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/healthz'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,service:'tx-resilience-collab',rooms:rooms.size,time:new Date().toISOString()}))}
 let pathname;try{pathname=decodeURIComponent(u.pathname)}catch{return res.writeHead(400).end('Bad path')}
 if(pathname.startsWith('/server/'))return res.writeHead(404).end('Not found');
 if(pathname==='/')pathname='/index.html';const rel=pathname.replace(/^\/+/,''),full=path.resolve(ROOT,rel);
 if(full!==ROOT&&!full.startsWith(ROOT+path.sep))return res.writeHead(403).end('Forbidden');
 fs.stat(full,(err,st)=>{if(err||!st.isFile())return res.writeHead(404).end('Not found');res.setHeader('Content-Type',MIME[path.extname(full).toLowerCase()]||'application/octet-stream');res.setHeader('Cache-Control',path.basename(full)==='index.html'?'no-cache':'public, max-age=300');res.writeHead(200);fs.createReadStream(full).pipe(res)});
}

load();
const server=http.createServer(serve);
server.on('upgrade',(req,socket,head)=>{
 try{
  const u=new URL(req.url,'http://localhost');if(u.pathname!=='/ws'||!allowOrigin(req))return socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  const key=req.headers['sec-websocket-key'];if(!key||String(req.headers.upgrade).toLowerCase()!=='websocket')return socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  const code=safeText(u.searchParams.get('room'),64);if(!validRoom(code))return socket.end('HTTP/1.1 400 Bad Room\r\nConnection: close\r\n\r\n');
  const accept=crypto.createHash('sha1').update(key+WS_GUID).digest('base64');socket.write(['HTTP/1.1 101 Switching Protocols','Upgrade: websocket','Connection: Upgrade',`Sec-WebSocket-Accept: ${accept}`,'\r\n'].join('\r\n'));
  const room=roomFor(code),senderId=safeText(u.searchParams.get('senderId')||Math.random().toString(36).slice(2),100),name=safeText(u.searchParams.get('name')||'Participant',120),role=safeText(u.searchParams.get('role')||'Collaborator',120);
  const old=room.clients.get(senderId);if(old)closeSocket(old,1000,'Replaced by new connection');
  const client={socket,room,code,senderId,name,role,joined:new Date().toISOString(),alive:true,count:0,windowStart:Date.now(),buffer:Buffer.alloc(0),fragment:null};room.clients.set(senderId,client);
  sendJSON(socket,{type:'snapshot',events:room.events.slice(-200)});broadcast(room,{type:'presence',members:presence(room)});
  const cleanup=()=>{if(room.clients.get(senderId)===client){room.clients.delete(senderId);broadcast(room,{type:'presence',members:presence(room)})}};
  socket.on('data',c=>consumeFrames(client,c));socket.on('close',cleanup);socket.on('end',cleanup);socket.on('error',cleanup);if(head&&head.length)consumeFrames(client,head);
 }catch(e){try{socket.destroy()}catch{}}
});
const heartbeat=setInterval(()=>{for(const room of rooms.values())for(const c of room.clients.values()){if(!c.alive){closeSocket(c,1001,'Heartbeat timeout');continue}c.alive=false;sendControl(c.socket,0x9)}},30000);heartbeat.unref();
server.listen(PORT,()=>console.log(`Texas Resilience OS: http://localhost:${PORT} (WebSocket /ws)`));
function shutdown(){clearTimeout(saveTimer);try{fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});const out={savedAt:new Date().toISOString(),rooms:{}};for(const [k,v] of rooms)out.rooms[k]={events:v.events.slice(-MAX_EVENTS)};fs.writeFileSync(DATA_FILE,JSON.stringify(out,null,2))}catch{};server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1000).unref()}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
