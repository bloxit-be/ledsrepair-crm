const STORAGE_KEY = 'ledsrepair-crm-v1';
const STATUSES = ['Nieuw','Diagnose','Wachten op onderdeel','In reparatie','Klaar','Afgehaald'];
const CANONICAL_FIELDS = [
  ['','Niet importeren'],['externalId','Extern nummer / ID'],['customerName','Klantnaam'],['email','E-mail'],['phone','Telefoon'],['device','Toestel / type'],['brand','Merk'],['model','Model'],['serial','Serienummer'],['issue','Probleemomschrijving'],['status','Status'],['createdAt','Aangemaakt op'],['dueDate','Deadline'],['supplier','Leverancier'],['price','Bedrag'],['notes','Notities']
];
const FIELD_SYNONYMS = {
  externalId:['id','nummer','nr','repair id','repairid','ticket','ticket id','werkorder','workorder','reference','referentie','rma'],
  customerName:['klant','klantnaam','customer','customer name','naam','name','client','client name'],
  email:['email','e-mail','mail','emailadres','email address'],
  phone:['telefoon','tel','phone','gsm','mobile','mobiel','telephone'],
  device:['toestel','device','type','product','artikel','item','module','apparaat'],
  brand:['merk','brand','manufacturer','fabrikant'],
  model:['model','modelnaam','model name','product model'],
  serial:['serienummer','serial','serial number','serialnumber','sn','s/n'],
  issue:['probleem','probleemomschrijving','issue','defect','klacht','description','omschrijving','fault'],
  status:['status','state','fase','phase'],
  createdAt:['datum','aangemaakt','created','created at','created date','intake datum','intake date'],
  dueDate:['deadline','due','due date','verwacht','verwachte datum','target date'],
  supplier:['leverancier','supplier','vendor','distributor'],
  price:['prijs','price','bedrag','amount','total','totaal','kost','cost'],
  notes:['notities','notes','opmerking','opmerkingen','remarks','comment','comments']
};

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const isoToday = () => new Date().toISOString().slice(0,10);
const euro = value => new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(value)||0);
const fmtDate = value => value ? new Intl.DateTimeFormat('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${value}`.slice(0,10)+'T12:00:00')) : '—';
const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\-./]+/g,' ').replace(/\s+/g,' ').trim();

function emptyState(){ return {version:1,repairs:[],customers:[],suppliers:[],globalMappings:{},supplierMappings:{},counter:1}; }
function loadState(){
  try { return {...emptyState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}; }
  catch { return emptyState(); }
}
let state = loadState();
let currentView = 'dashboard';
let repairFilter = 'all';
let currentSearch = '';
let csvContext = null;

