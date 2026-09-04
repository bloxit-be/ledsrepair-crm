// Rich customer records and customer-first repair intake.
(function initCustomerUi(){
  function ensureCustomerShape(customer){
    return Object.assign({
      company:'',vatNumber:'',email:'',phone:'',mobile:'',street:'',houseNumber:'',postalCode:'',city:'',country:'België',notes:''
    }, customer || {});
  }
  state.customers = (state.customers || []).map(customer => ensureCustomerShape(customer));

  function ensureCustomerDialog(){
    let dialog = document.getElementById('customerEditorDialog');
    if(dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'customerEditorDialog';
    dialog.className = 'modal customer-dialog';
    dialog.innerHTML = `
      <form id="customerEditorForm">
        <div class="modal-head">
          <div><p class="eyebrow">Klant</p><h2 id="customerEditorTitle">Nieuwe klant</h2></div>
          <button type="button" class="icon-btn" id="customerEditorClose">×</button>
        </div>
        <input type="hidden" id="customerEditorId">
        <div class="form-grid">
          <label class="field span-2"><span>Naam *</span><input id="customerName" required autocomplete="name"></label>
          <label class="field"><span>Bedrijf</span><input id="customerCompany" autocomplete="organization"></label>
          <label class="field"><span>BTW-nummer</span><input id="customerVat" placeholder="BE0..." autocomplete="off"></label>
          <label class="field"><span>E-mail</span><input id="customerEmail" type="email" autocomplete="email"></label>
          <label class="field"><span>Telefoon</span><input id="customerPhone" type="tel" autocomplete="tel"></label>
          <label class="field"><span>Mobiel</span><input id="customerMobile" type="tel" autocomplete="tel"></label>
          <div class="span-2 customer-address-grid">
            <label class="field"><span>Straat</span><input id="customerStreet" autocomplete="address-line1"></label>
            <label class="field"><span>Nr.</span><input id="customerHouseNumber" autocomplete="address-line2"></label>
          </div>
          <label class="field"><span>Postcode</span><input id="customerPostalCode" autocomplete="postal-code"></label>
          <label class="field"><span>Gemeente / stad</span><input id="customerCity" autocomplete="address-level2"></label>
          <label class="field span-2"><span>Land</span><input id="customerCountry" value="België" autocomplete="country-name"></label>
          <label class="field span-2"><span>Notities</span><textarea id="customerNotes" rows="3" placeholder="Optionele klantnotities"></textarea></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="customerEditorCancel">Annuleren</button>
          <button type="submit" class="btn primary">Klant opslaan</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  const dialog = ensureCustomerDialog();
  let customerEditorContext = { source:'customers', seedName:'' };

  function refreshCustomerSelect(selectedId){
    const select = document.getElementById('repairCustomerSelect');
    if(!select) return;
    const current = selectedId || select.value;
    const customers = [...state.customers].sort((a,b)=>a.name.localeCompare(b.name));
    select.innerHTML = [
      '<option value="">Kies bestaande klant...</option>',
      ...customers.map(c=>`<option value="${c.id}">${esc(c.name)}${c.company?` — ${esc(c.company)}`:''}</option>`),
      '<option value="__new__">+ Nieuwe klant toevoegen...</option>'
    ].join('');
    if(customers.some(c=>c.id===current)) select.value=current;
    else select.value='';
    const inline = document.getElementById('repairNewCustomer');
    if(inline) inline.required=false;
  }

  function openCustomerEditor(id=null, options={}){
    const existing=id?state.customers.find(c=>c.id===id):null;
    const customer=ensureCustomerShape(existing || {});
    customerEditorContext={source:options.source||'customers',seedName:options.seedName||''};
    document.getElementById('customerEditorForm').reset();
    document.getElementById('customerEditorId').value=existing?.id||'';
    document.getElementById('customerEditorTitle').textContent=existing?'Klant aanpassen':'Nieuwe klant';
    document.getElementById('customerName').value=existing?.name||options.seedName||'';
    document.getElementById('customerCompany').value=customer.company||'';
    document.getElementById('customerVat').value=customer.vatNumber||'';
    document.getElementById('customerEmail').value=customer.email||'';
    document.getElementById('customerPhone').value=customer.phone||'';
    document.getElementById('customerMobile').value=customer.mobile||'';
    document.getElementById('customerStreet').value=customer.street||'';
    document.getElementById('customerHouseNumber').value=customer.houseNumber||'';
    document.getElementById('customerPostalCode').value=customer.postalCode||'';
    document.getElementById('customerCity').value=customer.city||'';
    document.getElementById('customerCountry').value=customer.country||'België';
    document.getElementById('customerNotes').value=customer.notes||'';
    if(!dialog.open) dialog.showModal();
    setTimeout(()=>document.getElementById('customerName')?.focus(),50);
  }

  function closeCustomerEditor(cancelled=false){
    if(dialog.open) dialog.close();
    if(cancelled && customerEditorContext.source==='repair'){
      const select=document.getElementById('repairCustomerSelect');
      if(select?.value==='__new__') select.value='';
      const inline=document.getElementById('repairNewCustomer');
      if(inline) inline.required=false;
    }
    customerEditorContext={source:'customers',seedName:''};
  }

  document.getElementById('customerEditorClose').addEventListener('click',()=>closeCustomerEditor(true));
  document.getElementById('customerEditorCancel').addEventListener('click',()=>closeCustomerEditor(true));
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeCustomerEditor(true)});

  document.getElementById('customerEditorForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity()) return;
    const id=document.getElementById('customerEditorId').value;
    const name=document.getElementById('customerName').value.trim();
    const duplicate=state.customers.find(c=>c.id!==id && normalize(c.name)===normalize(name));
    if(duplicate){toast('Er bestaat al een klant met deze naam.',true);return;}
    const data={
      name,
      company:document.getElementById('customerCompany').value.trim(),
      vatNumber:document.getElementById('customerVat').value.trim(),
      email:document.getElementById('customerEmail').value.trim(),
      phone:document.getElementById('customerPhone').value.trim(),
      mobile:document.getElementById('customerMobile').value.trim(),
      street:document.getElementById('customerStreet').value.trim(),
      houseNumber:document.getElementById('customerHouseNumber').value.trim(),
      postalCode:document.getElementById('customerPostalCode').value.trim(),
      city:document.getElementById('customerCity').value.trim(),
      country:document.getElementById('customerCountry').value.trim()||'België',
      notes:document.getElementById('customerNotes').value.trim()
    };
    let customer;
    if(id){
      customer=state.customers.find(c=>c.id===id);
      if(!customer) return;
      Object.assign(customer,data,{updatedAt:new Date().toISOString()});
      state.repairs.filter(r=>r.customerId===id).forEach(r=>{r.customerName=name;});
    }else{
      customer={id:uid('cus'),createdAt:localToday(),...data};
      state.customers.push(customer);
    }
    if(!saveState()) return;
    const source=customerEditorContext.source;
    closeCustomerEditor(false);
    renderCustomers();
    renderDashboard();
    renderRepairs();
    renderBoard();
    refreshCustomerSelect(source==='repair'?customer.id:undefined);
    if(source==='repair'){
      const inline=document.getElementById('repairNewCustomer');
      if(inline){inline.required=false;inline.value='';}
    }
    toast(id?'Klant aangepast.':'Klant toegevoegd.');
  });

  renderCustomers = function(){
    const q=normalize(currentSearch);
    const list=[...state.customers]
      .map(c=>ensureCustomerShape(c))
      .filter(c=>!q||normalize([c.name,c.company,c.vatNumber,c.email,c.phone,c.mobile,c.street,c.houseNumber,c.postalCode,c.city,c.country].join(' ')).includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('customersEmpty').classList.toggle('hidden',list.length>0);
    document.getElementById('customersGrid').innerHTML=list.map(c=>{
      const jobs=state.repairs.filter(r=>r.customerId===c.id||normalize(r.customerName)===normalize(c.name));
      const address=[c.street,c.houseNumber].filter(Boolean).join(' ');
      const city=[c.postalCode,c.city].filter(Boolean).join(' ');
      const addressText=[address,city,c.country&&c.country!=='België'?c.country:''].filter(Boolean).join(' · ');
      return `<article class="entity-card">
        <div class="entity-card-head">
          <div><h3>${esc(c.name)}</h3><p>${esc(c.company||c.email||c.phone||c.mobile||'Geen contactgegevens')}</p>${addressText?`<p class="customer-card-address">${esc(addressText)}</p>`:''}</div>
          <div class="customer-card-actions"><button class="table-btn" data-edit-customer="${c.id}">Aanpassen</button><button class="table-btn" data-delete-customer="${c.id}">Verwijder</button></div>
        </div>
        <div class="customer-contact-list">${c.email?`<a class="mini-pill" href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.phone?`<a class="mini-pill" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:''}${c.mobile?`<a class="mini-pill" href="tel:${esc(c.mobile)}">${esc(c.mobile)}</a>`:''}</div>
        <div class="entity-meta"><span class="mini-pill">${jobs.length} reparaties</span><span class="mini-pill">${jobs.filter(r=>!isClosed(r)).length} open</span>${c.vatNumber?`<span class="mini-pill">${esc(c.vatNumber)}</span>`:''}</div>
      </article>`;
    }).join('');
  };

  // Existing app opens a tiny generic customer form. Intercept these flows and
  // use the richer customer editor instead.
  document.addEventListener('click',event=>{
    const newButton=event.target.closest('#newCustomerBtn');
    if(newButton){
      event.preventDefault();event.stopImmediatePropagation();
      openCustomerEditor(null,{source:'customers'});
      return;
    }
    const editButton=event.target.closest('[data-edit-customer]');
    if(editButton){
      event.preventDefault();event.stopImmediatePropagation();
      openCustomerEditor(editButton.dataset.editCustomer,{source:'customers'});
    }
  },true);

  const customerSelect=document.getElementById('repairCustomerSelect');
  customerSelect?.addEventListener('change',event=>{
    if(event.target.value!=='__new__') return;
    event.stopImmediatePropagation();
    const inline=document.getElementById('repairNewCustomer');
    if(inline) inline.required=false;
    openCustomerEditor(null,{source:'repair'});
  },true);

  // When there are no customers yet, opening a new repair should immediately
  // ask for the customer record instead of exposing the old inline name field.
  const baseOpenRepair=openRepair;
  openRepair=function(id=null){
    baseOpenRepair(id);
    const select=document.getElementById('repairCustomerSelect');
    const inline=document.getElementById('repairNewCustomer');
    if(inline) inline.required=false;
    if(select?.value==='__new__'){
      const seed=inline?.value||'';
      requestAnimationFrame(()=>openCustomerEditor(null,{source:'repair',seedName:seed}));
    }
  };

  refreshCustomerSelect();
  renderCustomers();
})();
