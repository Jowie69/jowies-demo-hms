// hiraya-db.js
/**
 * Hiraya HMS — Core Data Layer  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all HMS data.
 * All reads/writes go through this module.
 * Cross-tab sync via native "storage" event + same-page via CustomEvent.
 *
 * Public API exposed on window.HirayaDB
 */

window.HirayaDB = (function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     STORAGE KEYS
  ═══════════════════════════════════════════════════════════════════════════ */
  const KEY = {
    rooms:    'hiraya_rooms',
    bookings: 'hiraya_bookings',
    events:   'hiraya_events',
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════════════════════════════ */

  /** Generate a collision-resistant UID. */
  function uid() {
    return Date.now().toString(36) + '-' +
           Math.random().toString(36).slice(2, 9) + '-' +
           Math.random().toString(36).slice(2, 6);
  }

  /** Parse a yyyy-mm-dd string to a local midnight Date (no timezone shift). */
  function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Format a Date to yyyy-mm-dd. */
  function fmtDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Parse "HH:MM" to total minutes since midnight. Returns null if invalid. */
  function parseTime(str) {
    if (!str || !/^\d{2}:\d{2}$/.test(str)) return null;
    const [h, m] = str.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  /** Sanitize a string for safe injection into innerHTML. */
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── localStorage wrappers ── */
  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[HirayaDB] Failed to load', key, e);
      return null;
    }
  }

  function persist(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      // Notify same-page listeners
      window.dispatchEvent(new CustomEvent('hiraya:update', { detail: { key } }));
    } catch (e) {
      console.error('[HirayaDB] Failed to persist', key, e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CONSTANTS — ROOMS
  ═══════════════════════════════════════════════════════════════════════════ */
  const ROOM_NUMBERS = [201,202,203,204,205,206,207,208,209,210,211,212,213,214,215];

  const ROOM_META = {
    201: { type: 'Standard Room', catg: 'DS' },
    202: { type: 'Standard Room', catg: 'DS' },
    203: { type: 'Deluxe Room',   catg: 'DK' },
    204: { type: 'Deluxe Room',   catg: 'DK' },
    205: { type: 'Deluxe Room',   catg: 'DK' },
    206: { type: 'Superior Room', catg: 'DK' },
    207: { type: 'Superior Room', catg: 'DS' },
    208: { type: 'Superior Room', catg: 'DS' },
    209: { type: 'Suite',         catg: 'BR' },
    210: { type: 'Suite',         catg: 'JFS'},
    211: { type: 'Standard Room', catg: 'DS' },
    212: { type: 'Standard Room', catg: 'FS' },
    213: { type: 'Deluxe Room',   catg: 'DS' },
    214: { type: 'Deluxe Room',   catg: 'FS' },
    215: { type: 'Family Room',   catg: 'JFS'},
  };

  // Legacy compatibility alias
  const ROOM_TYPES = Object.fromEntries(
    Object.entries(ROOM_META).map(([k, v]) => [k, v.type])
  );

  const ROOM_STATUS = {
    vacant:      { label: 'Vacant',      color: '#2ecc71', bg: 'rgba(46,204,113,0.10)' },
    occupied:    { label: 'Occupied',    color: '#C0272D', bg: 'rgba(192,39,45,0.12)'  },
    reserved:    { label: 'Reserved',    color: '#f39c12', bg: 'rgba(243,156,18,0.10)' },
    cleaning:    { label: 'Cleaning',    color: '#3498db', bg: 'rgba(52,152,219,0.10)' },
    maintenance: { label: 'Maintenance', color: '#e74c3c', bg: 'rgba(231,76,60,0.10)'  },
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CONSTANTS — BOOKINGS
  ═══════════════════════════════════════════════════════════════════════════ */
  const BOOKING_TYPES = {
    'bk-confirmed': { label: 'Confirmed',         color: '#27ae60' },
    'bk-reserved':  { label: 'Reserved / Pending', color: '#f39c12' },
    'bk-blocked':   { label: 'Blocked',            color: '#2980b9' },
    'bk-walkin':    { label: 'Walk-in',            color: '#8e44ad' },
    'bk-comp':      { label: 'Complimentary',      color: '#16a085' },
    'bk-cancelled': { label: 'Cancelled',          color: '#95a5a6' },
  };

  // Legacy flat maps for backward compat
  const BOOKING_COLORS = Object.fromEntries(
    Object.entries(BOOKING_TYPES).map(([k, v]) => [k, v.color])
  );
  const BOOKING_LABELS = Object.fromEntries(
    Object.entries(BOOKING_TYPES).map(([k, v]) => [k, v.label])
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     CONSTANTS — EVENTS
  ═══════════════════════════════════════════════════════════════════════════ */
  const EVENT_TYPES = {
    'ev-wedding':   { label: 'Wedding',    color: '#e91e8c' },
    'ev-birthday':  { label: 'Birthday',   color: '#f39c12' },
    'ev-corporate': { label: 'Corporate',  color: '#2980b9' },
    'ev-seminar':   { label: 'Seminar',    color: '#8e44ad' },
    'ev-debut':     { label: 'Debut',      color: '#e74c3c' },
    'ev-reunion':   { label: 'Reunion',    color: '#16a085' },
    'ev-reception': { label: 'Reception',  color: '#27ae60' },
    'ev-other':     { label: 'Other',      color: '#95a5a6' },
  };

  const EVENT_COLORS = Object.fromEntries(
    Object.entries(EVENT_TYPES).map(([k, v]) => [k, v.color])
  );
  const EVENT_LABELS = Object.fromEntries(
    Object.entries(EVENT_TYPES).map(([k, v]) => [k, v.label])
  );

  const EVENT_VENUES = [
    'Ballroom A', 'Ballroom B', 'Ballroom A & B',
    'Function Hall', 'Garden', 'Pool Area', 'VIP Room', 'Full Venue',
  ];

  /* ═══════════════════════════════════════════════════════════════════════════
     ROOMS
  ═══════════════════════════════════════════════════════════════════════════ */
  function _defaultRooms() {
    const d = {};
    ROOM_NUMBERS.forEach(r => { d[r] = { status: 'vacant', guest: '', notes: '' }; });
    // Seed a couple for demo only when first loaded
    d[203].status = 'occupied'; d[203].guest = 'Maria Santos';
    d[206].status = 'reserved'; d[206].guest = 'Pedro Reyes';
    d[209].status = 'cleaning';
    d[214].status = 'maintenance'; d[214].notes = 'Busted light';
    return d;
  }

  function getRooms() {
    const stored = load(KEY.rooms);
    if (stored !== null) return stored;
    const seed = _defaultRooms();
    try { localStorage.setItem(KEY.rooms, JSON.stringify(seed)); } catch(e) {}
    return seed;
  }

  function setRooms(data) { persist(KEY.rooms, data); }

  function setRoom(num, patch) {
    const rooms = getRooms();
    if (!rooms[num]) return;
    rooms[num] = { ...rooms[num], ...patch };
    setRooms(rooms);
  }

  /**
   * Derive today's live room status from active bookings.
   * Does NOT write to storage — returns a computed map.
   */
  function computeRoomStatuses() {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const bookings = getBookings();
    const manual   = getRooms();
    const result   = {};

    ROOM_NUMBERS.forEach(r => {
      // Start from manual state
      result[r] = { ...manual[r], _source: 'manual' };

      // Find any active booking for today (cin <= today < cout), non-cancelled
      const active = bookings.find(b => {
        if (b.room !== r || b.type === 'bk-cancelled') return false;
        const cin  = parseDate(b.checkin);
        const cout = parseDate(b.checkout);
        return cin <= todayMidnight && todayMidnight < cout;
      });

      if (active) {
        let status = 'occupied';
        if (active.type === 'bk-blocked')  status = 'maintenance';
        if (active.type === 'bk-reserved') status = 'reserved';
        // walkin, confirmed, comp → occupied
        result[r].status  = status;
        result[r].guest   = active.guest || manual[r].guest;
        result[r]._source = 'booking';
        result[r]._bookingId = active.id;
      }

      // Manual cleaning override always wins (housekeeping trumps booking status)
      if (manual[r].status === 'cleaning') {
        result[r].status  = 'cleaning';
        result[r]._source = 'manual';
      }
    });

    return result;
  }


  // Backward-compat alias
  const syncRoomsFromBookings = computeRoomStatuses;

  /* ═══════════════════════════════════════════════════════════════════════════
     BOOKINGS
  ═══════════════════════════════════════════════════════════════════════════ */

  function _defaultBookings() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const d = (day) => fmtDate(new Date(y, m, day));
    return [
      { id: uid(), room:201, guest:'MARIA SANTOS',       type:'bk-confirmed', checkin:d(3),  checkout:d(7),  pax:2, rate:2800, notes:'' },
      { id: uid(), room:201, guest:'JUAN DELA CRUZ',     type:'bk-reserved',  checkin:d(12), checkout:d(15), pax:1, rate:2800, notes:'' },
      { id: uid(), room:202, guest:'PEDRO REYES',        type:'bk-confirmed', checkin:d(1),  checkout:d(5),  pax:3, rate:3200, notes:'Extra bed' },
      { id: uid(), room:203, guest:'ANGELA GARCIA',      type:'bk-walkin',    checkin:d(8),  checkout:d(10), pax:2, rate:3600, notes:'' },
      { id: uid(), room:204, guest:'ROBINSON BIGON',     type:'bk-blocked',   checkin:d(5),  checkout:d(9),  pax:0, rate:0,    notes:'Maintenance' },
      { id: uid(), room:205, guest:'KIMBERLY OLIVOS',    type:'bk-confirmed', checkin:d(14), checkout:d(18), pax:2, rate:3200, notes:'' },
      { id: uid(), room:206, guest:'ROMMEL TIGCAL',      type:'bk-reserved',  checkin:d(6),  checkout:d(11), pax:4, rate:3200, notes:'Birthday' },
      { id: uid(), room:207, guest:'BRIGADA DELA CRUZ',  type:'bk-confirmed', checkin:d(2),  checkout:d(6),  pax:2, rate:2800, notes:'' },
      { id: uid(), room:208, guest:'NENA ENRIQUEZ',      type:'bk-comp',      checkin:d(15), checkout:d(17), pax:2, rate:0,    notes:'Part of package' },
      { id: uid(), room:209, guest:'ALMIRA VELASCO',     type:'bk-confirmed', checkin:d(3),  checkout:d(8),  pax:3, rate:4200, notes:'' },
      { id: uid(), room:210, guest:'CHUCK AUTO',         type:'bk-walkin',    checkin:d(11), checkout:d(13), pax:1, rate:2600, notes:'' },
      { id: uid(), room:211, guest:'ANGELICA ODI',       type:'bk-confirmed', checkin:d(7),  checkout:d(12), pax:2, rate:2800, notes:'' },
      { id: uid(), room:212, guest:'DIANA REYES',        type:'bk-reserved',  checkin:d(18), checkout:d(22), pax:2, rate:2800, notes:'' },
      { id: uid(), room:213, guest:'FRANCISCO ENRIQUEZ', type:'bk-confirmed', checkin:d(1),  checkout:d(4),  pax:2, rate:3600, notes:'' },
      { id: uid(), room:214, guest:'MAINTENANCE BLOCK',  type:'bk-blocked',   checkin:d(10), checkout:d(14), pax:0, rate:0,    notes:'Room 214 busted light' },
      { id: uid(), room:215, guest:'STEPHEN AVOCADO',    type:'bk-confirmed', checkin:d(5),  checkout:d(9),  pax:4, rate:2600, notes:'' },
    ];
  }

  function getBookings() {
    const stored = load(KEY.bookings);
    if (stored !== null) return stored;
    // First-run only: seed defaults & persist so IDs are stable
    const seed = _defaultBookings();
    try { localStorage.setItem(KEY.bookings, JSON.stringify(seed)); } catch(e) {}
    return seed;
  }

  function setBookings(data) { persist(KEY.bookings, data); }

  /**
   * Overlap check for room bookings.
   *
   * Rule: Two bookings for the SAME room overlap if their NIGHT ranges intersect.
   * A booking occupies nights from checkin (inclusive) to checkout (exclusive).
   * So checkout on day N means the room is FREE from day N onwards.
   * → Overlap exists when: cinA < coutB  AND  cinB < coutA
   *
   * Exception: if both bookings are 'bk-cancelled' they don't conflict.
   * excludeId: the booking being edited (skip self-comparison).
   *
   * Returns { conflict: bool, conflictingBooking: object|null, message: string }
   */
  function checkBookingOverlap(newBk, excludeId = null) {
    const cin  = parseDate(newBk.checkin);
    const cout = parseDate(newBk.checkout);

    if (!cin || !cout || cout <= cin) {
      return { conflict: true, conflictingBooking: null,
               message: 'Check-out must be after check-in.' };
    }

    const existing = getBookings().filter(b =>
      b.room === newBk.room &&
      b.id !== excludeId &&
      b.type !== 'bk-cancelled'
    );

    for (const b of existing) {
      const bCin  = parseDate(b.checkin);
      const bCout = parseDate(b.checkout);
      // Interval overlap: cin < bCout AND bCin < cout
      if (cin < bCout && bCin < cout) {
        const fmt = s => parseDate(s)?.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) ?? s;
        return {
          conflict: true,
          conflictingBooking: b,
          message: `Room ${newBk.room} is already booked for "${b.guest}" from ${fmt(b.checkin)} to ${fmt(b.checkout)}. Dates cannot overlap.`,
        };
      }
    }
    return { conflict: false, conflictingBooking: null, message: '' };
  }

  /**
   * Validate and save a booking.
   * Returns { ok: bool, error: string }
   */
  function upsertBooking(bk) {
    // ── Field validation ──
    if (!bk.guest?.trim())   return { ok: false, error: 'Guest name is required.' };
    if (!bk.checkin)         return { ok: false, error: 'Check-in date is required.' };
    if (!bk.checkout)        return { ok: false, error: 'Check-out date is required.' };
    if (!ROOM_NUMBERS.includes(Number(bk.room)))
      return { ok: false, error: `Room ${bk.room} is not a valid room number.` };
    if (!BOOKING_TYPES[bk.type])
      return { ok: false, error: `Unknown booking type: ${bk.type}` };

    const cin  = parseDate(bk.checkin);
    const cout = parseDate(bk.checkout);
    if (!cin)        return { ok: false, error: 'Invalid check-in date.' };
    if (!cout)       return { ok: false, error: 'Invalid check-out date.' };
    if (cout <= cin) return { ok: false, error: 'Check-out must be after check-in.' };

    const nights = Math.round((cout - cin) / 86400000);
    if (nights > 365) return { ok: false, error: 'Booking cannot exceed 365 nights.' };

    // ── Overlap check (skip for cancelled) ──
    if (bk.type !== 'bk-cancelled') {
      const overlap = checkBookingOverlap(bk, bk.id);
      if (overlap.conflict) return { ok: false, error: overlap.message };
    }

    // ── Persist ──
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === bk.id);
    const record = {
      id:       bk.id || uid(),
      room:     Number(bk.room),
      guest:    String(bk.guest).trim().toUpperCase(),
      type:     bk.type,
      checkin:  bk.checkin,
      checkout: bk.checkout,
      pax:      Math.max(0, Number(bk.pax) || 0),
      rate:     Math.max(0, Number(bk.rate) || 0),
      notes:    String(bk.notes || '').trim(),
      createdAt: bk.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      bookings[idx] = record;
    } else {
      bookings.push(record);
    }
    setBookings(bookings);
    return { ok: true, error: '', booking: record };
  }

  function deleteBooking(id) {
    setBookings(getBookings().filter(b => b.id !== id));
  }

  /**
   * Get bookings that occupy a specific calendar date for a specific room.
   * A booking occupies a date if: cin <= date < cout
   */
  function getBookingsForDate(roomNum, dateStr) {
    const date = parseDate(dateStr);
    if (!date) return [];
    return getBookings().filter(b => {
      if (b.room !== roomNum || b.type === 'bk-cancelled') return false;
      const cin  = parseDate(b.checkin);
      const cout = parseDate(b.checkout);
      return cin <= date && date < cout;
    });
  }

  /**
   * Get all bookings that touch a date range [startStr, endStr) for any room.
   * Used for the Gantt rendering optimisation.
   */
  function getBookingsInRange(startStr, endStr) {
    const start = parseDate(startStr);
    const end   = parseDate(endStr);
    if (!start || !end) return [];
    return getBookings().filter(b => {
      const cin  = parseDate(b.checkin);
      const cout = parseDate(b.checkout);
      return cin < end && cout > start;
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     EVENTS
  ═══════════════════════════════════════════════════════════════════════════ */

  function _defaultEvents() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const d = (day) => fmtDate(new Date(y, m, day));
    return [
      { id:uid(), title:'RUDEN AND ABBY RECEPTION',    date:d(5),  timeStart:'10:00', timeEnd:'14:00', venue:'Ballroom A',     type:'ev-reception', pax:120, rate:45000, contact:'',             color:'#27ae60', notes:'BEIGE/BROWN theme',              status:'confirmed' },
      { id:uid(), title:'JEREMY SABEROLA WEDDING',     date:d(12), timeStart:'09:00', timeEnd:'18:00', venue:'Ballroom A & B', type:'ev-wedding',   pax:60,  rate:38000, contact:'9456617248',   color:'#e91e8c', notes:'',                               status:'confirmed' },
      { id:uid(), title:'COCOY BAPTISM',               date:d(22), timeStart:'10:30', timeEnd:'14:00', venue:'Function Hall',  type:'ev-birthday',  pax:100, rate:22800, contact:'9924933871',   color:'#f39c12', notes:'BLUE theme. Contact: MARK FRANCO PURA', status:'confirmed' },
      { id:uid(), title:'EAGLES BANTAYOG BAGWIS',      date:d(24), timeStart:'20:00', timeEnd:'23:00', venue:'Ballroom A',     type:'ev-corporate', pax:30,  rate:8000,  contact:'',             color:'#2980b9', notes:'Bronze Set A',                    status:'confirmed' },
      { id:uid(), title:'FRIDAY BARAYLE',              date:d(23), timeStart:'18:00', timeEnd:'22:00', venue:'Garden',        type:'ev-other',     pax:0,   rate:0,     contact:'',             color:'#95a5a6', notes:'',                               status:'tentative' },
      { id:uid(), title:'CENTRO DEPT STORE XMAS PARTY',date:d(15), timeStart:'21:00', timeEnd:'01:00', venue:'Ballroom A & B', type:'ev-corporate', pax:55,  rate:16500, contact:'Mam Myra',     color:'#2980b9', notes:'Bronze A / Candy Land theme',    status:'confirmed' },
    ];
  }

  function getEvents() {
    const stored = load(KEY.events);
    if (stored !== null) return stored;
    const seed = _defaultEvents();
    try { localStorage.setItem(KEY.events, JSON.stringify(seed)); } catch(e) {}
    return seed;
  }

  function setEvents(data) { persist(KEY.events, data); }

  /**
   * Venue time-overlap check for events.
   *
   * Two events on the SAME date at the SAME venue overlap if their time windows
   * intersect: startA < endB AND startB < endA.
   *
   * Special cases:
   *  - If either event has no time, we flag as a soft warning (not hard block).
   *  - 'Full Venue' conflicts with ALL venues on the same date.
   *  - Midnight-crossing events (timeEnd < timeStart) are handled by wrapping end to +24h.
   *
   * Returns { conflict: bool, hard: bool, conflictingEvent: obj|null, message: string }
   */
  function checkEventOverlap(newEv, excludeId = null) {
    const newStart = parseTime(newEv.timeStart);
    const rawEnd   = parseTime(newEv.timeEnd);

    // Wrap midnight-crossing end time
    let newEnd = rawEnd;
    if (newStart !== null && rawEnd !== null && rawEnd <= newStart) {
      newEnd = rawEnd + 1440; // +24 hours
    }

    const existing = getEvents().filter(e =>
      e.id !== excludeId &&
      e.date === newEv.date &&
      e.status !== 'cancelled'
    );

    // Check venue clash
    for (const ev of existing) {
      const venueClash =
        ev.venue === newEv.venue ||
        ev.venue === 'Full Venue' ||
        newEv.venue === 'Full Venue' ||
        // Ballroom A & B conflicts with individual A or B
        (newEv.venue === 'Ballroom A & B' && (ev.venue === 'Ballroom A' || ev.venue === 'Ballroom B')) ||
        (ev.venue === 'Ballroom A & B'    && (newEv.venue === 'Ballroom A' || newEv.venue === 'Ballroom B'));

      if (!venueClash) continue;

      const evStart = parseTime(ev.timeStart);
      let   evEnd   = parseTime(ev.timeEnd);
      if (evStart !== null && evEnd !== null && evEnd <= evStart) evEnd += 1440;

      // If either side lacks time info → soft warning
      if (newStart === null || newEnd === null || evStart === null || evEnd === null) {
        return {
          conflict: true, hard: false,
          conflictingEvent: ev,
          message: `"${ev.title}" is also booked at ${ev.venue} on this date. No times are specified so overlap cannot be confirmed — proceed with caution.`,
        };
      }

      // Hard time overlap: newStart < evEnd AND evStart < newEnd
      if (newStart < evEnd && evStart < newEnd) {
        const fmt12 = m => { const h = Math.floor((m % 1440) / 60), mn = m % 60; return `${h % 12 || 12}:${String(mn).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`; };
        return {
          conflict: true, hard: true,
          conflictingEvent: ev,
          message: `Venue conflict: "${ev.title}" uses ${ev.venue} from ${fmt12(evStart)}–${fmt12(evEnd)} on this date. Your event (${fmt12(newStart)}–${fmt12(newEnd)}) overlaps.`,
        };
      }
    }
    return { conflict: false, hard: false, conflictingEvent: null, message: '' };
  }

  /**
   * Validate and save an event.
   * Returns { ok: bool, warning: string, error: string }
   */
  function upsertEvent(ev) {
    // ── Field validation ──
    if (!ev.title?.trim()) return { ok: false, error: 'Event title is required.' };
    if (!ev.date)          return { ok: false, error: 'Event date is required.' };
    if (!parseDate(ev.date)) return { ok: false, error: 'Invalid event date.' };
    if (!EVENT_TYPES[ev.type]) return { ok: false, error: `Unknown event type: ${ev.type}` };
    if (ev.venue && !EVENT_VENUES.includes(ev.venue))
      return { ok: false, error: `Unknown venue: ${ev.venue}` };

    if (ev.timeStart && !parseTime(ev.timeStart))
      return { ok: false, error: 'Invalid start time format. Use HH:MM.' };
    if (ev.timeEnd && !parseTime(ev.timeEnd))
      return { ok: false, error: 'Invalid end time format. Use HH:MM.' };

    // ── Overlap check ──
    let warning = '';
    if (ev.status !== 'cancelled') {
      const overlap = checkEventOverlap(ev, ev.id);
      if (overlap.conflict) {
        if (overlap.hard) return { ok: false, error: overlap.message };
        warning = overlap.message; // soft warning — allow save
      }
    }

    // ── Persist ──
    const events = getEvents();
    const idx = events.findIndex(e => e.id === ev.id);
    const record = {
      id:        ev.id || uid(),
      title:     String(ev.title).trim().toUpperCase(),
      date:      ev.date,
      timeStart: ev.timeStart || '',
      timeEnd:   ev.timeEnd   || '',
      venue:     ev.venue     || '',
      type:      ev.type,
      pax:       Math.max(0, Number(ev.pax)  || 0),
      rate:      Math.max(0, Number(ev.rate) || 0),
      contact:   String(ev.contact || '').trim(),
      color:     ev.color || EVENT_TYPES[ev.type]?.color || '#888',
      notes:     String(ev.notes || '').trim(),
      status:    ev.status || 'confirmed',
      createdAt: ev.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      events[idx] = record;
    } else {
      events.push(record);
    }
    setEvents(events);
    return { ok: true, warning, error: '', event: record };
  }

  function deleteEvent(id) {
    setEvents(getEvents().filter(e => e.id !== id));
  }

  function getEventsForDate(dateStr) {
    return getEvents()
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CROSS-PAGE SYNC
  ═══════════════════════════════════════════════════════════════════════════ */

  const _listeners = [];

  /**
   * Register a callback that fires when any HMS data changes.
   * Works both same-tab (CustomEvent) and cross-tab (storage event).
   * Returns an unsubscribe function.
   */
  function onUpdate(cb) {
    function handleCustom(e) { cb(e.detail.key); }
    function handleStorage(e) {
      if (e.key && Object.values(KEY).includes(e.key)) cb(e.key);
    }
    window.addEventListener('hiraya:update', handleCustom);
    window.addEventListener('storage', handleStorage);
    _listeners.push({ handleCustom, handleStorage });

    // Return unsubscribe
    return function unsubscribe() {
      window.removeEventListener('hiraya:update', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════════════════════════ */
  return Object.freeze({
    // Utilities
    uid,
    parseDate,
    fmtDate,
    parseTime,
    esc,

    // Constants
    ROOM_NUMBERS,
    ROOM_META,
    ROOM_TYPES,       // legacy
    ROOM_STATUS,
    BOOKING_TYPES,
    BOOKING_COLORS,   // legacy
    BOOKING_LABELS,   // legacy
    EVENT_TYPES,
    EVENT_COLORS,     // legacy
    EVENT_LABELS,     // legacy
    EVENT_VENUES,

    // Rooms
    getRooms,
    setRooms,
    setRoom,
    computeRoomStatuses,
    syncRoomsFromBookings,     // alias

    // Bookings
    getBookings,
    setBookings,
    upsertBooking,
    deleteBooking,
    checkBookingOverlap,
    getBookingsForDate,
    getBookingsInRange,

    // Events
    getEvents,
    setEvents,
    upsertEvent,
    deleteEvent,
    checkEventOverlap,
    getEventsForDate,

    // Sync
    onUpdate,

    // Storage keys (read-only reference)
    KEY: Object.freeze({ ...KEY }),
  });

})();