function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function toast(message, error=false){ const el=$('#toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),2600); }
function slugStatus(status){ return `status-${String(status||'Nieuw').replaceAll(' ','-')}`; }
function nextRepairNumber(){ const n = state.counter || 1; state.counter=n+1; return `LR-${String(n).padStart(5,'0')}`; }
function isClosed(r){ return ['Klaar','Afgehaald'].includes(r.status); }
function isOverdue(r){ return r.dueDate && r.dueDate < isoToday() && !isClosed(r); }

function setView(view){
  currentView=view;
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const meta={dashboard:['Overzicht','Dashboard'],repairs:['Werkorders','Reparaties'],customers:['Relaties','Klanten'],suppliers:['Relaties','Leveranciers'],import:['Data importeren','CSV import'],settings:['Beheer','Instellingen']}[view];
  $('#viewEyebrow').textContent=meta[0]; $('#viewTitle').textContent=meta[1];
  $('#globalSearchWrap').classList.toggle('hidden',['import','settings'].includes(view));
  $('#newRepairBtn').classList.toggle('hidden',view==='import'||view==='settings');
  $('#sidebar').classList.remove('open');
  renderAll();
}

function renderAll(){
  hydrateSelects();
  renderDashboard();
  renderRepairs();
  renderCustomers();
  renderSuppliers();
  renderMappingStats();
}

function hydrateSelects(){
  const statusOptions=STATUSES.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('#repairStatus').innerHTML=statusOptions;
  const supplierOptions=['<option value="">Geen leverancier</option>',...state.suppliers.sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`)].join('');
  $('#repairSupplier').innerHTML=supplierOptions;
  $('#importSupplier').innerHTML=['<option value="">Geen / onbekend</option>',...state.suppliers.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`)].join('');
  $('#customerNames').innerHTML=state.customers.map(c=>`<option value="${esc(c.name)}"></option>`).join('');
}

function renderDashboard(){
  const open=state.repairs.filter(r=>!isClosed(r));
  const waiting=state.repairs.filter(r=>r.status==='Wachten op onderdeel');
  const overdue=open.filter(isOverdue);
  const finished=state.repairs.filter(r=>r.status==='Klaar');
  $('#dashboardStats').innerHTML=[
    ['Open reparaties',open.length,'Actieve werkorders'],
    ['Wachten op onderdeel',waiting.length,'Externe afhankelijkheid'],
    ['Over deadline',overdue.length,overdue.length?'Actie aanbevolen':'Alles op schema'],
    ['Klaar voor afhaling',finished.length,'Afgewerkt, nog niet afgehaald']
  ].map(([label,value,meta])=>`<article class="stat-card"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${value}</strong><span class="stat-meta">${esc(meta)}</span></article>`).join('');

  const recent=[...state.repairs].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,7);
  $('#recentRepairs').innerHTML=recent.length?recent.map(r=>`<tr><td>${esc(r.number)}</td><td>${esc(r.customerName||'—')}</td><td>${esc([r.brand,r.device].filter(Boolean).join(' ')||'—')}</td><td><span class="status-pill ${slugStatus(r.status)}">${esc(r.status)}</span></td><td class="${isOverdue(r)?'overdue-text':''}">${fmtDate(r.dueDate)}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">Nog geen reparaties.</td></tr>`;

  const attention=[...overdue.map(r=>({type:'overdue',title:`${r.number} is over deadline`,text:`${r.customerName||'Onbekende klant'} · ${r.device||'reparatie'} · deadline ${fmtDate(r.dueDate)}`})),...waiting.map(r=>({type:'wait',title:`${r.number} wacht op onderdeel`,text:`${r.customerName||'Onbekende klant'} · ${r.device||'reparatie'}`}))].slice(0,8);
  $('#attentionList').innerHTML=attention.length?attention.map(a=>`<div class="attention-item ${a.type==='overdue'?'overdue':''}"><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div>`).join(''):`<div class="empty-state compact">Geen urgente acties.</div>`;
}

function filteredRepairs(){
  const q=normalize(currentSearch);
  return [...state.repairs].filter(r=>repairFilter==='all'||r.status===repairFilter).filter(r=>!q||normalize([r.number,r.customerName,r.device,r.brand,r.model,r.serial,r.issue,r.status,r.supplier].join(' ')).includes(q)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
function renderRepairs(){
  const rows=filteredRepairs();
  $('#repairsEmpty').classList.toggle('hidden',rows.length>0);
  $('#repairsTable').innerHTML=rows.map(r=>`<tr>
    <td><strong>${esc(r.number)}</strong></td><td>${esc(r.customerName||'—')}</td><td>${esc([r.brand,r.model,r.device].filter(Boolean).join(' ')||'—')}</td><td>${esc(r.serial||'—')}</td>
    <td><span class="status-pill ${slugStatus(r.status)}">${esc(r.status)}</span></td><td>${fmtDate(r.createdAt)}</td><td class="${isOverdue(r)?'overdue-text':''}">${fmtDate(r.dueDate)}</td><td>${r.price?euro(r.price):'—'}</td>
    <td><div class="row-actions"><button class="table-btn" data-edit-repair="${esc(r.id)}">Bewerk</button><button class="table-btn" data-delete-repair="${esc(r.id)}">×</button></div></td></tr>`).join('');
}
function renderCustomers(){
  const q=normalize(currentSearch);
  const customers=state.customers.filter(c=>!q||normalize([c.name,c.email,c.phone,c.company].join(' ')).includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  $('#customersEmpty').classList.toggle('hidden',customers.length>0);
  $('#customersGrid').innerHTML=customers.map(c=>{
    const jobs=state.repairs.filter(r=>r.customerId===c.id||normalize(r.customerName)===normalize(c.name)); const open=jobs.filter(r=>!isClosed(r)).length;
    return `<article class="entity-card"><div class="entity-card-head"><div><h3>${esc(c.name)}</h3><p>${esc(c.company||c.email||c.phone||'Geen contactgegevens')}</p></div><button class="table-btn" data-delete-customer="${c.id}">×</button></div><div class="entity-meta"><span class="mini-pill">${jobs.length} reparaties</span><span class="mini-pill">${open} open</span>${c.phone?`<span class="mini-pill">${esc(c.phone)}</span>`:''}</div></article>`;
  }).join('');
}
function renderSuppliers(){
  const q=normalize(currentSearch);
  const suppliers=state.suppliers.filter(s=>!q||normalize([s.name,s.email,s.phone,s.contact].join(' ')).includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  $('#suppliersEmpty').classList.toggle('hidden',suppliers.length>0);
  $('#suppliersGrid').innerHTML=suppliers.map(s=>{
    const used=state.repairs.filter(r=>normalize(r.supplier)===normalize(s.name)).length; const maps=Object.keys(state.supplierMappings[s.name]||{}).length;
    return `<article class="entity-card"><div class="entity-card-head"><div><h3>${esc(s.name)}</h3><p>${esc(s.contact||s.email||s.phone||'Geen contactgegevens')}</p></div><button class="table-btn" data-delete-supplier="${s.id}">×</button></div><div class="entity-meta"><span class="mini-pill">${used} reparaties</span><span class="mini-pill">${maps} CSV mappings</span></div></article>`;
  }).join('');
}
function renderMappingStats(){
  const globals=Object.keys(state.globalMappings||{}).length;
  const supplierCount=Object.keys(state.supplierMappings||{}).filter(k=>Object.keys(state.supplierMappings[k]||{}).length).length;
  const supplierFields=Object.values(state.supplierMappings||{}).reduce((n,m)=>n+Object.keys(m||{}).length,0);
  $('#mappingStats').innerHTML=`<div class="mapping-stat"><span>Globale kolommen</span><strong>${globals}</strong></div><div class="mapping-stat"><span>Leveranciers met profiel</span><strong>${supplierCount}</strong></div><div class="mapping-stat"><span>Leverancier-specifieke koppelingen</span><strong>${supplierFields}</strong></div>`;
}

function openRepair(id=null){
  $('#repairForm').reset(); $('#repairId').value=''; $('#repairDialogTitle').textContent=id?'Reparatie bewerken':'Nieuwe reparatie';
  hydrateSelects();
  if(id){ const r=state.repairs.find(x=>x.id===id); if(!r)return; $('#repairId').value=r.id; $('#repairCustomer').value=r.customerName||''; $('#repairDevice').value=r.device||''; $('#repairBrand').value=r.brand||''; $('#repairModel').value=r.model||''; $('#repairSerial').value=r.serial||''; $('#repairStatus').value=r.status||'Nieuw'; $('#repairDueDate').value=(r.dueDate||'').slice(0,10); $('#repairIssue').value=r.issue||''; $('#repairSupplier').value=r.supplier||''; $('#repairPrice').value=r.price||''; $('#repairNotes').value=r.notes||''; }
  else { $('#repairStatus').value='Nieuw'; }
  $('#repairDialog').showModal();
}
function findOrCreateCustomer(name,email='',phone=''){
  if(!name)return null; let c=state.customers.find(x=>normalize(x.name)===normalize(name)||email&&normalize(x.email)===normalize(email));
  if(!c){ c={id:uid('cus'),name:name.trim(),email:email.trim(),phone:phone.trim(),company:'',createdAt:isoToday()}; state.customers.push(c); }
  else { if(email&&!c.email)c.email=email; if(phone&&!c.phone)c.phone=phone; }
  return c;
}
function ensureSupplier(name){ if(!name)return null; let s=state.suppliers.find(x=>normalize(x.name)===normalize(name)); if(!s){s={id:uid('sup'),name:name.trim(),email:'',phone:'',contact:'',createdAt:isoToday()};state.suppliers.push(s);} return s; }

$('#repairForm').addEventListener('submit',e=>{
  e.preventDefault(); if(!e.target.reportValidity())return;
  const id=$('#repairId').value; const customerName=$('#repairCustomer').value.trim(); const customer=findOrCreateCustomer(customerName); const supplier=$('#repairSupplier').value; ensureSupplier(supplier);
  const data={customerId:customer?.id||'',customerName,device:$('#repairDevice').value.trim(),brand:$('#repairBrand').value.trim(),model:$('#repairModel').value.trim(),serial:$('#repairSerial').value.trim(),status:$('#repairStatus').value,dueDate:$('#repairDueDate').value,issue:$('#repairIssue').value.trim(),supplier,price:Number($('#repairPrice').value)||0,notes:$('#repairNotes').value.trim()};
  if(id){ const r=state.repairs.find(x=>x.id===id); Object.assign(r,data,{updatedAt:new Date().toISOString()}); toast('Reparatie bijgewerkt.'); }
  else { state.repairs.push({id:uid('rep'),number:nextRepairNumber(),externalId:'',createdAt:isoToday(),...data}); toast('Reparatie aangemaakt.'); }
  saveState(); $('#repairDialog').close(); renderAll();
});

function openSimple(type){
  $('#simpleType').value=type; $('#simpleDialogTitle').textContent=type==='customer'?'Nieuwe klant':'Nieuwe leverancier';
  $('#simpleFields').innerHTML=type==='customer'?`<div class="form-grid"><label class="field span-2"><span>Naam *</span><input id="simpleName" required></label><label class="field"><span>E-mail</span><input id="simpleEmail" type="email"></label><label class="field"><span>Telefoon</span><input id="simplePhone"></label><label class="field span-2"><span>Bedrijf</span><input id="simpleCompany"></label></div>`:`<div class="form-grid"><label class="field span-2"><span>Naam *</span><input id="simpleName" required></label><label class="field"><span>Contactpersoon</span><input id="simpleContact"></label><label class="field"><span>Telefoon</span><input id="simplePhone"></label><label class="field span-2"><span>E-mail</span><input id="simpleEmail" type="email"></label></div>`;
  $('#simpleDialog').showModal(); setTimeout(()=>$('#simpleName')?.focus(),50);
}
$('#simpleForm').addEventListener('submit',e=>{
  e.preventDefault(); if(!e.target.reportValidity())return; const type=$('#simpleType').value; const name=$('#simpleName').value.trim();
  if(type==='customer'){ if(state.customers.some(c=>normalize(c.name)===normalize(name)))return toast('Deze klant bestaat al.',true); state.customers.push({id:uid('cus'),name,email:$('#simpleEmail').value.trim(),phone:$('#simplePhone').value.trim(),company:$('#simpleCompany').value.trim(),createdAt:isoToday()}); }
  else { if(state.suppliers.some(s=>normalize(s.name)===normalize(name)))return toast('Deze leverancier bestaat al.',true); state.suppliers.push({id:uid('sup'),name,email:$('#simpleEmail').value.trim(),phone:$('#simplePhone').value.trim(),contact:$('#simpleContact').value.trim(),createdAt:isoToday()}); }
  saveState(); $('#simpleDialog').close(); renderAll(); toast(type==='customer'?'Klant toegevoegd.':'Leverancier toegevoegd.');
});

function detectDelimiter(text){ const line=(text.split(/\r?\n/).find(Boolean)||''); const candidates=[',',';','\t']; return candidates.sort((a,b)=>line.split(b).length-line.split(a).length)[0]; }
function parseCSV(text){
  const delimiter=detectDelimiter(text); const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){ const ch=text[i],next=text[i+1]; if(ch==='"'){ if(quoted&&next==='"'){field+='"';i++;} else quoted=!quoted; } else if(ch===delimiter&&!quoted){row.push(field);field='';} else if((ch==='\n'||ch==='\r')&&!quoted){ if(ch==='\r'&&next==='\n')i++; row.push(field); if(row.some(v=>v.trim()!==''))rows.push(row); row=[];field=''; } else field+=ch; }
  row.push(field); if(row.some(v=>v.trim()!==''))rows.push(row); if(!rows.length)return {headers:[],rows:[],delimiter};
  const headers=rows[0].map((h,i)=>h.trim()||`Kolom ${i+1}`); const data=rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()]))); return {headers,rows:data,delimiter};
}
function heuristicMapping(header){ const n=normalize(header); let best=''; let score=0; for(const [field,syns] of Object.entries(FIELD_SYNONYMS)){ for(const s of syns){ const sn=normalize(s); const hit=n===sn?100:n.includes(sn)||sn.includes(n)?70:0; if(hit>score){best=field;score=hit;} } } return best; }
function resolvedSupplier(){ return $('#importSupplierNew').value.trim()||$('#importSupplier').value||''; }
function suggestedMapping(header,supplier){ const supplierMap=(state.supplierMappings[supplier]||{})[normalize(header)]; if(supplierMap!==undefined)return {value:supplierMap,source:'leverancier'}; const global=state.globalMappings[normalize(header)]; if(global!==undefined)return {value:global,source:'globaal'}; const heuristic=heuristicMapping(header); return {value:heuristic,source:heuristic?'automatisch':''}; }
function mappingOptions(selected){ return CANONICAL_FIELDS.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join(''); }
function renderMappings(){
  if(!csvContext)return; const supplier=resolvedSupplier();
  $('#mappingRows').innerHTML=csvContext.headers.map((h,i)=>{const suggestion=suggestedMapping(h,supplier);return `<div class="mapping-row"><div><div class="mapping-source">${esc(h)}</div>${suggestion.source?`<div class="muted">${esc(suggestion.source)}</div>`:''}</div><div class="mapping-arrow">→</div><select data-map-index="${i}" data-header="${esc(h)}">${mappingOptions(suggestion.value)}</select></div>`}).join('');
  $('#mappingHint').textContent=`${csvContext.rows.length} rijen klaar om te importeren`;
  $('#runImportBtn').disabled=!csvContext.rows.length;
}
function cleanStatus(value){ const n=normalize(value); const exact=STATUSES.find(s=>normalize(s)===n); if(exact)return exact; if(n.includes('wacht'))return 'Wachten op onderdeel'; if(n.includes('diagn'))return 'Diagnose'; if(n.includes('repar'))return 'In reparatie'; if(n.includes('klaar')||n.includes('ready'))return 'Klaar'; if(n.includes('afge')||n.includes('picked'))return 'Afgehaald'; return 'Nieuw'; }
function cleanDate(value){ if(!value)return ''; const s=String(value).trim(); if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10); const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''; }
function cleanPrice(value){ if(!value)return 0; let s=String(value).replace(/[^0-9,.-]/g,''); if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replaceAll('.','').replace(',','.'):s.replaceAll(',',''); else s=s.replace(',','.'); return Number(s)||0; }
function runImport(){
  if(!csvContext)return; const supplierProfile=resolvedSupplier(); if(supplierProfile)ensureSupplier(supplierProfile);
  const selections=$$('[data-map-index]').map(el=>({header:el.dataset.header,field:el.value})); const fieldMap=Object.fromEntries(selections.filter(x=>x.field).map(x=>[x.field,x.header]));
  selections.forEach(({header,field})=>{ const key=normalize(header); state.globalMappings[key]=field; if(supplierProfile){ state.supplierMappings[supplierProfile] ||= {}; state.supplierMappings[supplierProfile][key]=field; } });
  let created=0,updated=0;
  for(const row of csvContext.rows){ const get=f=>fieldMap[f]?row[fieldMap[f]]:''; const externalId=get('externalId'); const customerName=get('customerName')||'Onbekende klant'; const customer=findOrCreateCustomer(customerName,get('email'),get('phone')); const rowSupplier=get('supplier')||supplierProfile; ensureSupplier(rowSupplier);
    const payload={externalId,customerId:customer?.id||'',customerName,email:get('email'),phone:get('phone'),device:get('device')||'Onbekend toestel',brand:get('brand'),model:get('model'),serial:get('serial'),issue:get('issue')||'',status:cleanStatus(get('status')),createdAt:cleanDate(get('createdAt'))||isoToday(),dueDate:cleanDate(get('dueDate')),supplier:rowSupplier,price:cleanPrice(get('price')),notes:get('notes')};
    let existing=externalId?state.repairs.find(r=>String(r.externalId)===String(externalId)):null;
    if(!existing&&payload.serial){ existing=state.repairs.find(r=>normalize(r.serial)===normalize(payload.serial)&&normalize(r.customerName)===normalize(payload.customerName)); }
    if(existing){ Object.assign(existing,payload,{updatedAt:new Date().toISOString()}); updated++; }
    else { state.repairs.push({id:uid('rep'),number:nextRepairNumber(),...payload}); created++; }
  }
  saveState(); renderAll(); toast(`${created} toegevoegd${updated?`, ${updated} bijgewerkt`:''}.`); setView('repairs');
}

