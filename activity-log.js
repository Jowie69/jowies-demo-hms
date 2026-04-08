/**
 * Hiraya HMS — Activity Log  v6.0  (definitive)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single shared module. Add to every page AFTER sidebar.js:
 *
 *   <script src="activity-log.js"></script>
 *
 * Add a panel mount point wherever you want the log to appear:
 *
 *   <div id="hms-activity-log-mount"></div>
 *
 * Global API:
 *   window.actLog({ cat, action, message, detail?, user?, role? })
 *
 * Pages + functions covered:
 *
 *  INDEX        saveRoom · saveLog · deleteLog · quickPostLog
 *               bfstAddOrder · bfstCycleStatus · bfstDeleteOrder
 *               exportBackup · importBackup · clearAllData
 *
 *  RESERVATIONS saveBooking · HirayaDB.deleteBooking · saveGuest
 *               addFOOfficer · deleteFOOfficer
 *               exportBackup · processImport
 *
 *  STAFFING     saveSchedule · applyQuickAssign
 *               saveStaffMember · deleteStaff · quickDeleteStaff
 *               savePosition · confirmDeletePosition · saveSignatories
 *               copyFromPrevWeek · clearWeek
 *
 *  REVENUE      saveEntry · deleteEntry · bsPrint · bsSaveDraft
 *               exportFullBackup · restoreFullBackup
 *               mergeDailyEntries · clearRevenueData
 *
 *  EVENTS       saveEvent · deleteEvent
 *
 *  INVENTORY    saveItem · quickStep · triggerDelete (via showConfirm intercept)
 *               exportBackup · processImport
 *
 *  ACCOUNTS     saveAccount · toggleActive · triggerDelete  ← direct actLog() calls
 *
 *  ALL PAGES    one session-start auth entry per browser tab
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════ */
  var STORE_KEY = 'hiraya_activity_log';
  var MAX       = 500;

  var CATS = {
    account:   { label: 'Account',   color: '#9b59b6' },
    auth:      { label: 'Auth',      color: '#2ecc71' },
    room:      { label: 'Room',      color: '#C0272D' },
    booking:   { label: 'Booking',   color: '#27ae60' },
    guest:     { label: 'Guest',     color: '#1abc9c' },
    bfst:      { label: 'Breakfast', color: '#e67e22' },
    log:       { label: 'Log',       color: '#3498db' },
    event:     { label: 'Event',     color: '#e91e8c' },
    staff:     { label: 'Staffing',  color: '#16a085' },
    revenue:   { label: 'Revenue',   color: '#f39c12' },
    inventory: { label: 'Inventory', color: '#8e44ad' },
    system:    { label: 'System',    color: '#95a5a6' },
  };

  /* Category filter buttons shown per page */
  var PAGE_CATS = {
    index:        ['room', 'bfst', 'log', 'system'],
    reservations: ['booking', 'guest', 'system'],
    staffing:     ['staff', 'system'],
    revenue:      ['revenue', 'system'],
    events:       ['event', 'system'],
    inventory:    ['inventory', 'system'],
    accounts:     ['account', 'system'],
  };

  var ROLES = {
    superadmin: { label: 'Super Admin', color: '#9b59b6', bg: 'rgba(155,89,182,.18)', border: 'rgba(155,89,182,.35)' },
    admin:      { label: 'Admin',       color: '#3498db', bg: 'rgba(52,152,219,.14)',  border: 'rgba(52,152,219,.35)' },
    fo:         { label: 'FO',          color: '#2ecc71', bg: 'rgba(46,204,113,.13)',  border: 'rgba(46,204,113,.35)' },
  };

  /* ══════════════════════════════════════════════════════
     CSS  (injected once per page)
  ══════════════════════════════════════════════════════ */
  function injectCSS() {
    if (document.getElementById('_hmsAlCss')) return;
    var s = document.createElement('style');
    s.id  = '_hmsAlCss';
    s.textContent = [
      '.alP{background:var(--h-panel);border:1px solid var(--h-border);border-radius:4px;overflow:hidden;margin-bottom:20px;position:relative}',
      '.alP::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(192,39,45,.5),transparent);pointer-events:none}',
      '.alTb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--h-border);background:var(--h-panel2)}',
      '.alFb{padding:3px 8px;border-radius:2px;border:1px solid var(--h-border);background:var(--h-input-bg);color:var(--h-muted);font-family:"DM Sans",sans-serif;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:all .12s}',
      '.alFb:hover,.alFb.on{background:var(--h-red);color:#fff;border-color:var(--h-red)}',
      '.alSr{background:var(--h-input-bg);border:1px solid var(--h-border);border-radius:3px;padding:4px 9px;font-family:"DM Sans",sans-serif;font-size:11px;color:var(--h-text);outline:none;width:145px}',
      '.alSr:focus{border-color:var(--h-red)}',
      '.alSr::placeholder{color:var(--h-muted)}',
      '.alCl{margin-left:auto;padding:3px 8px;border-radius:2px;border:1px solid rgba(231,76,60,.28);background:rgba(231,76,60,.07);color:#e74c3c;font-family:"DM Sans",sans-serif;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:all .12s}',
      '.alCl:hover{background:rgba(231,76,60,.16)}',
      '.alLi{max-height:440px;overflow-y:auto;padding:4px 0}',
      '.alLi::-webkit-scrollbar{width:4px}',
      '.alLi::-webkit-scrollbar-thumb{background:var(--h-border);border-radius:2px}',
      '.alRw{display:grid;grid-template-columns:24px 1fr;gap:0 10px;padding:8px 14px;border-bottom:1px solid var(--h-border);transition:background .1s}',
      '.alRw:last-child{border-bottom:none}',
      '.alRw:hover{background:var(--h-hover-bg)}',
      '.alSp{display:flex;flex-direction:column;align-items:center;padding-top:3px}',
      '.alDt{width:9px;height:9px;border-radius:2px;flex-shrink:0;border:1px solid rgba(255,255,255,.12)}',
      '.alLn{flex:1;width:1px;background:var(--h-border);min-height:12px;margin-top:3px}',
      '.alRw:last-child .alLn{display:none}',
      '.alBd{min-width:0}',
      '.alHd{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px}',
      '.alWh{display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:2px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border:1px solid;white-space:nowrap}',
      '.alWd{width:5px;height:5px;border-radius:50%;flex-shrink:0}',
      '.alBg{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:2px;white-space:nowrap}',
      '.alTm{font-size:10px;color:var(--h-muted);margin-left:auto;white-space:nowrap}',
      '.alMs{font-size:12px;color:var(--h-text);line-height:1.45;word-break:break-word}',
      '.alCh{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}',
      '.alCp{background:var(--h-input-bg);border:1px solid var(--h-border);border-radius:2px;padding:1px 5px;font-size:9px;font-weight:700;font-family:"Cinzel",serif;color:var(--h-sub);letter-spacing:.04em}',
      '.alPg{opacity:.5}',
      '.alEm{padding:30px 14px;text-align:center;font-size:12px;color:var(--h-muted);font-style:italic}',
      '.alFt{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--h-border);background:var(--h-panel2)}',
      '.alLv{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--h-muted)}',
      '.alLd{width:5px;height:5px;border-radius:50%;background:#2ecc71;box-shadow:0 0 5px rgba(46,204,113,.5);animation:alPu 2s ease-in-out infinite}',
      '@keyframes alPu{0%,100%{opacity:1}50%{opacity:.3}}',
      '.alCt{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--h-muted)}',
      '.alEx{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:2px;border:1px solid var(--h-border);background:var(--h-input-bg);color:var(--h-sub);font-family:"DM Sans",sans-serif;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:all .12s;margin-left:auto}',
      '.alEx:hover{background:var(--h-red);color:#fff;border-color:var(--h-red)}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════
     STORAGE
  ══════════════════════════════════════════════════════ */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e) { return []; }
  }
  function save(arr) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(arr.slice(0, MAX))); } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════
     SESSION HELPERS
  ══════════════════════════════════════════════════════ */
  function sUser() {
    try {
      var u = JSON.parse(sessionStorage.getItem('hiraya_user') || '{}');
      return u.name || sessionStorage.getItem('hiraya_role') || 'Staff';
    } catch(e) { return 'Staff'; }
  }
  function sRole() { return sessionStorage.getItem('hiraya_role') || 'fo'; }

  /* ══════════════════════════════════════════════════════
     CORE: actLog
  ══════════════════════════════════════════════════════ */
  function actLog(entry) {
    if (!entry || !entry.cat || !entry.message) return null;
    var rec = {
      id:      'a' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      ts:      new Date().toISOString(),
      cat:     entry.cat,
      action:  entry.action  || 'Action',
      message: entry.message,
      detail:  entry.detail  || null,
      user:    entry.user    || sUser(),
      role:    entry.role    || sRole(),
      page:    entry.page    || (window.HIRAYA_PAGE || ''),
    };
    var all = load(); all.unshift(rec); save(all);
    render();
    window.dispatchEvent(new CustomEvent('hiraya:activity', { detail: rec }));
    return rec;
  }

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  var _filter = 'all';

  function setFilter(cat, btn) {
    _filter = cat;
    var btns = document.querySelectorAll('.alFb');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('on');
    if (btn) btn.classList.add('on');
    render();
  }

  function render() {
    var list    = document.getElementById('_alList');
    var countEl = document.getElementById('_alCount');
    if (!list) return;

    var q   = ((document.getElementById('_alSr') || {}).value || '').toLowerCase();
    var all = load();
    var cur = window.HIRAYA_PAGE || '';

    var rows = all.filter(function(e) {
      if (_filter !== 'all' && e.cat !== _filter) return false;
      if (q) {
        var hay = [e.message, e.action, e.user, e.cat, JSON.stringify(e.detail || '')].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      }
      return true;
    });

    if (countEl) countEl.textContent = rows.length + (rows.length === 1 ? ' entry' : ' entries');

    if (!rows.length) {
      list.innerHTML = '<div class="alEm">' + (q || _filter !== 'all' ? 'No matching entries.' : 'No activity yet.') + '</div>';
      return;
    }

    var out = '';
    for (var i = 0; i < rows.length; i++) {
      var e      = rows[i];
      var isLast = (i === rows.length - 1);
      var cat    = CATS[e.cat]  || CATS.system;
      var role   = ROLES[e.role] || ROLES.fo;

      var chips = '';
      if (e.detail && typeof e.detail === 'object') {
        var keys = Object.keys(e.detail);
        for (var k = 0; k < keys.length; k++) {
          var v = e.detail[keys[k]];
          if (v !== null && v !== undefined && v !== '')
            chips += '<span class="alCp">' + esc(String(v)) + '</span>';
        }
      }
      if (e.page && e.page !== cur)
        chips += '<span class="alCp alPg">via ' + esc(e.page) + '</span>';

      out +=
        '<div class="alRw">' +
          '<div class="alSp">' +
            '<div class="alDt" style="background:' + cat.color + ';border-color:' + cat.color + '44"></div>' +
            (isLast ? '' : '<div class="alLn"></div>') +
          '</div>' +
          '<div class="alBd">' +
            '<div class="alHd">' +
              '<span class="alWh" style="background:' + role.bg + ';color:' + role.color + ';border-color:' + role.border + '">' +
                '<span class="alWd" style="background:' + role.color + '"></span>' + esc(e.user) +
              '</span>' +
              '<span class="alBg" style="background:' + cat.color + '18;color:' + cat.color + ';border:1px solid ' + cat.color + '33">' + esc(e.action) + '</span>' +
              '<span class="alTm" title="' + esc(e.ts) + '">' + fmtTime(e.ts) + '</span>' +
            '</div>' +
            '<div class="alMs">' + esc(e.message) + '</div>' +
            (chips ? '<div class="alCh">' + chips + '</div>' : '') +
          '</div>' +
        '</div>';
    }
    list.innerHTML = out;
  }

  /* ══════════════════════════════════════════════════════
     PANEL HTML
  ══════════════════════════════════════════════════════ */
  function buildPanel(mountEl) {
    var page = window.HIRAYA_PAGE || '';
    var cats = PAGE_CATS[page] || Object.keys(CATS);
    var btns = '<button class="alFb on" onclick="window._alF(\'all\',this)">All</button>';
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i], m = CATS[c];
      if (!m) continue;
      btns += '<button class="alFb" onclick="window._alF(\'' + c + '\',this)">' + m.label + '</button>';
    }
    mountEl.innerHTML =
      '<div class="alP">' +
        '<div class="alTb">' + btns +
          '<input class="alSr" id="_alSr" placeholder="Search…" oninput="window.actRender()">' +
          '<button class="alCl" onclick="window._alCl()">Clear</button>' +
        '</div>' +
        '<div class="alLi" id="_alList"><div class="alEm">Loading…</div></div>' +
        '<div class="alFt">' +
          '<span class="alLv"><span class="alLd"></span>Live</span>' +
          '<span class="alCt" id="_alCount">0 entries</span>' +
          '<button class="alEx" onclick="window.actExportCSV()">' +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>Export CSV' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso), diff = (Date.now() - d) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    var days = Math.floor(diff / 86400);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function toast(msg) {
    var ids = ['hms-toast','acc-toast','rev-toast','res-toast','toast'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(el._alT);
      el._alT = (function(e){ return setTimeout(function(){ e.classList.remove('show'); e.className = ''; }, 2600); })(el);
      return;
    }
  }

  function alClear() {
    if (!confirm('Clear the entire activity log? This cannot be undone.')) return;
    localStorage.removeItem(STORE_KEY);
    render();
    toast('Activity log cleared');
  }

  function actExportCSV() {
    var all = load();
    if (!all.length) { toast('No activity to export.'); return; }
    var rows = [['Timestamp','User','Role','Page','Category','Action','Message','Detail']];
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      rows.push([e.ts, e.user, e.role, e.page||'', e.cat, e.action, e.message, e.detail ? JSON.stringify(e.detail) : '']);
    }
    var csv = rows.map(function(r){
      return r.map(function(v){ return '"' + String(v||'').replace(/"/g,'""') + '"'; }).join(',');
    }).join('\n');
    Object.assign(document.createElement('a'), {
      href:     'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
      download: 'hiraya-activity-' + new Date().toISOString().slice(0,10) + '.csv',
    }).click();
    toast('Activity log exported ✓');
  }

  /* ══════════════════════════════════════════════════════
     PATCH HELPER
     Wraps target[name] with wrapFn(original).
     Retries on window load if the function isn't defined yet.
  ══════════════════════════════════════════════════════ */
  function patch(name, wrapFn, target) {
    var obj = target || window;
    function attempt() {
      if (typeof obj[name] === 'function')
        obj[name] = wrapFn(obj[name]);
    }
    attempt();
    window.addEventListener('load', attempt, { once: true });
  }

  /* Wrap a no-arg function to simply append a fixed log entry after it runs */
  function patchSimple(name, cat, action, message, target) {
    patch(name, function(orig) {
      return function() { orig.apply(this, arguments); actLog({ cat:cat, action:action, message:message }); };
    }, target);
  }

  /* ══════════════════════════════════════════════════════
     AUTH  — one session-start entry per browser tab
  ══════════════════════════════════════════════════════ */
  function logAuth() {
    var key = 'hiraya_act_auth';
    if (sessionStorage.getItem(key)) return;
    var role = sRole(), user = sUser(), page = window.HIRAYA_PAGE || 'unknown';
    actLog({
      cat: 'auth', action: 'Session Started',
      message: user + ' (' + (ROLES[role] ? ROLES[role].label : role) + ') opened ' + page,
      user: user, role: role,
    });
    sessionStorage.setItem(key, '1');
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — INDEX
  ══════════════════════════════════════════════════════ */
  function hookIndex() {

    /* Room status changed */
    patch('saveRoom', function(orig) {
      return function() {
        var rn   = window.activeRoom;
        var prev = (typeof window.buildRoomStates === 'function' ? window.buildRoomStates() : {})[rn] || {};
        var prevS = (prev.status || '—').toUpperCase();
        orig.apply(this, arguments);
        var ns    = (document.getElementById('m-status') || {}).value || '?';
        var meta  = typeof window.getStatusMeta === 'function' ? window.getStatusMeta(ns) : {};
        var guest = ((document.getElementById('m-guest') || {}).value || '').trim();
        var notes = ((document.getElementById('m-notes') || {}).value || '').trim();
        actLog({ cat:'room', action:'Room Status Changed',
          message: 'Room ' + rn + ' → ' + (meta.code||ns) + ' (' + (meta.label||ns) + ')',
          detail: { Room:rn, From:prevS, To:(meta.code||ns).toUpperCase(), Guest:guest||undefined, Notes:notes||undefined } });
      };
    });

    /* Log entry — full modal save */
    patch('saveLog', function(orig) {
      return function() {
        var edit   = !!window.editLogId;
        var prio   = (document.getElementById('lm-priority') || {}).value || 'normal';
        var author = ((document.getElementById('lm-author')  || {}).value || '').trim();
        var msg    = ((document.getElementById('lm-msg')     || {}).value || '').trim().slice(0,80);
        orig.apply(this, arguments);
        actLog({ cat:'log', action: edit ? 'Log Edited' : 'Log Posted',
          message: (edit?'Edited':'Posted') + ' ' + prio + ' log: "' + msg + (msg.length>=80?'…':'') + '"',
          detail: { Priority:prio, Author:author||undefined } });
      };
    });

    /* Log entry — delete */
    patch('deleteLog', function(orig) {
      return function() {
        var id  = window.editLogId;
        var all = typeof window.loadLogs === 'function' ? window.loadLogs() : [];
        var entry = null;
        for (var i=0;i<all.length;i++) { if (all[i].id===id) { entry=all[i]; break; } }
        orig.apply(this, arguments);
        actLog({ cat:'log', action:'Log Deleted',
          message: 'Deleted log: "' + (entry ? (entry.message||'').slice(0,60) : '—') + '"' });
      };
    });

    /* Quick log */
    patch('quickPostLog', function(orig) {
      return function() {
        var prio   = (document.getElementById('qlogPriority') || {}).value || 'normal';
        var author = ((document.getElementById('qlogAuthor')  || {}).value || '').trim();
        var msg    = ((document.getElementById('qlogMsg')     || {}).value || '').trim().slice(0,80);
        if (!msg) { orig.apply(this, arguments); return; }
        orig.apply(this, arguments);
        actLog({ cat:'log', action:'Quick Log Posted',
          message: 'Quick ' + prio + ' log: "' + msg + (msg.length>=80?'…':'') + '"',
          detail: { Priority:prio, Author:author||undefined } });
      };
    });

    /* Breakfast: add order */
    patch('bfstAddOrder', function(orig) {
      return function() {
        var room   = (document.getElementById('bfstRoom')       || {}).value || '?';
        var selEl  = document.getElementById('bfstMealSelect');
        var sel    = selEl ? selEl.value : '';
        var custom = ((document.getElementById('bfstCustomMeal') || {}).value || '').trim();
        var meal   = (sel === '__custom__') ? custom : sel;
        var qty    = (document.getElementById('bfstQty') || {}).value || '1';
        if (!meal) { orig.apply(this, arguments); return; }
        orig.apply(this, arguments);
        actLog({ cat:'bfst', action:'Breakfast Order Added',
          message: 'Room ' + room + ' ordered "' + meal + '" ×' + qty,
          detail: { Room:room, Meal:meal, Qty:'×'+qty } });
      };
    });

    /* Breakfast: cycle status */
    patch('bfstCycleStatus', function(orig) {
      return function(orderId) {
        var date = window.bfstDate || new Date().toISOString().slice(0,10);
        var fn   = typeof window.getOrdersForDate === 'function';
        var bef  = fn ? window.getOrdersForDate(date).filter(function(o){return o.id===orderId;})[0] : null;
        orig.apply(this, arguments);
        if (bef) {
          var aft = fn ? window.getOrdersForDate(date).filter(function(o){return o.id===orderId;})[0] : null;
          actLog({ cat:'bfst', action:'Order Status Updated',
            message: 'Room ' + bef.room + ' "' + bef.meal + '" → ' + ((aft||{}).status||'?').toUpperCase(),
            detail: { Room:bef.room, Meal:bef.meal, Status:((aft||{}).status||'?') } });
        }
      };
    });

    /* Breakfast: delete order */
    patch('bfstDeleteOrder', function(orig) {
      return function(orderId) {
        var date = window.bfstDate || new Date().toISOString().slice(0,10);
        var fn   = typeof window.getOrdersForDate === 'function';
        var o    = fn ? window.getOrdersForDate(date).filter(function(x){return x.id===orderId;})[0] : null;
        orig.apply(this, arguments);
        if (o) actLog({ cat:'bfst', action:'Breakfast Order Removed',
          message: 'Room ' + o.room + ' — removed "' + o.meal + '"',
          detail: { Room:o.room, Meal:o.meal } });
      };
    });

    /* System */
    patchSimple('exportBackup', 'system', 'Backup Exported',  'Exported full HMS data backup');
    patchSimple('importBackup', 'system', 'Backup Restored',  'Restored HMS data from backup file');
    patchSimple('clearAllData', 'system', 'Data Cleared',     'Cleared ALL HMS data');
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — RESERVATIONS
  ══════════════════════════════════════════════════════ */
  function hookReservations() {
    var DB = window.HirayaDB;

    /* Create / update booking */
    patch('saveBooking', function(orig) {
      return function() {
        var edit    = !!window.editId;
        var guest   = ((document.getElementById('f-guest')   ||{}).value||'').trim().toUpperCase();
        var room    = (document.getElementById('f-room')     ||{}).value || '?';
        var type    = (document.getElementById('f-type')     ||{}).value || '';
        var cin     = (document.getElementById('f-cin')      ||{}).value || '';
        var cout    = (document.getElementById('f-cout')     ||{}).value || '';
        var officer = (document.getElementById('f-bookedby') ||{}).value || '';
        var tLabel  = (DB && DB.BOOKING_LABELS && DB.BOOKING_LABELS[type]) || type;
        orig.apply(this, arguments);
        actLog({ cat:'booking', action: edit ? 'Booking Updated' : 'Booking Created',
          message: (edit?'Updated':'Created') + ' booking for "' + guest + '" — Room ' + room + ' (' + tLabel + ')',
          detail: { Room:room, Guest:guest, Type:tLabel, 'Check-In':cin, 'Check-Out':cout, Officer:officer||undefined } });
      };
    });

    /* Delete booking — patch on DB object so we can read record before deletion */
    if (DB && typeof DB.deleteBooking === 'function') {
      patch('deleteBooking', function(orig) {
        return function(id) {
          var bks = DB.getBookings ? DB.getBookings() : [];
          var bk  = null; for (var i=0;i<bks.length;i++){if(bks[i].id===id){bk=bks[i];break;}}
          orig.apply(this, arguments);
          if (bk) actLog({ cat:'booking', action:'Booking Deleted',
            message: 'Deleted booking for "' + bk.guest + '" — Room ' + bk.room,
            detail: { Room:bk.room, Guest:bk.guest, 'Check-In':bk.checkin, 'Check-Out':bk.checkout } });
        };
      }, DB);
    }

    /* Create / update guest profile */
    patch('saveGuest', function(orig) {
      return function() {
        var edit = !!window.editGuestId;
        var name = ((document.getElementById('gp-name')||{}).value||'').trim().toUpperCase();
        orig.apply(this, arguments);
        actLog({ cat:'guest', action: edit ? 'Guest Profile Updated' : 'Guest Profile Created',
          message: (edit?'Updated':'Created') + ' guest profile for "' + name + '"',
          detail: { Guest:name } });
      };
    });

    /* FO officers */
    patch('addFOOfficer', function(orig) {
      return function() {
        var name = ((document.getElementById('fo-new-name')||{}).value||'').trim();
        orig.apply(this, arguments);
        if (name) actLog({ cat:'account', action:'FO Officer Added', message:'Added FO officer "' + name + '"', detail:{Name:name} });
      };
    });

    patch('deleteFOOfficer', function(orig) {
      return function(idx) {
        var list = typeof window.loadFOOfficers === 'function' ? window.loadFOOfficers() : [];
        var o = list[idx] || null;
        orig.apply(this, arguments);
        if (o && !o.isDefault) actLog({ cat:'account', action:'FO Officer Removed', message:'Removed FO officer "' + o.name + '"', detail:{Name:o.name} });
      };
    });

    /* Backup / restore */
    patchSimple('exportBackup', 'system', 'Backup Exported', 'Exported reservations backup');
    patch('processImport', function(orig) {
      return function(text, source) { orig.apply(this, arguments);
        actLog({ cat:'system', action:'Backup Restored', message:'Restored reservations from backup (' + (source||'file') + ')' }); };
    });
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — STAFFING
  ══════════════════════════════════════════════════════ */
  function hookStaffing() {

    patch('saveSchedule', function(orig) {
      return function() {
        var staffId = (document.getElementById('f-staff')||{}).value || '';
        var staff   = typeof window.loadStaff === 'function' ? window.loadStaff() : [];
        var member  = null; for (var i=0;i<staff.length;i++){if(staff[i].id===staffId){member=staff[i];break;}}
        var name    = member ? member.name : staffId;
        var wk      = typeof window.weekKey === 'function' ? window.weekKey() : '?';
        orig.apply(this, arguments);
        actLog({ cat:'staff', action:'Schedule Saved',
          message:'Saved week ' + wk + ' schedule for "' + name + '"',
          detail:{ Staff:name, Week:wk } });
      };
    });

    /* Delete individual schedule entry */
    patch('deleteSchedule', function(orig) {
      return function() {
        var staffId = window.editStaffId;
        var staff   = typeof window.loadStaff === 'function' ? window.loadStaff() : [];
        var member  = null; for (var i=0;i<staff.length;i++){if(staff[i].id===staffId){member=staff[i];break;}}
        var wk      = typeof window.weekKey === 'function' ? window.weekKey() : '?';
        orig.apply(this, arguments);
        actLog({ cat:'staff', action:'Schedule Cleared',
          message:'Cleared week ' + wk + ' for "' + (member?member.name:staffId||'?') + '"',
          detail:{ Staff:member?member.name:staffId, Week:wk } });
      };
    });

    patch('applyQuickAssign', function(orig) {
      return function() {
        var dayEls  = document.querySelectorAll('.day-chk input:checked');
        var days    = []; for (var i=0;i<dayEls.length;i++) days.push(dayEls[i].dataset.day);
        var staffId = (document.getElementById('q-staff')||{}).value || 'ALL';
        var shift   = window.qShift || '?';
        var wk      = typeof window.weekKey === 'function' ? window.weekKey() : '?';
        orig.apply(this, arguments);
        actLog({ cat:'staff', action:'Quick Assign Applied',
          message:'Applied "' + shift + '" to ' + (staffId==='ALL'?'all staff':'"'+staffId+'"') + ' on ' + (days.join(', ')||'—'),
          detail:{ Shift:shift, Days:days.join(', ')||'—', Staff:staffId, Week:wk } });
      };
    });

    patch('saveStaffMember', function(orig) {
      return function() {
        var edit = !!window.editStaffMemberId;
        var name = ((document.getElementById('se-name')    ||{}).value||'').trim();
        var pos  = (document.getElementById('se-position') ||{}).value || '';
        orig.apply(this, arguments);
        actLog({ cat:'staff', action: edit ? 'Staff Updated' : 'Staff Added',
          message:(edit?'Updated':'Added') + ' "' + name + '" — ' + pos,
          detail:{ Name:name, Position:pos } });
      };
    });

    /* Delete from modal */
    patch('deleteStaff', function(orig) {
      return function() {
        var staff  = typeof window.loadStaff === 'function' ? window.loadStaff() : [];
        var member = null; for (var i=0;i<staff.length;i++){if(staff[i].id===window.editStaffMemberId){member=staff[i];break;}}
        orig.apply(this, arguments);
        if (member) actLog({ cat:'staff', action:'Staff Deleted',
          message:'Removed "' + member.name + '" — ' + member.position,
          detail:{ Name:member.name, Position:member.position } });
      };
    });

    /* Delete from directory list (quick delete button) */
    patch('quickDeleteStaff', function(orig) {
      return function(staffId) {
        var staff  = typeof window.loadStaff === 'function' ? window.loadStaff() : [];
        var member = null; for (var i=0;i<staff.length;i++){if(staff[i].id===staffId){member=staff[i];break;}}
        orig.apply(this, arguments);
        if (member) actLog({ cat:'staff', action:'Staff Deleted',
          message:'Removed "' + member.name + '" — ' + member.position,
          detail:{ Name:member.name, Position:member.position } });
      };
    });

    patch('savePosition', function(orig) {
      return function() {
        var edit  = (window.editPositionIdx !== null && window.editPositionIdx !== undefined);
        var name  = ((document.getElementById('pos-name')||{}).value||'').trim();
        var allP  = typeof window.loadPositions === 'function' ? window.loadPositions() : [];
        var old   = edit ? allP[window.editPositionIdx] : null;
        orig.apply(this, arguments);
        actLog({ cat:'staff', action: edit ? 'Position Renamed' : 'Position Added',
          message: edit ? 'Renamed "' + old + '" → "' + name + '"' : 'Added position "' + name + '"',
          detail: edit ? { From:old, To:name } : { Position:name } });
      };
    });

    patch('confirmDeletePosition', function(orig) {
      return function(idx) {
        var allP = typeof window.loadPositions === 'function' ? window.loadPositions() : [];
        var pos  = allP[idx] || '?';
        orig.apply(this, arguments);
        actLog({ cat:'staff', action:'Position Deleted', message:'Deleted position "' + pos + '"', detail:{ Position:pos } });
      };
    });

    patch('saveSignatories', function(orig) {
      return function() { orig.apply(this, arguments);
        actLog({ cat:'staff', action:'Signatories Saved', message:'Updated roster signatories' }); };
    });

    patchSimple('copyFromPrevWeek', 'staff', 'Schedule Copied',  'Copied last week\'s schedule to this week');
    patchSimple('clearWeek',        'staff', 'Schedule Cleared', 'Cleared all shifts for this week');
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — REVENUE
  ══════════════════════════════════════════════════════ */
  function hookRevenue() {

    patch('saveEntry', function(orig) {
      return function() {
        var edit   = !!window.editEntryId;
        var guest  = ((document.getElementById('f-guest') ||{}).value||'').trim().toUpperCase();
        var amount = (document.getElementById('f-amount')||{}).value || '0';
        var net    = (document.getElementById('f-net')   ||{}).value || '0';
        var pay    = (document.getElementById('f-pay')   ||{}).value || '';
        var rooms  = (document.getElementById('f-rooms') ||{}).value || '';
        orig.apply(this, arguments);
        actLog({ cat:'revenue', action: edit ? 'Entry Updated' : 'Entry Added',
          message:(edit?'Updated':'Added') + ' entry for "' + guest + '" — ₱' + Number(net).toLocaleString('en-PH') + ' net (' + pay + ')',
          detail:{ Guest:guest, Gross:'₱'+Number(amount).toLocaleString('en-PH'), Net:'₱'+Number(net).toLocaleString('en-PH'), Payment:pay, Rooms:rooms||undefined } });
      };
    });

    patch('deleteEntry', function(orig) {
      return function() {
        var dateStr = typeof window.fmtDate === 'function' ? window.fmtDate(window.dailyDate || new Date()) : '';
        var entries = typeof window.getEntriesForDate === 'function' ? window.getEntriesForDate(dateStr) : [];
        var e = null; for (var i=0;i<entries.length;i++){if(entries[i].id===window.editEntryId){e=entries[i];break;}}
        orig.apply(this, arguments);
        if (e) actLog({ cat:'revenue', action:'Entry Deleted',
          message:'Deleted entry for "' + e.guest + '" — ₱' + Number(e.net||0).toLocaleString('en-PH') + ' net',
          detail:{ Guest:e.guest, Net:'₱'+Number(e.net||0).toLocaleString('en-PH'), Date:dateStr } });
      };
    });

    patch('bsPrint', function(orig) {
      return function() {
        var stmt   = (document.getElementById('bs-stmt-num')   ||{}).value || '?';
        var billed = ((document.getElementById('bs-billed-to') ||{}).value||'').trim();
        orig.apply(this, arguments);
        actLog({ cat:'revenue', action:'Billing Statement Printed',
          message:'Printed billing statement ' + stmt + ' for "' + billed + '"',
          detail:{ Statement:stmt, 'Billed To':billed } });
      };
    });

    patch('bsSaveDraft', function(orig) {
      return function() {
        var stmt   = (document.getElementById('bs-stmt-num')   ||{}).value || '?';
        var billed = ((document.getElementById('bs-billed-to') ||{}).value||'').trim();
        orig.apply(this, arguments);
        actLog({ cat:'revenue', action:'Billing Draft Saved',
          message:'Saved billing draft ' + stmt + (billed?' for "'+billed+'"':''),
          detail:{ Statement:stmt, 'Billed To':billed||undefined } });
      };
    });

    patchSimple('exportFullBackup', 'system', 'Revenue Backup Exported', 'Exported full revenue data backup');
    patchSimple('clearRevenueData', 'system', 'Revenue Data Cleared',    'Cleared ALL revenue data');

    patch('restoreFullBackup', function(orig) {
      return function() { orig.apply(this, arguments);
        actLog({ cat:'system', action:'Revenue Backup Restored', message:'Restored revenue data from backup file' }); };
    });

    patch('mergeDailyEntries', function(orig) {
      return function() { orig.apply(this, arguments);
        actLog({ cat:'system', action:'Revenue Data Merged', message:'Merged daily entries from backup file' }); };
    });
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — EVENTS
  ══════════════════════════════════════════════════════ */
  function hookEvents() {
    var DB = window.HirayaDB;

    patch('saveEvent', function(orig) {
      return function() {
        var edit   = !!window.editId;
        var title  = ((document.getElementById('f-title') ||{}).value||'').trim().toUpperCase();
        var type   = (document.getElementById('f-type')   ||{}).value || '';
        var venue  = (document.getElementById('f-venue')  ||{}).value || '';
        var date   = (document.getElementById('f-date')   ||{}).value || '';
        var ts     = (document.getElementById('f-ts')     ||{}).value || '';
        var te     = (document.getElementById('f-te')     ||{}).value || '';
        var pax    = (document.getElementById('f-pax')    ||{}).value || '0';
        var rate   = (document.getElementById('f-rate')   ||{}).value || '0';
        var tLabel = (DB && DB.EVENT_LABELS && DB.EVENT_LABELS[type]) || type;
        orig.apply(this, arguments);
        /* Only log if modal actually closed = save succeeded */
        var modal = document.getElementById('evModal');
        if (modal && modal.classList.contains('open')) return;
        actLog({ cat:'event', action: edit ? 'Event Updated' : 'Event Created',
          message:(edit?'Updated':'Created') + ' event "' + title + '" at ' + (venue||'—'),
          detail:{ Title:title, Type:tLabel||type, Venue:venue, Date:date,
            Time: ts&&te ? ts+' – '+te : (ts||undefined),
            PAX:  pax!=='0' ? pax : undefined,
            Rate: rate!=='0' ? '₱'+Number(rate).toLocaleString('en-PH') : undefined } });
      };
    });

    patch('deleteEvent', function(orig) {
      return function() {
        var id  = window.editId;
        var evs = DB && DB.getEvents ? DB.getEvents() : [];
        var ev  = null; for (var i=0;i<evs.length;i++){if(evs[i].id===id){ev=evs[i];break;}}
        orig.apply(this, arguments);
        if (ev) actLog({ cat:'event', action:'Event Deleted',
          message:'Deleted event "' + ev.title + '" at ' + (ev.venue||'—') + ' on ' + (ev.date||'—'),
          detail:{ Title:ev.title, Venue:ev.venue||undefined, Date:ev.date||undefined } });
      };
    });
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — INVENTORY
  ══════════════════════════════════════════════════════ */
  function hookInventory() {

    function catLabel(catId) {
      var cats = typeof window.CATEGORIES !== 'undefined' ? window.CATEGORIES : [];
      for (var i=0;i<cats.length;i++) { if (cats[i].id===catId) return cats[i].label; }
      return catId;
    }

    /* Add / update item */
    patch('saveItem', function(orig) {
      return function() {
        var edit     = !!window.editItemId;
        var name     = ((document.getElementById('m-name')    ||{}).value||'').trim().toUpperCase();
        var catId    = (document.getElementById('m-cat')      ||{}).value || window.editCat || '';
        var stock    = (document.getElementById('m-stock')    ||{}).value || '0';
        var unit     = (document.getElementById('m-unit')     ||{}).value || 'pcs';
        var reorder  = (document.getElementById('m-reorder')  ||{}).value || '0';
        var supplier = ((document.getElementById('m-supplier') ||{}).value||'').trim();
        orig.apply(this, arguments);
        /* Only log if modal closed = save succeeded */
        var modal = document.getElementById('invModal');
        if (modal && modal.classList.contains('open')) return;
        actLog({ cat:'inventory', action: edit ? 'Item Updated' : 'Item Added',
          message:(edit?'Updated':'Added') + ' "' + name + '" in ' + catLabel(catId),
          detail:{ Item:name, Category:catLabel(catId), Stock:stock+' '+unit,
            Reorder:reorder!=='0'?reorder:undefined, Supplier:supplier||undefined } });
      };
    });

    /* Quick ± stepper */
    patch('quickStep', function(orig) {
      return function(catId, itemId, field, delta) {
        var items = typeof window.loadAll === 'function' ? (window.loadAll()[catId]||[]) : [];
        var item  = null; for (var i=0;i<items.length;i++){if(items[i].id===itemId){item=items[i];break;}}
        orig.apply(this, arguments);
        if (item) {
          var newVal = Math.max(0, (item[field]||0) + delta);
          actLog({ cat:'inventory', action:'Stock Adjusted',
            message:'"' + item.name + '" ' + (field==='stock'?'Stock':'In-use') + ' ' + (delta>0?'+':'') + delta + ' → ' + newVal,
            detail:{ Item:item.name, Category:catLabel(catId), Field:field, Change:(delta>0?'+':'')+delta, New:newVal } });
        }
      };
    });

    /* Delete — triggerDelete stores name so showConfirm intercept can log it */
    patch('triggerDelete', function(orig) {
      return function(catId, itemId, name) {
        window._alInvDel = { name:name, cat:catLabel(catId) };
        orig.apply(this, arguments);
      };
    });

    /* Intercept showConfirm to catch the confirmed delete */
    patch('showConfirm', function(orig) {
      return function(title, msg, onOk) {
        orig.apply(this, [title, msg, function() {
          var pending = window._alInvDel;
          if (onOk) onOk.apply(this, arguments);
          if (pending) {
            actLog({ cat:'inventory', action:'Item Deleted',
              message:'Deleted "' + pending.name + '" from ' + pending.cat,
              detail:{ Item:pending.name, Category:pending.cat } });
            window._alInvDel = null;
          }
        }]);
      };
    });

    /* Backup / restore */
    patchSimple('exportBackup', 'system', 'Inventory Backup Exported', 'Exported full inventory backup');
    patch('processImport', function(orig) {
      return function(text, source) { orig.apply(this, arguments);
        actLog({ cat:'system', action:'Inventory Backup Restored', message:'Restored inventory from backup (' + (source||'file') + ')' }); };
    });
  }

  /* ══════════════════════════════════════════════════════
     PAGE HOOKS — ACCOUNTS
     accounts.html calls window.actLog() directly inside
     saveAccount(), toggleActive(), and triggerDelete().
     No patching needed — just ensure actLog is available.
  ══════════════════════════════════════════════════════ */
  function hookAccounts() { /* intentionally empty */ }

  /* ══════════════════════════════════════════════════════
     CROSS-TAB SYNC
  ══════════════════════════════════════════════════════ */
  window.addEventListener('storage',         function(e){ if (e.key === STORE_KEY) render(); });
  window.addEventListener('hiraya:activity', function()  { render(); });

  /* ══════════════════════════════════════════════════════
     EXPOSE GLOBALS
  ══════════════════════════════════════════════════════ */
  window.actLog       = actLog;
  window.actRender    = render;
  window.actExportCSV = actExportCSV;
  window._alF         = setFilter;   /* used by filter button onclick */
  window._alCl        = alClear;    /* used by clear button onclick  */

  /* ══════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════ */
  function init() {
    injectCSS();

    var page = window.HIRAYA_PAGE || '';
    switch (page) {
      case 'index':        hookIndex();        break;
      case 'reservations': hookReservations(); break;
      case 'staffing':     hookStaffing();     break;
      case 'revenue':      hookRevenue();      break;
      case 'events':       hookEvents();       break;
      case 'inventory':    hookInventory();    break;
      case 'accounts':     hookAccounts();     break;
    }

    logAuth();

    var mount = document.getElementById('hms-activity-log-mount');
    if (mount) buildPanel(mount);

    render();
    setInterval(render, 60000); /* refresh relative timestamps */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  } else {
    setTimeout(init, 0); /* wait one tick so page scripts finish first */
  }

}());