// Rich supplier records for LEDsRepair CRM MVP.
(function initSupplierUi(){
  function ensureSupplierShape(supplier){
    return Object.assign({
      contact:'',email:'',phone:'',mobile:'',vatNumber:'',website:'',street:'',houseNumber:'',postalCode:'',city:'',country:'België',notes:''
    }, supplier || {});
  }

  state.suppliers = (state.suppliers || []).map(supplier => ensureSupplierShape(supplier));

  function ensureSupplierDialog(){
    let dialog=document.getElementById('supplierEditorDialog');
    if(dialog) return dialog;
    dialog=document.createElement('dialog');
    dialog.id='supplierEditorDialog';
    dialog.className='modal supplier-dialog';
    dialog.innerHTML=`
      <form id="supplierEditorForm">
        <div class="modal-head">
          <div><p class="eyebrow">Leverancier</p><h2 id="supplierEditorTitle">Nieuwe leverancier</h2></div>
          <button type="button" class="icon-btn" id="supplierEditorClose">×</button>
        </div>
        <input type="hidden" id="supplierEditorId">
        <div class="form-grid">
          <label class="field span-2"><span>Naam *</span><input id="supplierName" required autocomplete="organization"></label>
          <label class="field"><span>Contactpersoon</span><input id="supplierContact" autocomplete="name"></label>
          <label class="field"><span>BTW-nummer</span><input id="supplierVat" placeholder="BE0..." autocomplete="off"></label>
          <label class="field"><span>E-mail</span><input id="supplierEmail" type="email" autocomplete="email"></label>
          <label class="field"><span>Telefoon</span><input id="supplierPhone" type="tel" autocomplete="tel"></label>
          <label class="field"><span>Mobiel</span><input id="supplierMobile" type="tel" autocomplete="tel"></label>
          <label class="field"><span>Website</span><input id="supplierWebsite" type="url" placeholder="https://..." autocomplete="url"></label>
          <div class="span-2 supplier-address-grid">
            <label class="field"><span>Straat</span><input id="supplierStreet" autocomplete="address-line1"></label>
            <label class="field"><span>Nr.</span><input id="supplierHouseNumber" autocomplete="address-line2"></label>
          </div>
          <label class="field"><span>Postcode</span><input id="supplierPostalCode" autocomplete="postal-code"></label>
          <label class="field"><span>Gemeente / stad</span><input id="supplierCity" autocomplete="address-level2"></label>
          <label class="field span-2"><span>Land</span><input id="supplierCountry" value="België" autocomplete="country-name"></label>
          <label class="field span-2"><span>Notities</span><textarea id="supplierNotes" rows="3" placeholder="Optionele notities"></textarea></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="supplierEditorCancel">Annuleren</button>
          <button type="submit" class="btn primary">Leverancier opslaan</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  const dialog=ensureSupplierDialog();

  function openSupplierEditor(id=null){
    const existing=id?state.suppliers.find(s=>s.id===id):null;
    const supplier=ensureSupplierShape(existing || {});
    document.getElementById('supplierEditorForm').reset();
    document.getElementById('supplierEditorId').value=existing?.id||'';
    document.getElementById('supplierEditorTitle').textContent=existing?'Leverancier aanpassen':'Nieuwe leverancier';
    document.getElementById('supplierName').value=existing?.name||'';
    document.getElementById('supplierContact').value=supplier.contact||'';
    document.getElementById('supplierVat').value=supplier.vatNumber||'';
    document.getElementById('supplierEmail').value=supplier.email||'';
    document.getElementById('supplierPhone').value=supplier.phone||'';
    document.getElementById('supplierMobile').value=supplier.mobile||'';
    document.getElementById('supplierWebsite').value=supplier.website||'';
    document.getElementById('supplierStreet').value=supplier.street||'';
    document.getElementById('supplierHouseNumber').value=supplier.houseNumber||'';
    document.getElementById('supplierPostalCode').value=supplier.postalCode||'';
    document.getElementById('supplierCity').value=supplier.city||'';
    document.getElementById('supplierCountry').value=supplier.country||'België';
    document.getElementById('supplierNotes').value=supplier.notes||'';
    if(!dialog.open) dialog.showModal();
    setTimeout(()=>document.getElementById('supplierName')?.focus(),50);
  }

  function closeSupplierEditor(){ if(dialog.open) dialog.close(); }
  document.getElementById('supplierEditorClose').addEventListener('click',closeSupplierEditor);
  document.getElementById('supplierEditorCancel').addEventListener('click',closeSupplierEditor);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeSupplierEditor();});

  function refreshSupplierSelects(oldName='',newName=''){
    if(oldName && newName && normalize(oldName)!==normalize(newName)){
      state.products.forEach(product=>{ if(normalize(product.supplier)===normalize(oldName)) product.supplier=newName; });
      state.repairs.forEach(repair=>{ if(normalize(repair.supplier)===normalize(oldName)) repair.supplier=newName; });
      if(state.supplierMappings?.[oldName] && !state.supplierMappings[newName]){
        state.supplierMappings[newName]=state.supplierMappings[oldName];
        delete state.supplierMappings[oldName];
      }
    }
    hydrateSelects();
  }

  document.getElementById('supplierEditorForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity()) return;
    const id=document.getElementById('supplierEditorId').value;
    const name=document.getElementById('supplierName').value.trim();
    const duplicate=state.suppliers.find(s=>s.id!==id && normalize(s.name)===normalize(name));
    if(duplicate){ toast('Er bestaat al een leverancier met deze naam.',true); return; }
    const data={
      name,
      contact:document.getElementById('supplierContact').value.trim(),
      vatNumber:document.getElementById('supplierVat').value.trim(),
      email:document.getElementById('supplierEmail').value.trim(),
      phone:document.getElementById('supplierPhone').value.trim(),
      mobile:document.getElementById('supplierMobile').value.trim(),
      website:document.getElementById('supplierWebsite').value.trim(),
      street:document.getElementById('supplierStreet').value.trim(),
      houseNumber:document.getElementById('supplierHouseNumber').value.trim(),
      postalCode:document.getElementById('supplierPostalCode').value.trim(),
      city:document.getElementById('supplierCity').value.trim(),
      country:document.getElementById('supplierCountry').value.trim()||'België',
      notes:document.getElementById('supplierNotes').value.trim()
    };
    let supplier;
    let oldName='';
    if(id){
      supplier=state.suppliers.find(s=>s.id===id);
      if(!supplier) return;
      oldName=supplier.name||'';
      Object.assign(supplier,data,{updatedAt:new Date().toISOString()});
    }else{
      supplier={id:uid('sup'),createdAt:localToday(),...data};
      state.suppliers.push(supplier);
    }
    refreshSupplierSelects(oldName,name);
    if(!saveState()) return;
    closeSupplierEditor();
    renderAll();
    toast(id?'Leverancier aangepast.':'Leverancier toegevoegd.');
  });

  renderSuppliers=function(){
    const q=normalize(currentSearch);
    const list=[...state.suppliers]
      .map(s=>ensureSupplierShape(s))
      .filter(s=>!q||normalize([s.name,s.contact,s.email,s.phone,s.mobile,s.vatNumber,s.website,s.street,s.houseNumber,s.postalCode,s.city,s.country].join(' ')).includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('suppliersEmpty').classList.toggle('hidden',list.length>0);
    document.getElementById('suppliersGrid').innerHTML=list.map(s=>{
      const products=state.products.filter(p=>normalize(p.supplier)===normalize(s.name)).length;
      const repairs=state.repairs.filter(r=>normalize(r.supplier)===normalize(s.name)).length;
      const address=[s.street,s.houseNumber].filter(Boolean).join(' ');
      const city=[s.postalCode,s.city].filter(Boolean).join(' ');
      const addressText=[address,city,s.country&&s.country!=='België'?s.country:''].filter(Boolean).join(' · ');
      const websiteHref=s.website && !/^https?:\/\//i.test(s.website)?`https://${s.website}`:s.website;
      return `<article class="entity-card">
        <div class="entity-card-head">
          <div><h3>${esc(s.name)}</h3><p>${esc(s.contact||s.email||s.phone||s.mobile||'Geen contactgegevens')}</p>${addressText?`<p class="supplier-card-address">${esc(addressText)}</p>`:''}</div>
          <div class="supplier-card-actions"><button class="table-btn" data-edit-supplier="${s.id}">Aanpassen</button><button class="table-btn" data-delete-supplier="${s.id}">Verwijder</button></div>
        </div>
        <div class="supplier-contact-list">${s.email?`<a class="mini-pill" href="mailto:${esc(s.email)}">${esc(s.email)}</a>`:''}${s.phone?`<a class="mini-pill" href="tel:${esc(s.phone)}">${esc(s.phone)}</a>`:''}${s.mobile?`<a class="mini-pill" href="tel:${esc(s.mobile)}">${esc(s.mobile)}</a>`:''}${websiteHref?`<a class="mini-pill" href="${esc(websiteHref)}" target="_blank" rel="noopener">Website</a>`:''}</div>
        <div class="entity-meta"><span class="mini-pill">${products} producten</span><span class="mini-pill">${repairs} reparaties</span><span class="mini-pill">${Object.keys(state.supplierMappings[s.name]||{}).length} mappings</span>${s.vatNumber?`<span class="mini-pill">${esc(s.vatNumber)}</span>`:''}</div>
      </article>`;
    }).join('');
  };

  document.addEventListener('click',event=>{
    const newButton=event.target.closest('#newSupplierBtn');
    if(newButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      openSupplierEditor();
      return;
    }
    const editButton=event.target.closest('[data-edit-supplier]');
    if(editButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      openSupplierEditor(editButton.dataset.editSupplier);
    }
  },true);

  renderSuppliers();
})();
