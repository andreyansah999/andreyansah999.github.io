/**
 * icons.js — kumpulan ikon SVG inline (stroke, 24x24) supaya tidak perlu library eksternal.
 */
const base = (paths, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

export const Icons = {
  dashboard: base('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  branch: base('<path d="M3 21h18"/><path d="M6 21V8l6-4 6 4v13"/><path d="M10 21v-6h4v6"/>'),
  users: base('<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16.5 8.2a3 3 0 1 1 3.4 4.7"/><path d="M17 14c2.8.4 4.5 2.2 4.5 6"/>'),
  wifi: base('<path d="M2 8.5a16 16 0 0 1 20 0"/><path d="M5.5 12.5a11 11 0 0 1 13 0"/><path d="M9 16.3a6 6 0 0 1 6 0"/><circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none"/>'),
  price: base('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2c0 2.4-5 1.6-5 4.2 0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2"/><path d="M12 6v1.2M12 16.8V18"/>'),
  activity: base('<path d="M3 12h4l2.5-7L14 19l2.5-7H21"/>'),
  settings: base('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8h-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>'),
  logout: base('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  menu: base('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  close: base('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: base('<path d="M12 5v14M5 12h14"/>'),
  edit: base('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: base('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>'),
  check: base('<path d="M20 6 9 17l-5-5"/>'),
  power: base('<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
  card: base('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>'),
  moon: base('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>'),
  sun: base('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'),
  search: base('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  building: base('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>'),
  signal: base('<path d="M4 20h1v-4H4z"/><path d="M9.5 20h1v-9h-1z"/><path d="M15 20h1v-14h-1z"/><path d="M20.5 20h1v-17h-1z"/>'),
  refresh: base('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'),
  upload: base('<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  eye: base('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  alert: base('<circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="16.3" x2="12" y2="16.3" stroke-linecap="round"/>'),
  expense: base('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
};
