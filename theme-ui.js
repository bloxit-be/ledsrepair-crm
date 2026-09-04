const THEME_KEY = 'ledsrepair-crm-theme';

(function initThemeUi(){
  const style = document.createElement('style');
  style.id = 'crm-theme-styles';
  style.textContent = `
    html[data-theme="light"]{
      --bg:#f4f7f9;
      --panel:#ffffff;
      --panel2:#f2f5f7;
      --line:#dbe3e9;
      --text:#15212b;
      --muted:#657585;
      --accent:#159b68;
      --danger:#d84f4f;
      --warn:#b9781e;
      --blue:#367dd8;
      --shadow:0 12px 28px rgba(25,40,52,.08);
      background:#f4f7f9;
      color:var(--text);
    }
    html[data-theme="light"] body{background:radial-gradient(circle at 15% -10%,rgba(21,155,104,.08),transparent 28%),var(--bg)}
    html[data-theme="light"] .sidebar{background:rgba(255,255,255,.95)}
    html[data-theme="light"] .topbar{background:linear-gradient(to bottom,rgba(244,247,249,.98),rgba(244,247,249,.9) 80%,transparent)}
    html[data-theme="light"] .stat-card,
    html[data-theme="light"] .panel,
    html[data-theme="light"] .entity-card{background:linear-gradient(145deg,#fff,#fbfcfd)}
    html[data-theme="light"] .field input,
    html[data-theme="light"] .field select,
    html[data-theme="light"] .field textarea,
    html[data-theme="light"] .picker-search input,
    html[data-theme="light"] .mapping-row select,
    html[data-theme="light"] .kanban-card select{background:#fff;color:var(--text)}
    html[data-theme="light"] .kanban-column{background:#f7f9fa}
    html[data-theme="light"] .kanban-head{background:#f9fbfc}
    html[data-theme="light"] .kanban-card{background:#fff}
    html[data-theme="light"] .modal{background:#fff;color:var(--text)}
    html[data-theme="light"] .form-section{background:#fbfcfd}
    html[data-theme="light"] .thumb,
    html[data-theme="light"] .photo-thumb{background:#f3f6f8}
    html[data-theme="light"] tbody tr:hover{background:rgba(21,155,104,.035)}
    html[data-theme="light"] .status-Klaar{background:rgba(21,33,43,.06);color:#536473;border-color:rgba(21,33,43,.1)}
    html[data-theme="light"] .status-Afgehaald{background:rgba(21,33,43,.035);color:#70808e;border-color:rgba(21,33,43,.08)}
    html[data-theme="light"] .mini-pill{color:#596b79}
    html[data-theme="light"] .product-photo-placeholder{color:#80909c}
    html[data-theme="light"] .attention-item{background:#fbfcfd}
    html[data-theme="light"] .dropzone,
    html[data-theme="light"] .photo-drop{background:#fbfcfd}
    html[data-theme="light"] .search-wrap{background:#fff}
    .theme-toggle{white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
    .theme-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
    .theme-choice button{min-height:44px}
    .theme-choice button.active{background:var(--accent);border-color:var(--accent);color:#06100b}
    .attention-explainer{margin:4px 0 0!important}
    @media(max-width:560px){
      .theme-toggle{width:40px;padding:0;justify-content:center;min-height:40px}
      .theme-toggle .theme-label{display:none}
    }
  `;
  document.head.appendChild(style);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const stored = localStorage.getItem(THEME_KEY);
  let theme = stored === 'light' || stored === 'dark' ? stored : 'dark';

  function applyTheme(next){
    theme = next === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    if(metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#f4f7f9' : '#0b0f14');
    const topButton = document.getElementById('themeToggle');
    if(topButton){
      topButton.querySelector('.theme-icon').textContent = theme === 'light' ? '☀' : '☾';
      topButton.querySelector('.theme-label').textContent = theme === 'light' ? 'Licht' : 'Donker';
      topButton.setAttribute('aria-label', `Thema wijzigen. Huidig thema: ${theme === 'light' ? 'licht' : 'donker'}`);
    }
    document.querySelectorAll('[data-set-theme]').forEach(button => button.classList.toggle('active', button.dataset.setTheme === theme));
  }

  const topActions = document.querySelector('.top-actions');
  if(topActions && !document.getElementById('themeToggle')){
    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.type = 'button';
    button.className = 'btn secondary theme-toggle';
    button.innerHTML = '<span class="theme-icon">☾</span><span class="theme-label">Donker</span>';
    button.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));
    topActions.insertBefore(button, topActions.firstChild);
  }

  const settingsGrid = document.querySelector('#view-settings .settings-grid');
  if(settingsGrid && !document.getElementById('themeSettingsCard')){
    const card = document.createElement('article');
    card.id = 'themeSettingsCard';
    card.className = 'panel';
    card.innerHTML = `
      <p class="eyebrow">Weergave</p>
      <h2>Thema</h2>
      <p class="muted">Kies een donkere of lichte weergave. Je keuze wordt op dit toestel onthouden.</p>
      <div class="theme-choice">
        <button type="button" class="btn secondary" data-set-theme="dark">☾ Donker</button>
        <button type="button" class="btn secondary" data-set-theme="light">☀ Licht</button>
      </div>
    `;
    settingsGrid.prepend(card);
    card.querySelectorAll('[data-set-theme]').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.setTheme)));
  }

  const attentionPanel = document.getElementById('attentionList')?.closest('.panel');
  if(attentionPanel){
    const title = attentionPanel.querySelector('h2');
    if(title) title.textContent = 'Aandachtspunten';
    const headText = attentionPanel.querySelector('.panel-head > div');
    if(headText && !headText.querySelector('.attention-explainer')){
      const explanation = document.createElement('p');
      explanation.className = 'muted attention-explainer';
      explanation.textContent = 'Automatisch: reparaties over deadline of wachtend op een onderdeel.';
      headText.appendChild(explanation);
    }
  }

  applyTheme(theme);
})();