async function handleCSVFile(file){
  if(!file)return; try{ const text=await file.text(); const parsed=parseCSV(text.replace(/^\uFEFF/,'')); if(!parsed.headers.length)throw new Error('Geen kolommen gevonden'); csvContext={...parsed,fileName:file.name}; $('#fileInfo').classList.remove('hidden'); $('#fileInfo').textContent=`${file.name} · ${parsed.rows.length} rijen · ${parsed.headers.length} kolommen`; renderMappings(); }
  catch(err){ csvContext=null; $('#fileInfo').classList.add('hidden'); $('#mappingRows').innerHTML='<div class="empty-state compact">CSV kon niet gelezen worden.</div>'; $('#runImportBtn').disabled=true; toast(err.message||'CSV kon niet gelezen worden.',true); }
}

function download(name,content,type='text/plain'){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function csvCell(v){ const s=String(v??''); return /[";,\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
function exportRepairs(){ const headers=['Nummer','Extern ID','Klant','Toestel','Merk','Model','Serienummer','Probleem','Status','Aangemaakt','Deadline','Leverancier','Bedrag','Notities']; const rows=filteredRepairs().map(r=>[r.number,r.externalId,r.customerName,r.device,r.brand,r.model,r.serial,r.issue,r.status,r.createdAt,r.dueDate,r.supplier,r.price,r.notes]); download(`ledsrepair-reparaties-${isoToday()}.csv`,[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8'); }

// Navigation and actions
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.go)));
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#newRepairBtn').addEventListener('click',()=>openRepair());
$('#newCustomerBtn').addEventListener('click',()=>openSimple('customer'));
$('#newSupplierBtn').addEventListener('click',()=>openSimple('supplier'));
$('#exportRepairsBtn').addEventListener('click',exportRepairs);
$('#globalSearch').addEventListener('input',e=>{currentSearch=e.target.value;renderAll();});
$('#repairStatusFilter').addEventListener('click',e=>{const b=e.target.closest('button[data-status]');if(!b)return;repairFilter=b.dataset.status;$$('#repairStatusFilter button').forEach(x=>x.classList.toggle('active',x===b));renderRepairs();});
document.addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit-repair]'); if(edit)return openRepair(edit.dataset.editRepair);
  const del=e.target.closest('[data-delete-repair]'); if(del&&confirm('Deze reparatie verwijderen?')){state.repairs=state.repairs.filter(r=>r.id!==del.dataset.deleteRepair);saveState();renderAll();toast('Reparatie verwijderd.');return;}
  const dc=e.target.closest('[data-delete-customer]'); if(dc&&confirm('Deze klant verwijderen? Bestaande reparaties blijven behouden.')){state.customers=state.customers.filter(c=>c.id!==dc.dataset.deleteCustomer);saveState();renderAll();toast('Klant verwijderd.');return;}
  const ds=e.target.closest('[data-delete-supplier]'); if(ds&&confirm('Deze leverancier verwijderen? Bestaande reparaties blijven behouden.')){state.suppliers=state.suppliers.filter(s=>s.id!==ds.dataset.deleteSupplier);saveState();renderAll();toast('Leverancier verwijderd.');}
});

