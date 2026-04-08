// sidebar.js
/**
 * Hiraya HMS — Shared Sidebar, Theme Engine & Loading System
 * ─────────────────────────────────────────────────────────────
 * Include on every protected page BEFORE closing </body>.
 * Requirements per page:
 *   1. <div id="hms-sidebar"></div>
 *   2. <div id="hms-main"> wrapping all page content
 *   3. window.HIRAYA_PAGE = 'pageName'  (set BEFORE this script)
 */

(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════
     ROLE-BASED ACCESS CONTROL
  ════════════════════════════════════════════════════════ */

  // Role definitions — ordered by privilege level
  const ROLES = {
    superadmin: { label: 'Super Admin',    level: 3 },
    admin:      { label: 'Admin',          level: 2 },
    fo:         { label: 'Front Office',   level: 1 },
  };

  // Page access map: which roles can visit each page
  // 'ro' = read-only (page loads but write actions are hidden/disabled)
  const PAGE_ACCESS = {
    index:        ['superadmin', 'admin', 'fo'],
    reservations: ['superadmin', 'admin', 'fo'],
    revenue:      ['superadmin', 'admin', 'fo'],   // fo gets read-only
    inventory:    ['superadmin', 'admin'],
    staffing:     ['superadmin', 'admin'],
    events:       ['superadmin', 'admin', 'fo'],   // fo gets read-only
    accounts:     ['superadmin'],
  };

  // Pages where FO gets a degraded / read-only experience
  const FO_READONLY_PAGES = ['revenue', 'events'];

  // ─── Auth Guard ──────────────────────────────────────────────────────────────
  if (!sessionStorage.getItem('hiraya_auth')) {
    window.location.replace('login.html');
    return;
  }

  // ─── Read session ──────────────────────────────────────────────────────────
  const currentRole = sessionStorage.getItem('hiraya_role') || 'fo';
  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('hiraya_user') || '{}'); } catch(e) { return {}; }
  })();
  const roleLevel   = ROLES[currentRole]?.level || 1;

  // Expose globally so pages can read it
  window.HIRAYA_ROLE      = currentRole;
  window.HIRAYA_USER      = currentUser;
  window.HIRAYA_ROLE_META = ROLES[currentRole] || ROLES.fo;

  // ─── Page-level access check ───────────────────────────────────────────────
  const currentPage = window.HIRAYA_PAGE ||
    location.pathname.split('/').pop().replace('.html','') || 'index';

  const allowedRoles = PAGE_ACCESS[currentPage];
  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    // Redirect to the most appropriate accessible page
    window.location.replace('index.html');
    return;
  }

  // Mark if current user has read-only access on this page
  window.HIRAYA_READONLY = FO_READONLY_PAGES.includes(currentPage) && currentRole === 'fo';

  // ─── Helper: can current role do an action ───────────────────────────────
  window.hirayaCan = function(action) {
    const actionMap = {
      // Reservations
      deleteBooking:        ['superadmin', 'admin'],
      manageOfficers:       ['superadmin', 'admin'],
      restoreBackup:        ['superadmin', 'admin'],
      // Revenue
      deleteEntry:          ['superadmin', 'admin'],
      printReport:          ['superadmin', 'admin'],
      exportRevenue:        ['superadmin', 'admin'],
      viewRevenue:          ['superadmin', 'admin', 'fo'],
      // Accounts
      manageAccounts:       ['superadmin'],
      // General
      clearData:            ['superadmin'],
    };
    const allowed = actionMap[action];
    if (!allowed) return true; // unknown action = allow by default
    return allowed.includes(currentRole);
  };

  // ─── Nav Items ───────────────────────────────────────────────────────────────
  const NAV_ITEMS_ALL = [
    {
      id: 'index', label: 'Property Overview', href: 'index.html',
      roles: ['superadmin','admin','fo'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
    },
    {
      id: 'reservations', label: 'Reservations', href: 'reservations.html',
      roles: ['superadmin','admin','fo'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>`
    },
    {
      id: 'inventory', label: 'Inventory', href: 'inventory.html',
      roles: ['superadmin','admin'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`
    },
    {
      id: 'revenue', label: 'Revenue & Reports', href: 'revenue.html',
      roles: ['superadmin','admin','fo'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
    },
    {
      id: 'staffing', label: 'Staffing', href: 'staffing.html',
      roles: ['superadmin','admin'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
    {
      id: 'events', label: 'Events', href: 'events.html',
      roles: ['superadmin','admin','fo'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    {
      id: 'accounts', label: 'Account Management', href: 'accounts.html',
      roles: ['superadmin'],
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>`
    },
  ];

  // Filter nav items to only those the current role can access
  const NAV_ITEMS = NAV_ITEMS_ALL.filter(item =>
    !item.roles || item.roles.includes(currentRole)
  );

  // ─── Theme Token Maps ─────────────────────────────────────────────────────────
  const THEMES = {
    dark: {
      '--h-red':        '#C0272D',
      '--h-red-dk':     '#961E23',
      '--h-dark':       '#141416',
      '--h-panel':      '#1C1C1F',
      '--h-panel2':     '#212125',
      '--h-border':     '#2A2A2E',
      '--h-muted':      '#5A5A62',
      '--h-text':       '#E8E8EC',
      '--h-sub':        '#9898A4',
      '--h-topbar-bg':  'rgba(28,28,31,0.92)',
      '--h-loader-bg':  '#141416',
      '--h-input-bg':   'rgba(255,255,255,0.04)',
      '--h-hover-bg':   'rgba(255,255,255,0.04)',
      '--h-active-bg':  'rgba(192,39,45,0.12)',
      '--h-shadow':     '0 8px 32px rgba(0,0,0,0.45)',
      '--h-card-hover': '0 12px 32px rgba(0,0,0,0.5)',
    },
    light: {
      '--h-red':        '#C0272D',
      '--h-red-dk':     '#961E23',
      '--h-dark':       '#F0F0F4',
      '--h-panel':      '#FFFFFF',
      '--h-panel2':     '#F7F7FA',
      '--h-border':     '#E2E2EB',
      '--h-muted':      '#8888A0',
      '--h-text':       '#18181F',
      '--h-sub':        '#50506A',
      '--h-topbar-bg':  'rgba(255,255,255,0.92)',
      '--h-loader-bg':  '#F0F0F4',
      '--h-input-bg':   'rgba(0,0,0,0.03)',
      '--h-hover-bg':   'rgba(0,0,0,0.04)',
      '--h-active-bg':  'rgba(192,39,45,0.07)',
      '--h-shadow':     '0 8px 32px rgba(0,0,0,0.09)',
      '--h-card-hover': '0 12px 32px rgba(0,0,0,0.12)',
    }
  };

  const ICON_SUN  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const ICON_MOON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const savedTheme = localStorage.getItem('hiraya_theme') || 'dark';

  // ─── Role badge colors ────────────────────────────────────────────────────────
  const ROLE_COLORS = {
    superadmin: { bg: 'rgba(155,89,182,.18)', color: '#9b59b6', border: 'rgba(155,89,182,.35)' },
    admin:      { bg: 'rgba(52,152,219,.14)', color: '#3498db', border: 'rgba(52,152,219,.35)' },
    fo:         { bg: 'rgba(46,204,113,.13)', color: '#2ecc71', border: 'rgba(46,204,113,.35)' },
  };
  const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin', fo: 'Front Office' };

  // ─── Inject Global CSS ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --h-red:       #C0272D;
      --h-red-dk:    #961E23;
      --h-dark:      #141416;
      --h-panel:     #1C1C1F;
      --h-panel2:    #212125;
      --h-border:    #2A2A2E;
      --h-muted:     #5A5A62;
      --h-text:      #E8E8EC;
      --h-sub:       #9898A4;
      --h-topbar-bg: rgba(28,28,31,0.92);
      --h-loader-bg: #141416;
      --h-input-bg:  rgba(255,255,255,0.04);
      --h-hover-bg:  rgba(255,255,255,0.04);
      --h-active-bg: rgba(192,39,45,0.12);
      --h-shadow:    0 8px 32px rgba(0,0,0,0.45);
      --sidebar-w:   240px;
    }

    html { transition: background-color 0.28s ease; }
    body, #hms-sidebar, .hms-topbar, .stat-card, .room-card, .modal-card,
    .form-select, .form-input, .sb-item, .theme-pill, .theme-pill-btn {
      transition:
        background-color 0.28s ease,
        border-color 0.28s ease,
        color 0.28s ease,
        box-shadow 0.28s ease !important;
    }
    .hms-loader-bar { transition: width 0.05s linear !important; }
    svg * { transition: none !important; }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--h-dark);
      color: var(--h-text);
      margin: 0;
      display: flex;
      min-height: 100vh;
    }

    /* ══ SIDEBAR ══════════════════════════════════════════════ */
    #hms-sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--h-panel);
      border-right: 1px solid var(--h-border);
      display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; z-index: 100;
    }

    .sb-brand {
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--h-border);
      display: flex; align-items: center; gap: 12px;
    }
    .sb-emblem {
      width: 36px; height: 36px;
      background: var(--h-red); border-radius: 2px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; position: relative; overflow: hidden;
      box-shadow: 0 2px 12px rgba(192,39,45,0.35);
    }
    .sb-emblem::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    }
    .sb-emblem svg { position: relative; z-index: 1; }
    .sb-brand-name {
      font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700;
      letter-spacing: 0.08em; color: var(--h-text);
    }
    .sb-brand-sub {
      font-size: 9px; font-weight: 500; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--h-muted); margin-top: 3px;
    }

    /* ── Logged-in user strip ── */
    .sb-user-strip {
      padding: 10px 14px;
      border-bottom: 1px solid var(--h-border);
      background: rgba(192,39,45,.04);
      display: flex; align-items: center; gap: 9px;
    }
    .sb-user-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; flex-shrink: 0;
      font-family: 'DM Sans', sans-serif;
    }
    .sb-user-name  { font-size: 11px; font-weight: 600; color: var(--h-text); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sb-user-role  {
      font-size: 8px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
      padding: 1px 6px; border-radius: 2px; margin-top: 2px; display: inline-block;
    }

    .sb-section-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; color: var(--h-muted); padding: 16px 20px 6px;
    }
    .sb-nav { flex: 1; padding: 4px 0; overflow-y: auto; }
    .sb-item {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 20px; font-size: 13px; font-weight: 500;
      color: var(--h-sub); text-decoration: none; cursor: pointer;
      border-left: 2px solid transparent; margin: 1px 0;
    }
    .sb-item:hover { color: var(--h-text); background: var(--h-hover-bg); }
    .sb-item.active {
      color: var(--h-text); background: var(--h-active-bg);
      border-left-color: var(--h-red); font-weight: 600;
    }
    .sb-item.active .sb-icon { color: var(--h-red); }
    .sb-item.sb-item-accounts {
      color: #9b59b6;
    }
    .sb-item.sb-item-accounts:hover { background: rgba(155,89,182,.08); color: #b880ff; }
    .sb-item.sb-item-accounts.active { border-left-color: #9b59b6; background: rgba(155,89,182,.1); }
    .sb-icon { flex-shrink: 0; }
    .sb-divider { height: 1px; background: var(--h-border); margin: 8px 20px; }

    /* Read-only banner */
    .sb-readonly-banner {
      margin: 8px 12px; padding: 7px 10px;
      background: rgba(243,156,18,.08); border: 1px solid rgba(243,156,18,.2);
      border-radius: 3px; font-size: 9px; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; color: #f39c12;
      display: flex; align-items: center; gap:6px;
    }

    /* ── Theme Pill ── */
    .sb-theme-wrap { padding: 0 20px 14px; }
    .sb-theme-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--h-muted); margin-bottom: 8px; display: block;
    }
    .theme-pill {
      display: flex; gap: 3px; padding: 3px;
      background: var(--h-panel2); border: 1px solid var(--h-border); border-radius: 3px;
    }
    .theme-pill-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 7px 0; font-family: 'DM Sans', sans-serif;
      font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
      border: none; border-radius: 2px; cursor: pointer;
      color: var(--h-muted); background: transparent;
    }
    .theme-pill-btn.active-pill {
      background: var(--h-red); color: #fff;
      box-shadow: 0 2px 8px rgba(192,39,45,0.3);
    }
    .theme-pill-btn:not(.active-pill):hover {
      background: var(--h-hover-bg); color: var(--h-text);
    }

    .sb-footer { padding: 14px 20px; border-top: 1px solid var(--h-border); }
    .sb-date { font-size: 11px; color: var(--h-muted); margin-bottom: 12px; letter-spacing: 0.04em; }
    .sb-logout {
      display: flex; align-items: center; gap: 9px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--h-muted); cursor: pointer; padding: 8px 0;
      background: none; border: none; font-family: 'DM Sans', sans-serif;
    }
    .sb-logout:hover { color: #e55a5a; }

    /* ══ MAIN AREA ════════════════════════════════════════════ */
    #hms-main {
      margin-left: var(--sidebar-w); flex: 1;
      display: flex; flex-direction: column; min-height: 100vh;
      background: var(--h-dark);
    }

    /* ── Topbar ── */
    .hms-topbar {
      height: 56px; border-bottom: 1px solid var(--h-border);
      display: flex; align-items: center; padding: 0 28px; gap: 16px;
      position: sticky; top: 0; background: var(--h-topbar-bg);
      backdrop-filter: blur(12px); z-index: 50;
    }
    .topbar-page-title {
      font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 0.1em;
      color: var(--h-text); font-weight: 600;
    }
    .topbar-sep { width: 1px; height: 16px; background: var(--h-border); }
    .topbar-breadcrumb { font-size: 12px; color: var(--h-muted); letter-spacing: 0.04em; }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
    .topbar-clock {
      font-size: 12px; font-weight: 600; letter-spacing: 0.1em;
      color: var(--h-muted); font-variant-numeric: tabular-nums;
    }
    .topbar-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--h-muted); }
    .topbar-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #2ecc71; box-shadow: 0 0 6px rgba(46,204,113,0.5);
      animation: topDotBlink 2.5s ease-in-out infinite;
    }
    @keyframes topDotBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* Role chip in topbar */
    .topbar-role-chip {
      font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
      padding: 3px 8px; border-radius: 2px;
    }

    #hms-theme-toggle {
      width: 32px; height: 32px; border-radius: 3px;
      border: 1px solid var(--h-border); background: var(--h-input-bg);
      color: var(--h-sub); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #hms-theme-toggle:hover {
      background: var(--h-active-bg); border-color: var(--h-red); color: var(--h-red);
    }

    /* ── Page content ── */
    .hms-content { flex: 1; padding: 28px; }

    /* ══ LOADER ═══════════════════════════════════════════════ */
    #hms-loader {
      position: fixed; inset: 0; z-index: 9999;
      background: var(--h-loader-bg);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 20px;
      pointer-events: none; opacity: 0; transition: opacity 0.3s ease !important;
    }
    #hms-loader.active { opacity: 1; pointer-events: all; }
    .hms-loader-bar-wrap { width: 200px; height: 2px; background: var(--h-border); border-radius: 2px; overflow: hidden; }
    .hms-loader-bar { height: 100%; background: var(--h-red); border-radius: 2px; width: 0%; }
    .hms-loader-label {
      font-family: 'Cinzel', serif; font-size: 11px;
      letter-spacing: 0.2em; color: var(--h-muted); text-transform: uppercase;
    }
    .hms-loader-emblem {
      width: 40px; height: 40px; background: var(--h-red); border-radius: 2px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 8px; box-shadow: 0 0 24px rgba(192,39,45,0.35);
    }

    /* ══ MOBILE ═══════════════════════════════════════════════ */
    #hms-mob-toggle {
      display: none; position: fixed; top: 14px; left: 14px; z-index: 200;
      background: var(--h-red); border: none; border-radius: 2px;
      width: 36px; height: 36px; cursor: pointer;
      align-items: center; justify-content: center; color: #fff;
    }
    @media (max-width: 768px) {
      #hms-sidebar { transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
      #hms-sidebar.open { transform: translateX(0); }
      #hms-main { margin-left: 0; }
      #hms-mob-toggle { display: flex; }
    }
  `;
  document.head.appendChild(style);

  // ─── Google Fonts ─────────────────────────────────────────────────────────────
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap';
    document.head.prepend(font);
  }

  const activeItem = NAV_ITEMS.find(n => n.id === currentPage) || NAV_ITEMS[0];
  const roleColor  = ROLE_COLORS[currentRole] || ROLE_COLORS.fo;
  const roleLabel  = ROLE_LABELS[currentRole] || currentRole;

  // User initials for avatar
  const userName    = currentUser.name || currentRole;
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  // ─── Build Sidebar HTML ───────────────────────────────────────────────────────
  const sidebarEl = document.getElementById('hms-sidebar');
  if (!sidebarEl) { console.warn('[Hiraya HMS] No #hms-sidebar found.'); return; }

  sidebarEl.innerHTML = `
    <div class="sb-brand">
      <div class="sb-emblem">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="4" width="5" height="20" fill="white"/>
          <rect x="4" y="11" width="20" height="6" fill="white"/>
          <rect x="19" y="4" width="5" height="20" fill="white"/>
        </svg>
      </div>
      <div>
        <div class="sb-brand-name">DEMO</div>
        <div class="sb-brand-sub">HMS Admin Terminal</div>
      </div>
    </div>

    <!-- Logged-in user strip -->
    <div class="sb-user-strip">
      <div class="sb-user-avatar" style="background:${roleColor.bg};color:${roleColor.color};border:1px solid ${roleColor.border};">
        ${userInitials}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="sb-user-name">${userName}</div>
        <span class="sb-user-role" style="background:${roleColor.bg};color:${roleColor.color};border:1px solid ${roleColor.border};">${roleLabel}</span>
      </div>
    </div>

    ${window.HIRAYA_READONLY ? `
    <div class="sb-readonly-banner">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      View Only Access
    </div>` : ''}

    <nav class="sb-nav">
      <div class="sb-section-label">Navigation</div>
      ${NAV_ITEMS.map(item => `
        <a class="sb-item${item.id === currentPage ? ' active' : ''}${item.id === 'accounts' ? ' sb-item-accounts' : ''}"
           href="${item.href}" data-page="${item.id}">
          <span class="sb-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
      <div class="sb-divider"></div>
    </nav>

    <div class="sb-theme-wrap">
      <span class="sb-theme-label">Appearance</span>
      <div class="theme-pill" role="group" aria-label="Theme selector">
        <button class="theme-pill-btn" id="pill-dark"
                onclick="window.hirayaSetTheme('dark')" title="Dark Mode">
          ${ICON_MOON} Dark
        </button>
        <button class="theme-pill-btn" id="pill-light"
                onclick="window.hirayaSetTheme('light')" title="Light Mode">
          ${ICON_SUN} Light
        </button>
      </div>
    </div>

    <div class="sb-footer">
      <div class="sb-date" id="sb-date-display"></div>
      <button class="sb-logout" id="hms-logout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>
  `;

  // ─── Theme Engine ─────────────────────────────────────────────────────────────
  function applyTheme(mode) {
    const tokens = THEMES[mode] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', mode);
    localStorage.setItem('hiraya_theme', mode);
    const pd = document.getElementById('pill-dark');
    const pl = document.getElementById('pill-light');
    if (pd) pd.classList.toggle('active-pill', mode === 'dark');
    if (pl) pl.classList.toggle('active-pill', mode === 'light');
    const tb = document.getElementById('hms-theme-toggle');
    if (tb) tb.innerHTML = mode === 'dark' ? ICON_SUN : ICON_MOON;
  }

  window.hirayaSetTheme = function(mode) { applyTheme(mode); };
  applyTheme(savedTheme);

  // ─── Loader ───────────────────────────────────────────────────────────────────
  let loaderEl = document.getElementById('hms-loader');
  if (!loaderEl) {
    loaderEl = document.createElement('div');
    loaderEl.id = 'hms-loader';
    loaderEl.innerHTML = `
      <div class="hms-loader-emblem">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="4" width="5" height="20" fill="white"/>
          <rect x="4" y="11" width="20" height="6" fill="white"/>
          <rect x="19" y="4" width="5" height="20" fill="white"/>
        </svg>
      </div>
      <div class="hms-loader-bar-wrap">
        <div class="hms-loader-bar" id="hms-loader-bar"></div>
      </div>
      <div class="hms-loader-label">Loading Module</div>
    `;
    document.body.appendChild(loaderEl);
  }

  // ─── Mobile toggle ────────────────────────────────────────────────────────────
  let mobToggle = document.getElementById('hms-mob-toggle');
  if (!mobToggle) {
    mobToggle = document.createElement('button');
    mobToggle.id = 'hms-mob-toggle';
    mobToggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
    document.body.appendChild(mobToggle);
    mobToggle.addEventListener('click', () => sidebarEl.classList.toggle('open'));
  }

  // ─── Navigation with loader ───────────────────────────────────────────────────
  function navigateTo(href) {
    const bar = document.getElementById('hms-loader-bar');
    loaderEl.classList.add('active');
    let progress = 0;
    const iv = setInterval(() => {
      progress += Math.random() * 18 + 8;
      if (progress >= 90) { progress = 90; clearInterval(iv); }
      bar.style.width = progress + '%';
    }, 80);
    setTimeout(() => {
      bar.style.width = '100%';
      setTimeout(() => { window.location.href = href; }, 200);
    }, 700);
  }

  document.querySelectorAll('.sb-item[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href && href !== location.pathname.split('/').pop()) {
        e.preventDefault();
        navigateTo(href);
      }
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────────
  document.getElementById('hms-logout').addEventListener('click', () => {
    sessionStorage.removeItem('hiraya_auth');
    sessionStorage.removeItem('hiraya_role');
    sessionStorage.removeItem('hiraya_user');
    navigateTo('login.html');
  });

  // ─── Live clock ───────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const el = document.getElementById('sb-date-display');
    if (el) el.textContent = now.toLocaleDateString('en-PH', {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
    const cl = document.getElementById('hms-topbar-clock');
    if (cl) cl.textContent = now.toLocaleTimeString('en-PH', {
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ─── Topbar helper ────────────────────────────────────────────────────────────
  window.hirayaRenderTopbar = function(title, breadcrumb) {
    const main = document.getElementById('hms-main');
    if (!main) return;
    const existing = document.getElementById('hms-topbar');
    if (existing) existing.remove();

    const curTheme = localStorage.getItem('hiraya_theme') || 'dark';
    const bar = document.createElement('div');
    bar.className = 'hms-topbar';
    bar.id = 'hms-topbar';
    bar.innerHTML = `
      <span class="topbar-page-title">${title || activeItem?.label || ''}</span>
      <div class="topbar-sep"></div>
      <span class="topbar-breadcrumb">${breadcrumb || 'Hiraya HMS'}</span>
      <div class="topbar-right">
        <span class="topbar-clock" id="hms-topbar-clock"></span>
        <!-- Role chip -->
        <span class="topbar-role-chip" style="background:${roleColor.bg};color:${roleColor.color};border:1px solid ${roleColor.border};">
          ${roleLabel}
        </span>
        <button id="hms-theme-toggle" title="Toggle Dark / Light Mode">
          ${curTheme === 'dark' ? ICON_SUN : ICON_MOON}
        </button>
        <div class="topbar-status">
          <div class="topbar-dot"></div>
          <span>Live</span>
        </div>
      </div>
    `;
    main.prepend(bar);

    document.getElementById('hms-theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      window.hirayaSetTheme(cur === 'dark' ? 'light' : 'dark');
    });

    updateClock();
  };

  // ─── Apply read-only restrictions after page load ─────────────────────────────
  // Pages declare their own write guards using window.hirayaCan() or window.HIRAYA_READONLY.
  // This hook fires after the page JS runs and hides elements marked with data-requires-role.
  window.addEventListener('load', () => {
    // Hide elements the current role cannot use
    document.querySelectorAll('[data-requires-role]').forEach(el => {
      const req = el.getAttribute('data-requires-role').split(',').map(s => s.trim());
      if (!req.includes(currentRole)) {
        el.style.display = 'none';
      }
    });
    // Disable elements marked as requiring higher privilege
    document.querySelectorAll('[data-min-role]').forEach(el => {
      const minRole = el.getAttribute('data-min-role');
      const minLevel = ROLES[minRole]?.level || 1;
      if (roleLevel < minLevel) {
        el.disabled = true;
        el.title = `Requires ${ROLES[minRole]?.label || minRole} or higher`;
        el.style.opacity = '0.4';
        el.style.cursor  = 'not-allowed';
      }
    });
  });

  // ─── Fade-in on load ──────────────────────────────────────────────────────────
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';
  window.addEventListener('load', () => {
    setTimeout(() => { document.body.style.opacity = '1'; }, 50);
  });

})();