$('#csvFile').addEventListener('change',e=>handleCSVFile(e.target.files[0]));
$('#importSupplier').addEventListener('change',renderMappings); $('#importSupplierNew').addEventListener('input',renderMappings);
$('#runImportBtn').addEventListener('click',runImport);
const dz=$('#dropzone'); ['dragenter','dragover'].forEach(type=>dz.addEventListener(type,e=>{e.preventDefault();dz.classList.add('drag')})); ['dragleave','drop'].forEach(type=>dz.addEventListener(type,e=>{e.preventDefault();dz.classList.remove('drag')})); dz.addEventListener('drop',e=>handleCSVFile(e.dataTransfer.files[0]));
$('#backupBtn').addEventListener('click',()=>download(`ledsrepair-crm-backup-${isoToday()}.json`,JSON.stringify(state,null,2),'application/json'));
$('#restoreFile').addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text()); if(!data||!Array.isArray(data.repairs))throw new Error(); state={...emptyState(),...data};saveState();renderAll();toast('Back-up hersteld.');}catch{toast('Ongeldige back-up.',true);}e.target.value='';});
$('#clearMappingsBtn').addEventListener('click',()=>{if(confirm('Alle aangeleerde CSV-mappings wissen?')){state.globalMappings={};state.supplierMappings={};saveState();renderAll();toast('Mappings gewist.');}});
$('#resetBtn').addEventListener('click',()=>{if(confirm('Alle lokale CRM-data definitief wissen?')){state=emptyState();saveState();renderAll();toast('Lokale data gewist.');}});

// First run: keep the CRM empty but initialise storage.
if(!localStorage.getItem(STORAGE_KEY))saveState();
renderAll();
