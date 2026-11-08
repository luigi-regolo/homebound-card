/*!
 * Homebound Card 1.1
 * Copyright (c) 2026 luigi-regolo
 * Distributed under GPL-3.0-only.
 */
(() => {
  'use strict';

  const VERSION = '1.1';
  const TAG = 'homebound-card';
  const EDITOR_TAG = 'homebound-card-editor';
  if (customElements.get(TAG)) return;

  /* ------------------------------------------------------------------ */
  /* 1. Costanti e configurazione predefinita                            */
  /* ------------------------------------------------------------------ */

  const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
  const PERSON_DOMAINS = ['person', 'device_tracker'];
  const BATTERY_DOMAINS = ['sensor'];
  const RANGES = [
    { h: 24, label: '24 ore' },
    { h: 72, label: '3 giorni' },
    { h: 168, label: '7 giorni' },
  ];
  const NICE = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  const NOT_KNOWN = ['unknown', 'unavailable'];
  const DEVICE_TYPES = {
    tablet: { icon: 'tablet-dashboard', label: 'Tablet' },
    phone: { icon: 'cellphone', label: 'Telefono' },
    watch: { icon: 'watch', label: 'Orologio' },
    other: { icon: 'devices', label: 'Altro' },
  };
  const DEVICE_DOMAINS = ['sensor', 'device_tracker'];
  const CHARGING_DOMAINS = ['binary_sensor'];
  const LOCATION_DOMAINS = ['sensor'];

  const DEFAULTS = {
    eyebrow: 'HOMEBOUND CARD',
    title: 'Presenza',
    show_eyebrow: true,
    show_title: true,
    theme_mode: 'auto',
    show_map: true,
    show_battery: true,
    history_hours: 24,
    map_path: '/map',
    people: [],
    devices: [],
    battery_style: 'b',
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<ha-icon icon="mdi:${name}" aria-hidden="true"></ha-icon>`;
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const parseDate = (v) => {
    if (!v) return null;
    const t = typeof v === 'number' ? v * 1000 : Date.parse(v);
    return Number.isFinite(t) ? new Date(t) : null;
  };

  /* ------------------------------------------------------------------ */
  /* 2. Validazione e normalizzazione                                    */
  /* ------------------------------------------------------------------ */

  function normPeople(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const it = typeof raw === 'string' ? { entity: raw } : raw && typeof raw === 'object' ? raw : null;
      if (!it || typeof it.entity !== 'string') continue;
      const entity = it.entity.trim();
      if (!ENTITY_RE.test(entity) || !PERSON_DOMAINS.includes(entity.split('.')[0]) || seen.has(entity)) continue;
      seen.add(entity);
      const o = { entity };
      if (typeof it.name === 'string' && it.name.trim()) o.name = it.name.trim().slice(0, 60);
      if (typeof it.battery_entity === 'string' && ENTITY_RE.test(it.battery_entity) && BATTERY_DOMAINS.includes(it.battery_entity.split('.')[0])) {
        o.battery_entity = it.battery_entity;
      }
      if (typeof it.charging_entity === 'string' && ENTITY_RE.test(it.charging_entity) && CHARGING_DOMAINS.includes(it.charging_entity.split('.')[0])) {
        o.charging_entity = it.charging_entity;
      }
      if (typeof it.location_entity === 'string' && ENTITY_RE.test(it.location_entity) && LOCATION_DOMAINS.includes(it.location_entity.split('.')[0])) {
        o.location_entity = it.location_entity;
      }
      if (typeof it.watch_battery_entity === 'string' && ENTITY_RE.test(it.watch_battery_entity) && BATTERY_DOMAINS.includes(it.watch_battery_entity.split('.')[0])) {
        o.watch_battery_entity = it.watch_battery_entity;
      }
      if (typeof it.watch_charging_entity === 'string' && ENTITY_RE.test(it.watch_charging_entity) && CHARGING_DOMAINS.includes(it.watch_charging_entity.split('.')[0])) {
        o.watch_charging_entity = it.watch_charging_entity;
      }
      out.push(o);
    }
    return out;
  }

  function normDevices(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const it = typeof raw === 'string' ? { entity: raw } : raw && typeof raw === 'object' ? raw : null;
      if (!it || typeof it.entity !== 'string') continue;
      const entity = it.entity.trim();
      if (!ENTITY_RE.test(entity) || !DEVICE_DOMAINS.includes(entity.split('.')[0]) || seen.has(entity)) continue;
      seen.add(entity);
      const o = { entity, type: DEVICE_TYPES[it.type] ? it.type : 'tablet' };
      if (typeof it.name === 'string' && it.name.trim()) o.name = it.name.trim().slice(0, 60);
      if (typeof it.charging_entity === 'string' && ENTITY_RE.test(it.charging_entity) && CHARGING_DOMAINS.includes(it.charging_entity.split('.')[0])) {
        o.charging_entity = it.charging_entity;
      }
      out.push(o);
    }
    return out;
  }

  const txt = (v, fallback, max) => (typeof v === 'string' ? v.slice(0, max) : fallback);

  function normalize(config) {
    if (!config || typeof config !== 'object') throw new Error('Configurazione non valida');
    const c = { ...DEFAULTS, ...config };
    c.eyebrow = txt(c.eyebrow, DEFAULTS.eyebrow, 60);
    c.title = txt(c.title, DEFAULTS.title, 60).replace(/\.+$/, '');
    c.show_eyebrow = c.show_eyebrow !== false;
    c.show_title = c.show_title !== false;
    c.show_map = c.show_map !== false;
    c.show_battery = c.show_battery !== false;
    c.theme_mode = ['auto', 'light', 'dark'].includes(c.theme_mode) ? c.theme_mode : 'auto';
    c.history_hours = RANGES.some((r) => r.h === Number(c.history_hours)) ? Number(c.history_hours) : 24;
    c.map_path = typeof c.map_path === 'string' && /^\/[a-zA-Z0-9_\-/]*$/.test(c.map_path) ? c.map_path : '';
    c.battery_style = ['a', 'b', 'c', 'd'].includes(c.battery_style) ? c.battery_style : 'b';
    c.people = normPeople(c.people);
    c.devices = normDevices(c.devices);
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Utilità batteria                                                 */
  /* ------------------------------------------------------------------ */

  const batteryTone = (level) => (level <= 15 ? 'crit' : level <= 30 ? 'warn' : 'ok');

  /* ------------------------------------------------------------------ */
  /* 4. Stili (token Edera come Weather Pulse e Camera Grid View)        */
  /* ------------------------------------------------------------------ */

  const CSS = `
:host{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;font-family:var(--ha-font-family-body,Roboto,Arial,sans-serif);color:var(--primary-text-color,#18221c);font-size:var(--ha-font-size-m,14px)}
*,*:before,*:after{box-sizing:border-box}
button{font:inherit;cursor:pointer}
ha-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;--mdc-icon-size:18px;width:var(--mdc-icon-size);height:var(--mdc-icon-size)}
.pc-root,.pc-backdrop{--pc-accent:#0a7156;--pc-ink:var(--pc-accent);--pc-muted:#56675c;--pc-tile:#f0f2ef;--pc-circle:#fff;--pc-line:#e0e5df;--pc-bg:#fafbf9;--pc-fg:#18221c;--pc-btn-fg:var(--pc-accent);--pc-alert:#b85d55;--pc-warn:#c89643;--pc-neutral:#858e89;--pc-away:#56675c}
.pc-dark{--pc-accent:#0e795d;--pc-ink:#f5f7f4;--pc-muted:#bbc5bd;--pc-tile:#191c1a;--pc-circle:#282b29;--pc-line:#2b302c;--pc-bg:#101211;--pc-fg:#f5f7f4;--pc-btn-fg:#f5f7f4;--pc-away:#bbc5bd}
.pc-container{display:block;width:100%;max-width:100%;min-width:0;container-type:inline-size;container-name:pc}
.pc-root{background:var(--pc-bg);color:var(--pc-fg);border:1px solid var(--pc-line);border-radius:26px;padding:18px;width:100%;min-width:0}

.pc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:2px 4px 17px;min-height:46px}
.pc-titles{min-width:0}
.pc-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:750;color:var(--pc-muted);text-transform:uppercase}
.pc-title{margin:7px 0 0;font-size:25px;line-height:1.14;font-weight:780;letter-spacing:-.7px;overflow-wrap:anywhere}
.pc-title b{color:var(--pc-accent);font-weight:800}
.pc-counts{display:flex;gap:6px;flex:none}
.pc-cnt{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px 0 8px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--pc-ink);border:1px solid color-mix(in srgb,var(--pc-accent) 45%,transparent);background:color-mix(in srgb,var(--pc-accent) 12%,transparent)}
.pc-cnt ha-icon{--mdc-icon-size:16px}
.pc-cnt.pc-unk{color:var(--pc-muted);border:1px dashed var(--pc-neutral);background:var(--pc-tile)}

.pc-body{display:grid;gap:12px;align-items:start;min-width:0}
.pc-col{display:grid;gap:10px;min-width:0}
.pc-list{display:grid;gap:10px}
.pc-row{--c:var(--pc-away);display:flex;align-items:center;gap:12px;height:66px;padding:0 12px;min-width:0;cursor:pointer;text-align:left;color:inherit;border:1px solid var(--pc-line);background:var(--pc-tile);border-radius:16px;transition:border-color .16s}
.pc-row:hover,.pc-row:focus{border-color:var(--pc-accent)}
.pc-row:focus-visible,.pc-detail:focus-visible,.pc-close:focus-visible,.pc-seg button:focus-visible,.pc-mapbtn:focus-visible{outline:2px solid var(--pc-accent);outline-offset:2px}
.pc-st-home,.pc-st-zone{--c:var(--pc-accent)}
.pc-st-away{--c:var(--pc-away)}
.pc-st-unknown,.pc-st-unavailable,.pc-st-missing{--c:var(--pc-neutral)}
.pc-avatar{position:relative;display:grid;place-items:center;flex:none;width:43px;height:43px;border-radius:50%;background:var(--pc-circle);color:var(--c);font-weight:750;font-size:17px}
.pc-avatar:after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--c);pointer-events:none}
.pc-st-unknown .pc-avatar:after,.pc-st-unavailable .pc-avatar:after,.pc-st-missing .pc-avatar:after{border-style:dashed}
.pc-st-unknown .pc-avatar,.pc-st-unavailable .pc-avatar,.pc-st-missing .pc-avatar{opacity:.85}
.pc-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.pc-meta{flex:1;min-width:0}
.pc-name{display:block;font-size:14px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-sub{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:11.5px;line-height:1.4;color:var(--pc-muted);min-width:0}
.pc-sub ha-icon{--mdc-icon-size:15px;color:var(--c)}
.pc-sub span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-sub>span:first-of-type{flex:none;max-width:100%}
.pc-st-home .pc-sub span:first-child,.pc-st-zone .pc-sub span:first-child{color:var(--pc-ink);font-weight:650}
.pc-st-away .pc-sub span:first-child{color:var(--pc-fg);font-weight:650}
.pc-avatar ha-icon{--mdc-icon-size:22px}
.pc-bats{display:flex;align-items:center;gap:6px;flex:none}
.tn-ok{--tn:var(--pc-accent)}.tn-warn{--tn:var(--pc-warn)}.tn-crit{--tn:var(--pc-alert)}
.pc-bats ha-icon{color:inherit}
.pc-rb{display:flex;flex-direction:column;align-items:center;gap:3px;width:38px;flex:none}
.pc-rg{position:relative;width:36px;height:36px;display:grid;place-items:center}
.pc-rg svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.pc-rt{fill:none;stroke:color-mix(in srgb,var(--pc-muted) 20%,transparent);stroke-width:4.2}
.pc-rf{fill:var(--pc-circle)}
.pc-rp{fill:none;stroke:var(--tn);stroke-width:4.2;stroke-linecap:round}
.pc-rb .s1{stop-color:color-mix(in srgb,var(--tn) 100%,transparent)}
.pc-rb .s2{stop-color:color-mix(in srgb,var(--tn) 55%,#fff)}
.pc-rg ha-icon{--mdc-icon-size:15px;color:var(--tn);position:relative}
.pc-rg .pc-bolt{position:absolute;right:-5px;top:-4px;--mdc-icon-size:12px;color:var(--tn);filter:drop-shadow(0 0 1px var(--pc-tile)) drop-shadow(0 0 1px var(--pc-tile))}
.pc-pct{font-size:11px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--pc-fg)}
.tn-warn .pc-pct,.tn-crit .pc-pct{color:var(--tn)}
/* B: percentuale dentro l'anello, icona dispositivo come badge */
.pc-rbb{width:42px}
.pc-rgb{width:40px;height:40px}
.pc-pin{position:relative;font-size:11.5px;font-weight:800;letter-spacing:-.3px;font-variant-numeric:tabular-nums;color:var(--pc-fg)}
.pc-pin small{font-size:7.5px;font-weight:700;margin-left:.5px;color:var(--pc-muted)}
.tn-warn .pc-pin,.tn-crit .pc-pin{color:var(--tn)}
.pc-dv{position:absolute;right:-4px;bottom:-4px;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;background:var(--pc-bg);box-shadow:0 0 0 1.5px var(--pc-tile),inset 0 0 0 1px color-mix(in srgb,var(--tn) 45%,transparent);color:var(--tn)}
.pc-dv ha-icon{--mdc-icon-size:10px;color:var(--tn)}
/* C: pillole con riempimento */
.pc-bs-c{flex-direction:column;align-items:flex-end;gap:5px}
.pc-pl{position:relative;display:flex;align-items:center;width:78px;height:23px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--tn) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tn) 34%,transparent)}
.pc-plf{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--tn) 22%,transparent),color-mix(in srgb,var(--tn) 50%,transparent))}
.pc-plc{position:relative;display:flex;align-items:center;justify-content:space-between;gap:4px;width:100%;padding:0 9px 0 7px}
.pc-plc>ha-icon{--mdc-icon-size:14px;color:var(--pc-fg)}
.pc-plr{display:inline-flex;align-items:center;gap:1px}
.pc-plr ha-icon{--mdc-icon-size:12px;color:var(--tn)}
.pc-plr b{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pc-fg)}
.tn-warn .pc-plr b,.tn-crit .pc-plr b{color:var(--tn)}
/* D: anelli concentrici */
.pc-bs-d{gap:8px}
.pc-cr{position:relative;width:46px;height:46px;flex:none}
.pc-cr svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.pc-cr .pc-rp{stroke-width:4.6}.pc-cr .pc-rt{stroke-width:4.6}
.pc-cr .pc-rp.o{stroke:var(--to)}.pc-cr .pc-rp.i{stroke:var(--ti)}
.pc-cl{display:grid;gap:5px;min-width:40px}
.pc-dl{display:flex;align-items:center;gap:3px;font-size:11.5px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--pc-fg)}
.pc-dl ha-icon{--mdc-icon-size:13px;color:var(--tn)}
.pc-dl .pc-bolt2{--mdc-icon-size:11px;color:var(--tn);margin-left:-1px}
.tn-warn.pc-dl,.tn-crit.pc-dl{color:var(--tn)}

.pc-map{position:relative;width:100%;aspect-ratio:16/10;border-radius:16px;overflow:hidden;border:1px solid var(--pc-line);background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--pc-accent) 12%,transparent),transparent 62%),var(--pc-tile)}
.pc-map svg{position:absolute;inset:0;width:100%;height:100%}
.pc-ring{fill:none;stroke:var(--pc-muted);stroke-opacity:.35;stroke-width:.35;stroke-dasharray:1.2 1.6}
.pc-axis{stroke:var(--pc-muted);stroke-opacity:.14;stroke-width:.25}
.pc-rlabel{fill:var(--pc-muted);font-size:4px;font-weight:650;paint-order:stroke;stroke:var(--pc-tile);stroke-width:1.1px}
.pc-mk{--c:var(--pc-away);position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2}
.pc-mk .pc-avatar{width:28px;height:28px;font-size:12px;box-shadow:0 0 0 2px var(--pc-tile)}
.pc-mk .pc-avatar:after{inset:-2px}
.pc-tag{margin-top:5px;max-width:74px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:650;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--pc-circle);color:var(--pc-fg);border:1px solid var(--pc-line)}
.pc-homec{position:absolute;left:50%;top:50%;width:38px;height:38px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;z-index:1;background:var(--pc-circle);border:2px solid var(--pc-accent);color:var(--pc-accent)}
.pc-homec ha-icon{--mdc-icon-size:20px}
.pc-hbadge{position:absolute;top:-8px;right:-9px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:750;line-height:1;background:var(--pc-accent);color:#fff;border:2px solid var(--pc-tile)}
.pc-mapfoot{position:absolute;left:10px;right:10px;bottom:8px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:9.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--pc-muted);pointer-events:none}
.pc-mapfoot span{white-space:nowrap}
.pc-mapfoot .pc-noloc{flex:1;min-width:0;text-align:right;text-transform:none;letter-spacing:0;font-size:10.5px;overflow:hidden;text-overflow:ellipsis}
.pc-mapbtn{position:absolute;right:8px;top:8px;z-index:3;width:32px;height:32px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid var(--pc-line);background:var(--pc-circle);color:var(--pc-fg)}
.pc-mapbtn{position:absolute}
.pc-mapbtn ha-icon{position:absolute;left:50%;top:50%;margin:0;--mdc-icon-size:17px;transform:translate(-50%,-50%)}

.pc-foot{margin-top:2px}
.pc-detail{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;padding:10px 14px;border-radius:999px;font-family:inherit;font-weight:600;font-size:13.5px;line-height:1.2;cursor:pointer;color:var(--pc-btn-fg);border:1px solid color-mix(in srgb,var(--pc-accent) 45%,transparent);background:color-mix(in srgb,var(--pc-accent) 12%,transparent)}
.pc-detail:hover{background:color-mix(in srgb,var(--pc-accent) 22%,transparent)}
.pc-detail ha-icon{display:block;flex:none;margin:0;color:inherit}

.pc-empty{display:grid;justify-items:center;gap:6px;padding:22px 12px;text-align:center;border:1px dashed var(--pc-line);border-radius:16px;color:var(--pc-muted);font-size:12px;line-height:1.45}
.pc-empty ha-icon{--mdc-icon-size:28px}.pc-empty b{color:var(--pc-fg);font-size:14px}
.pc-sk{height:66px;border-radius:16px;border:1px solid var(--pc-line);background:var(--pc-tile)}
.pc-skmap{aspect-ratio:16/10;border-radius:16px;border:1px solid var(--pc-line);background:var(--pc-tile)}
.pc-skdetail{min-height:44px;border-radius:999px;border:1px solid var(--pc-line);background:var(--pc-tile)}

@container pc (min-width:620px){
  .pc-body.pc-hasmap{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .pc-body.pc-hasmap .pc-foot{grid-column:1/-1}
}
@container pc (min-width:560px){.pc-body:not(.pc-hasmap) .pc-list{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}}
@container pc (max-width:380px){.pc-bats{gap:5px}.pc-root{padding:13px;border-radius:23px}.pc-title{font-size:23px}.pc-head{gap:7px}.pc-row{gap:10px;padding:0 10px}}
@container pc (max-width:310px){.pc-root{padding:10px}.pc-title{font-size:21px}.pc-eyebrow{font-size:9px}.pc-tag{display:none}.pc-avatar{width:38px;height:38px}}

.pc-backdrop{position:fixed;inset:0;overscroll-behavior:contain;z-index:9999;background:#0009;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.pc-dialog{width:min(390px,100%);max-width:100%;min-width:0;max-height:min(88vh,680px);max-height:min(88dvh,680px);display:flex;flex-direction:column;background:var(--pc-bg);color:var(--pc-fg);border:1px solid var(--pc-line);border-radius:26px;overflow:hidden;box-shadow:0 18px 60px #0005;font-family:inherit;font-size:inherit;outline:none}
.pc-mhead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px 18px;background:var(--pc-bg);border-bottom:1px solid var(--pc-line)}
.pc-mtitle{flex:1;min-width:0;margin:0;font-size:17px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.pc-close{display:grid;place-items:center;line-height:0;margin:0;padding:0;width:40px;height:40px;flex:none;border:1px solid var(--pc-line);border-radius:50%;background:var(--pc-tile);color:var(--pc-fg)}
.pc-close{position:relative}
.pc-close ha-icon{position:absolute;left:50%;top:50%;margin:0;--mdc-icon-size:20px;transform:translate(-50%,-50%)}
.pc-mbody{position:relative;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px 18px 18px;min-width:0;display:grid;gap:12px;align-content:start}
.pc-seg{display:flex;flex-wrap:wrap;gap:6px}
.pc-seg button{font-size:12.5px;padding:6px 11px;border-radius:999px;border:1px solid var(--pc-line);background:var(--pc-tile);color:inherit;min-height:32px}
.pc-seg button[aria-pressed="true"]{background:color-mix(in srgb,var(--pc-accent) 14%,transparent);border-color:var(--pc-accent);color:var(--pc-btn-fg);font-weight:600}
.pc-ent{--c:var(--pc-away);background:var(--pc-tile);border:0;border-radius:22px;padding:13px;min-width:0;display:grid;gap:11px}
.pc-eh{display:flex;align-items:center;gap:12px;min-width:0}
.pc-chip{display:inline-flex;align-items:center;gap:5px;flex:none;height:26px;max-width:46%;padding:0 10px 0 8px;border-radius:999px;font-size:11.5px;font-weight:650;color:var(--pc-fg);border:1px solid color-mix(in srgb,var(--c) 50%,transparent);background:color-mix(in srgb,var(--c) 12%,transparent)}
.pc-chip ha-icon{--mdc-icon-size:15px;color:var(--c)}.pc-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-st-unknown .pc-chip,.pc-st-unavailable .pc-chip,.pc-st-missing .pc-chip{border-style:dashed}
.pc-sums{display:flex;flex-wrap:wrap;gap:6px}
.pc-sumc{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;font-size:12px;background:var(--pc-circle);border:1px solid var(--pc-line);color:var(--pc-muted)}
.pc-sumc b{color:var(--pc-fg);font-weight:650}.pc-sumc ha-icon{--mdc-icon-size:16px}
.pc-sumc.in ha-icon{color:var(--pc-accent)}.pc-sumc.out ha-icon{color:var(--pc-away)}
.pc-metrics{display:grid;gap:7px}
.pc-metric{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--pc-circle);border:1px solid var(--pc-line);padding:10px 13px;border-radius:14px}
.pc-metric span{color:var(--pc-muted);font-size:12px}
.pc-metric strong{font-size:13px;font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-metric strong.warn{color:var(--pc-warn)}.pc-metric strong.crit{color:var(--pc-alert)}
.pc-hh{margin:4px 2px 0;color:var(--pc-muted);font-size:11px;letter-spacing:.1em;font-weight:600;text-transform:uppercase}
.pc-ent.pc-hl{box-shadow:inset 0 0 0 2px var(--pc-accent)}
.pc-dg{margin:8px 4px 2px;font-size:11.5px;font-weight:650;color:var(--pc-muted)}
.pc-ev{display:grid;grid-template-columns:42px 26px minmax(0,1fr);align-items:start;gap:8px;padding:4px 2px}
.pc-et{font-size:12.5px;font-weight:650;font-variant-numeric:tabular-nums;padding-top:4px}
.pc-ed{position:relative;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--pc-circle);color:var(--k);border:1px solid color-mix(in srgb,var(--k) 55%,transparent)}
.pc-ed ha-icon{--mdc-icon-size:15px}
.pc-ev:not(:last-child) .pc-ed:after{content:"";position:absolute;left:50%;top:26px;width:2px;height:12px;transform:translateX(-50%);background:var(--pc-line)}
.pc-ev.good{--k:var(--pc-accent)}.pc-ev.neutral{--k:var(--pc-away)}.pc-ev.grey{--k:var(--pc-neutral)}
.pc-el{font-size:13px;font-weight:600;padding-top:3px}.pc-es{font-size:11.5px;color:var(--pc-muted);margin-top:1px}
.pc-note{font-size:12px;line-height:1.5;color:var(--pc-muted);padding:2px 4px}
/* colori di stato: in fondo, così prevalgono sui valori predefiniti di .pc-ent e .pc-mk */

.pc-st-home,.pc-st-zone,.pc-st-ok{--c:var(--pc-accent)}
.pc-st-away{--c:var(--pc-away)}
.pc-st-unknown,.pc-st-unavailable,.pc-st-missing{--c:var(--pc-neutral)}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

  /* ------------------------------------------------------------------ */
  /* 5. Card                                                             */
  /* ------------------------------------------------------------------ */

  class HomeboundCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._cfg = null;
      this._hass = null;
      this._sig = '';
      this._models = [];
      this._devs = [];
      this._gid = 0;
      this._open = false;
      this._range = 24;
      this._hist = null;
      this._focusId = null;
      this._opener = null;
      this._sinceKey = '';
      this._sinceMap = {};
      this._onKey = this._onKey.bind(this);
      this.shadowRoot.addEventListener('click', (e) => this._onClick(e));
      this.shadowRoot.addEventListener('keydown', (e) => this._onRowKey(e));
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig() {
      return { people: [] };
    }

    setConfig(config) {
      this._cfg = normalize(config);
      this._range = this._cfg.history_hours;
      this._sig = '';
      this._hist = null;
      this._sinceKey = '';
      this._sinceMap = {};
      this._open = false;
      document.removeEventListener('keydown', this._onKey, true);
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="main"></div><div id="ov"></div>`;
      this._renderSkeleton();
      if (this._hass) this._update();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._cfg) this._update();
    }

    getCardSize() {
      return 5;
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this._onKey, true);
    }

    /* ---------- tema, tempo, distanza ---------- */

    _isDark() {
      const t = this._cfg.theme_mode;
      return t === 'dark' || (t === 'auto' && this._hass?.themes?.darkMode === true);
    }

    _home() {
      const h = this._hass;
      const z = h?.states?.['zone.home']?.attributes;
      const lat = num(z?.latitude ?? h?.config?.latitude);
      const lon = num(z?.longitude ?? h?.config?.longitude);
      if (lat === null || lon === null) return null;
      return { lat, lon, radius: num(z?.radius) ?? 100 };
    }

    _tzOpts() {
      const loc = this._hass?.locale || {};
      const o = {};
      if (loc.time_zone === 'server' && this._hass?.config?.time_zone) o.timeZone = this._hass.config.time_zone;
      if (loc.time_format === '12') o.hour12 = true;
      else if (loc.time_format === '24') o.hour12 = false;
      return o;
    }

    _lang() {
      return this._hass?.locale?.language || this._hass?.language || 'it';
    }

    _fmtTime(ms) {
      return new Intl.DateTimeFormat(this._lang(), { hour: '2-digit', minute: '2-digit', ...this._tzOpts() }).format(ms);
    }

    _dayKey(ms) {
      return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: this._tzOpts().timeZone }).format(ms);
    }

    _dayLabel(ms) {
      const k = this._dayKey(ms);
      if (k === this._dayKey(Date.now())) return 'Oggi';
      if (k === this._dayKey(Date.now() - 86400000)) return 'Ieri';
      return new Intl.DateTimeFormat(this._lang(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: this._tzOpts().timeZone }).format(ms);
    }

    _sinceText(date) {
      if (!date) return '';
      const ms = date.getTime();
      const k = this._dayKey(ms);
      if (k === this._dayKey(Date.now())) return `dalle ${this._fmtTime(ms)}`;
      if (k === this._dayKey(Date.now() - 86400000)) return `da ieri alle ${this._fmtTime(ms)}`;
      return `dal ${this._dayLabel(ms)} alle ${this._fmtTime(ms)}`;
    }

    _dayTime(ms) {
      const k = this._dayKey(ms);
      if (k === this._dayKey(Date.now())) return this._fmtTime(ms);
      if (k === this._dayKey(Date.now() - 86400000)) return `ieri ${this._fmtTime(ms)}`;
      return `${this._dayLabel(ms)} ${this._fmtTime(ms)}`;
    }

    _fmtDur(ms) {
      const m = Math.round(ms / 60000);
      if (m < 1) return 'meno di 1 min';
      if (m < 60) return `${m} min`;
      const h = Math.floor(m / 60);
      const r = m % 60;
      if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
      const d = Math.floor(h / 24);
      const hh = h % 24;
      return hh ? `${d} g ${hh} h` : `${d} g`;
    }

    _fmtDist(meters) {
      const imp = this._hass?.config?.unit_system?.length === 'mi';
      const nf = (v, d) => new Intl.NumberFormat(this._lang(), { maximumFractionDigits: d }).format(v);
      if (imp) {
        const mi = meters / 1609.344;
        return mi < 0.1 ? `${nf(meters * 3.28084, 0)} ft` : `${nf(mi, mi < 10 ? 1 : 0)} mi`;
      }
      return meters < 1000 ? `${nf(Math.round(meters / 10) * 10, 0)} m` : `${nf(meters / 1000, meters < 10000 ? 1 : 0)} km`;
    }

    /* ---------- dati ---------- */

    _model() {
      const h = this._hass;
      const home = this._home();
      const build = (entry) => {
        const so = h.states[entry.entity];
        const m = { id: entry.entity, entry, name: entry.name || so?.attributes?.friendly_name || entry.entity, so };
        if (!so) {
          m.status = 'missing';
          return m;
        }
        const a = so.attributes || {};
        const st = so.state;
        m.state = st;
        m.status = st === 'home' ? 'home' : st === 'not_home' ? 'away' : st === 'unknown' ? 'unknown' : st === 'unavailable' ? 'unavailable' : 'zone';
        m.zone = m.status === 'zone' ? st : null;
        m.lat = num(a.latitude);
        m.lon = num(a.longitude);
        m.accuracy = num(a.gps_accuracy);
        m.since = parseDate(so.last_changed);
        const hs = this._sinceMap[entry.entity];
        if (hs !== undefined) {
          if (hs.t === null) { m.since = null; m.sinceLong = true; }
          else m.since = new Date(hs.t);
        }
        m.updated = parseDate(so.last_updated);
        m.picture = typeof a.entity_picture === 'string' && /^(\/|https?:\/\/)/.test(a.entity_picture) ? a.entity_picture : null;
        if (home && m.lat !== null && m.lon !== null && (m.status === 'away' || m.status === 'zone')) {
          const kx = 111320 * Math.cos((home.lat * Math.PI) / 180);
          const dx = (m.lon - home.lon) * kx;
          const dy = (m.lat - home.lat) * 110574;
          m.dist = Math.hypot(dx, dy);
          m.bearing = Math.atan2(dx, dy);
        }
        let b = null;
        let charging = a.battery_charging === true;
        if (entry.battery_entity && h.states[entry.battery_entity]) b = num(h.states[entry.battery_entity].state);
        if (b === null) b = num(a.battery_level ?? a.battery);
        if (b === null && typeof a.source === 'string' && h.states[a.source]) {
          const sa = h.states[a.source].attributes || {};
          b = num(sa.battery_level ?? sa.battery);
          if (sa.battery_charging === true) charging = true;
        }
        m.battery = b !== null && b >= 0 && b <= 100 ? Math.round(b) : null;
        m.charging = m.battery !== null && (charging || this._isCharging(entry.charging_entity));
        if (entry.location_entity && h.states[entry.location_entity]) {
          const lv = String(h.states[entry.location_entity].state ?? '').trim();
          m.place = lv && !NOT_KNOWN.includes(lv) ? lv.slice(0, 120) : null;
        }
        if (entry.watch_battery_entity) {
          const wo = h.states[entry.watch_battery_entity];
          const wv = wo ? num(wo.state) : null;
          m.watch = {
            battery: wv !== null && wv >= 0 && wv <= 100 ? Math.round(wv) : null,
            charging: this._isCharging(entry.watch_charging_entity),
          };
        }
        if (typeof a.source === 'string' && h.states[a.source]) m.sourceName = h.states[a.source].attributes?.friendly_name || a.source;
        return m;
      };
      return this._cfg.people.map(build);
    }

    _isCharging(id) {
      const so = id && this._hass.states[id];
      return !!so && so.state === 'on';
    }

    _devModels() {
      const h = this._hass;
      return this._cfg.devices.map((e) => {
        const so = h.states[e.entity];
        const d = { id: e.entity, entry: e, kind: 'device', type: e.type, name: e.name || so?.attributes?.friendly_name || e.entity, so, battery: null, charging: false };
        if (!so) { d.status = 'missing'; return d; }
        const a = so.attributes || {};
        d.status = so.state === 'unknown' ? 'unknown' : so.state === 'unavailable' ? 'unavailable' : 'ok';
        const raw = e.entity.startsWith('device_tracker.') ? num(a.battery_level ?? a.battery) : d.status === 'ok' ? num(so.state) : null;
        d.battery = raw !== null && raw >= 0 && raw <= 100 ? Math.round(raw) : null;
        d.charging = d.battery !== null && (a.battery_charging === true || this._isCharging(e.charging_entity));
        d.updated = parseDate(so.last_updated);
        return d;
      });
    }

    _signature(models) {
      const home = this._home();
      return JSON.stringify([
        this._isDark(), this._lang(), this._hass.config?.unit_system?.length,
        home && [home.lat.toFixed(4), home.lon.toFixed(4), home.radius],
        models.map((m) => [
          m.id, m.name, m.status, m.state, m.since && m.since.getTime(), m.sinceLong,
          m.updated && Math.floor(m.updated.getTime() / 60000),
          m.lat != null ? m.lat.toFixed(4) : null, m.lon != null ? m.lon.toFixed(4) : null,
          m.battery, m.charging, m.picture, m.accuracy, m.sourceName, m.place, m.watch && [m.watch.battery, m.watch.charging],
        ]),
        this._devs.map((d) => [d.id, d.name, d.type, d.status, d.battery, d.charging, d.updated && Math.floor(d.updated.getTime() / 60000)]),
      ]);
    }

    _update() {
      const models = this._model();
      this._models = models;
      this._devs = this._devModels();
      this._refreshSince();
      const sig = this._signature(models);
      if (sig === this._sig) return;
      this._sig = sig;
      this._renderMain();
      if (this._open) this._renderBody();
    }

    /* Orario "dalle…" preciso: dopo un riavvio di Home Assistant last_changed riparte dall'ora del riavvio,
       quindi si ricava dallo storico (una richiesta, ripetuta solo quando cambia uno stato). */
    _refreshSince() {
      const h = this._hass;
      if (!h || typeof h.callWS !== 'function') return;
      const ids = this._models.filter((m) => m.so).map((m) => m.id);
      const key = this._models.map((m) => `${m.id}=${m.state}`).join('|');
      if (!ids.length || key === this._sinceKey) return;
      this._sinceKey = key;
      const now = Date.now();
      const startMs = now - 168 * 3600000;
      const cur = Object.fromEntries(this._models.map((m) => [m.id, m.state]));
      Promise.resolve(
        h.callWS({
          type: 'history/history_during_period',
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: ids,
          include_start_time_state: true,
          significant_changes_only: false,
          minimal_response: true,
          no_attributes: true,
        }),
      )
        .then((res) => {
          const map = {};
          ids.forEach((id) => {
            const arr = ((res && res[id]) || [])
              .map((e) => ({ s: e.s ?? e.state, t: typeof (e.lc ?? e.lu) === 'number' ? (e.lc ?? e.lu) * 1000 : Date.parse(e.lc ?? e.lu ?? e.last_changed ?? e.last_updated) }))
              .filter((x) => x.s != null && Number.isFinite(x.t))
              .sort((a, b) => a.t - b.t);
            if (!arr.length) return;
            let i = arr.length - 1;
            while (i >= 0 && arr[i].s === cur[id]) i--;
            if (i === arr.length - 1) return;
            if (i >= 0) map[id] = { t: arr[i + 1].t };
            else map[id] = arr[0].t <= startMs + 5000 ? { t: null } : { t: arr[0].t };
          });
          this._sinceMap = map;
          this._sig = '';
          this._update();
        })
        .catch(() => {});
    }

    /* ---------- rendering: card ---------- */

    _headHtml(models) {
      const c = this._cfg;
      let counts = '';
      if (models && models.length) {
        const home = models.filter((m) => m.status === 'home').length;
        const unk = models.filter((m) => ['unknown', 'unavailable', 'missing'].includes(m.status)).length;
        counts = `<div class="pc-counts">
          <span class="pc-cnt" title="${home} su ${models.length} in casa">${icon('home')}${home}/${models.length}</span>
          ${unk ? `<span class="pc-cnt pc-unk" title="${unk} con posizione sconosciuta o non disponibile">${icon('help-circle-outline')}${unk}</span>` : ''}
        </div>`;
      }
      const eyebrow = c.show_eyebrow && c.eyebrow ? `<div class="pc-eyebrow">${esc(c.eyebrow)}</div>` : '';
      const title = c.show_title && c.title ? `<h2 class="pc-title">${esc(c.title)}<b>.</b></h2>` : '';
      return `<div class="pc-head"><div class="pc-titles">${eyebrow}${title}</div>${counts}</div>`;
    }

    _wrap(inner) {
      return `<div class="pc-container"><div class="pc-root ${this._isDark() ? 'pc-dark' : 'pc-light'}">${inner}</div></div>`;
    }

    _renderSkeleton() {
      const c = this._cfg;
      const n = c.people.length;
      const nd = c.devices.length;
      const main = this.shadowRoot.getElementById('main');
      if (!n && !nd) {
        main.innerHTML = this._wrap(`${this._headHtml(null)}${this._emptyHtml()}`);
        return;
      }
      const sk = (k) => Array.from({ length: k }, () => '<div class="pc-sk"></div>').join('');
      const hasMap = c.show_map && n > 0;
      main.innerHTML = this._wrap(`${this._headHtml(null)}
        <div class="pc-body ${hasMap ? 'pc-hasmap' : ''}"><div class="pc-col"><div class="pc-list">${sk(n + nd)}</div></div>${hasMap ? '<div class="pc-col"><div class="pc-skmap"></div></div>' : ''}
        <div class="pc-foot"><div class="pc-skdetail"></div></div></div>`);
    }

    _emptyHtml() {
      return `<div class="pc-empty">${icon('account-multiple-outline')}<b>Nessuna persona</b><span>Aggiungi le persone dall'editor della card.</span></div>`;
    }

    _avatarHtml(m) {
      if (m.picture) return `<img src="${esc(m.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
      const ch = (m.name || '?').trim().charAt(0).toUpperCase();
      return esc(ch || '?');
    }

    _statusInfo(m) {
      switch (m.status) {
        case 'home': return { icon: 'home', label: 'A casa' };
        case 'zone': return { icon: 'map-marker', label: m.zone };
        case 'away': return { icon: 'home-export-outline', label: 'Fuori casa' };
        case 'unknown': return { icon: 'help-circle-outline', label: 'Posizione sconosciuta' };
        case 'unavailable': return { icon: 'cloud-off-outline', label: 'Non disponibile' };
        default: return { icon: 'alert-circle-outline', label: 'Entità non trovata' };
      }
    }

    _subText(m) {
      const info = this._statusInfo(m);
      if (['unknown', 'unavailable', 'missing'].includes(m.status)) return `<span>${esc(info.label)}</span>`;
      const parts = [`<span>${esc(info.label)}</span>`];
      if (m.since) parts.push(`<span>${esc(this._sinceText(m.since))}</span>`);
      else if (m.sinceLong) parts.push('<span>da oltre 7 giorni</span>');
      if (m.status !== 'home' && m.dist !== undefined) parts.push(`<span>${esc(this._fmtDist(m.dist))}</span>`);
      return parts.join('<span aria-hidden="true">·</span>');
    }

    _batItems(m, force = false) {
      const items = [];
      if (!force && !this._cfg.show_battery) return items;
      const dev = m.kind === 'device';
      if (m.battery !== null && m.battery !== undefined) {
        const label = dev ? DEVICE_TYPES[m.type].label : 'Telefono';
        items.push({ level: m.battery, charging: !!m.charging, ic: dev ? DEVICE_TYPES[m.type].icon : 'cellphone', title: `${label} ${m.battery}%${m.charging ? ' · in carica' : ''}` });
      }
      if (m.watch && m.watch.battery !== null) {
        items.push({ level: m.watch.battery, charging: !!m.watch.charging, ic: 'watch', title: `Orologio ${m.watch.battery}%${m.watch.charging ? ' · in carica' : ''}` });
      }
      return items;
    }

    _bolt() {
      return '<ha-icon class="pc-bolt" icon="mdi:lightning-bolt" aria-hidden="true"></ha-icon>';
    }

    _ringSvg(level, r, size) {
      const C = 2 * Math.PI * r;
      const off = (C * (1 - Math.max(0, Math.min(100, level)) / 100)).toFixed(2);
      const gid = `pcg${++this._gid}`;
      const c = size / 2;
      return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop class="s1" offset="0"/><stop class="s2" offset="1"/></linearGradient></defs><circle class="pc-rf" cx="${c}" cy="${c}" r="${(r - 3).toFixed(1)}"/><circle class="pc-rt" cx="${c}" cy="${c}" r="${r}"/><circle class="pc-rp" cx="${c}" cy="${c}" r="${r}" stroke="url(#${gid})" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off}"/></svg>`;
    }

    _ringA(i) {
      return `<span class="pc-rb tn-${batteryTone(i.level)}" title="${esc(i.title)}"><span class="pc-rg">${this._ringSvg(i.level, 16, 38)}${icon(i.ic)}${i.charging ? this._bolt() : ''}</span><span class="pc-pct">${i.level}%</span></span>`;
    }

    _ringB(i) {
      return `<span class="pc-rb pc-rbb tn-${batteryTone(i.level)}" title="${esc(i.title)}"><span class="pc-rg pc-rgb">${this._ringSvg(i.level, 17, 40)}<span class="pc-pin">${i.level}<small>%</small></span>${i.charging ? this._bolt() : ''}<span class="pc-dv">${icon(i.ic)}</span></span></span>`;
    }

    _pill(i) {
      return `<span class="pc-pl tn-${batteryTone(i.level)}" title="${esc(i.title)}"><span class="pc-plf" style="width:${Math.max(6, i.level)}%"></span><span class="pc-plc">${icon(i.ic)}<span class="pc-plr">${i.charging ? '<ha-icon icon="mdi:lightning-bolt" aria-hidden="true"></ha-icon>' : ''}<b>${i.level}%</b></span></span></span>`;
    }

    _concentric(items) {
      const col = (l) => `var(--${batteryTone(l) === 'ok' ? 'pc-accent' : batteryTone(l) === 'warn' ? 'pc-warn' : 'pc-alert'})`;
      const mk = (i, r, cls) => {
        const C = 2 * Math.PI * r;
        const off = (C * (1 - i.level / 100)).toFixed(2);
        return `<circle class="pc-rt" cx="23" cy="23" r="${r}"/><circle class="pc-rp ${cls}" cx="23" cy="23" r="${r}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off}"/>`;
      };
      const [a, b] = items;
      const svg = `<svg viewBox="0 0 46 46" aria-hidden="true" focusable="false">${mk(a, 19, 'o')}${b ? mk(b, 12.4, 'i') : ''}</svg>`;
      const style = `--to:${col(a.level)};${b ? `--ti:${col(b.level)}` : ''}`;
      const line = (i) => `<span class="pc-dl tn-${batteryTone(i.level)}" title="${esc(i.title)}">${icon(i.ic)}${i.level}%${i.charging ? '<ha-icon class="pc-bolt2" icon="mdi:lightning-bolt" aria-hidden="true"></ha-icon>' : ''}</span>`;
      return `<span class="pc-cr" style="${style}">${svg}</span><span class="pc-cl">${items.map(line).join('')}</span>`;
    }

    _batsHtml(m, force = false) {
      const items = this._batItems(m, force);
      if (!items.length) return '';
      const st = this._cfg.battery_style;
      const inner = st === 'b' ? items.map((i) => this._ringB(i)).join('')
        : st === 'c' ? items.map((i) => this._pill(i)).join('')
        : st === 'd' ? this._concentric(items)
        : items.map((i) => this._ringA(i)).join('');
      return `<div class="pc-bats pc-bs-${st}">${inner}</div>`;
    }

    _devStatus(d) {
      if (d.status === 'ok') return { icon: 'clock-outline', label: d.updated ? `Ultimo dato ${this._dayTime(d.updated.getTime())}` : 'Dato disponibile', chip: 'Disponibile' };
      if (d.status === 'missing') return { icon: 'alert-circle-outline', label: 'Entità non trovata', chip: 'Non trovato' };
      return { icon: d.status === 'unknown' ? 'help-circle-outline' : 'cloud-off-outline', label: 'Non disponibile', chip: 'Non disponibile' };
    }

    _devRowHtml(d) {
      const info = this._devStatus(d);
      return `<div class="pc-row pc-st-${d.status}" role="button" tabindex="0" data-act="open" data-id="${esc(d.id)}" aria-label="${esc(d.name)}: ${esc(info.label)}">
        <div class="pc-avatar">${icon(DEVICE_TYPES[d.type].icon)}</div>
        <div class="pc-meta"><span class="pc-name">${esc(d.name)}</span><div class="pc-sub">${icon(info.icon)}<span>${esc(info.label)}</span></div></div>
        ${this._batsHtml(d, true)}
      </div>`;
    }

    _rowHtml(m) {
      const info = this._statusInfo(m);
      return `<div class="pc-row pc-st-${m.status}" role="button" tabindex="0" data-act="open" data-id="${esc(m.id)}" aria-label="${esc(m.name)}: ${esc(info.label)}">
        <div class="pc-avatar">${this._avatarHtml(m)}</div>
        <div class="pc-meta"><span class="pc-name">${esc(m.name)}</span><div class="pc-sub">${icon(info.icon)}${this._subText(m)}</div></div>
        ${this._batsHtml(m)}
      </div>`;
    }

    _mapHtml(models) {
      const c = this._cfg;
      const home = this._home();
      if (!c.show_map || !home) return '';
      const H = 100;
      const W = 160;
      const RMIN = 0.2;
      const RMAX = 0.42;
      const atHome = models.filter((m) => m.status === 'home');
      const away = models.filter((m) => m.dist !== undefined);
      const noloc = models.filter((m) => m.status !== 'home' && m.dist === undefined);
      const d0 = Math.max(home.radius || 100, 100);
      const dmax = Math.max(1, ...away.map((m) => m.dist));
      const f = (d) => RMIN + (RMAX - RMIN) * Math.sqrt(Math.min(1, d / dmax));
      const rings = NICE.filter((v) => v > d0 && v <= dmax * 1.0001).slice(-2);

      const pts = away.map((m) => {
        const r = f(m.dist);
        return { m, x: r * Math.sin(m.bearing), y: -r * Math.cos(m.bearing) };
      });
      const SX = 0.2;
      const SY = 0.3;
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      for (let it = 0; it < 12; it++) {
        for (let i = 1; i < pts.length; i++) {
          for (let j = 0; j < i; j++) {
            let dx = (pts[i].x - pts[j].x) / SX;
            let dy = (pts[i].y - pts[j].y) / SY;
            let d = Math.hypot(dx, dy);
            if (d >= 1) continue;
            if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
            const k = (1 - d) / 2 / d;
            pts[i].x += dx * k * SX; pts[i].y += dy * k * SY;
            pts[j].x -= dx * k * SX; pts[j].y -= dy * k * SY;
          }
        }
        pts.forEach((p) => {
          const rr = Math.hypot(p.x, p.y);
          if (rr < RMIN && rr > 1e-6) { p.x *= RMIN / rr; p.y *= RMIN / rr; }
          p.x = clamp(p.x, -0.7, 0.7);
          p.y = clamp(p.y, -0.3, 0.26);
        });
      }
      const marks = pts
        .map(({ m, x, y }) => `<div class="pc-mk pc-st-${m.status}" style="left:${(50 + (x / (W / H)) * 100).toFixed(2)}%;top:${(50 + y * 100).toFixed(2)}%" title="${esc(m.name)}">
          <div class="pc-avatar">${this._avatarHtml(m)}</div><div class="pc-tag">${esc(m.name.split(' ')[0])}</div></div>`)
        .join('');

      const spots = pts.map((p) => [W / 2 + p.x * H, H / 2 + p.y * H]);
      const ringSvg = rings
        .map((v) => {
          const r = f(v) * H;
          const cands = [
            { x: W / 2 + r + 1.4, y: H / 2 - 1, a: 'start' },
            { x: W / 2 - r - 1.4, y: H / 2 - 1, a: 'end' },
            { x: W / 2 + 1.4, y: H / 2 + r + 4.2, a: 'start' },
            { x: W / 2 + 1.4, y: H / 2 - r - 1.2, a: 'start' },
          ];
          const score = (cd) => Math.min(99, ...spots.map(([sx, sy]) => Math.hypot(sx - (cd.x + (cd.a === 'end' ? -7 : 7)), sy - cd.y)), cd.x < 8 || cd.x > W - 8 ? 0 : 99);
          const best = cands.reduce((a, b) => (score(b) > score(a) ? b : a));
          return `<circle class="pc-ring" cx="${W / 2}" cy="${H / 2}" r="${r.toFixed(2)}"/><text class="pc-rlabel" x="${best.x.toFixed(2)}" y="${best.y.toFixed(2)}" text-anchor="${best.a}">${esc(this._fmtDist(v))}</text>`;
        })
        .join('');
      const svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
        <line class="pc-axis" x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}"/><line class="pc-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>${ringSvg}</svg>`;

      const badge = atHome.length ? `<span class="pc-hbadge">${atHome.length}</span>` : '';
      const homeTitle = atHome.length ? `In casa: ${atHome.map((m) => m.name).join(', ')}` : 'Casa';
      const btn = c.map_path
        ? `<button class="pc-mapbtn" type="button" data-act="map" aria-label="Apri la mappa di Home Assistant" title="Apri la mappa">${icon('open-in-new')}</button>`
        : '';
      const nl = noloc.length ? `<span class="pc-noloc">Senza posizione: ${esc(noloc.map((m) => m.name).join(', '))}</span>` : '';
      return `<div class="pc-map" role="img" aria-label="Mappa schematica delle distanze da casa">${svg}<div class="pc-homec" title="${esc(homeTitle)}">${icon('home')}${badge}</div>${marks}<div class="pc-mapfoot"><span>Distanza da casa</span>${nl}</div>${btn}</div>`;
    }

    _renderMain() {
      const models = this._models;
      const devs = this._devs;
      const main = this.shadowRoot.getElementById('main');
      if (!models.length && !devs.length) {
        main.innerHTML = this._wrap(`${this._headHtml(null)}${this._emptyHtml()}`);
        return;
      }
      const map = models.length ? this._mapHtml(models) : '';
      main.innerHTML = this._wrap(`${this._headHtml(models)}
        <div class="pc-body ${map ? 'pc-hasmap' : ''}">
          <div class="pc-col"><div class="pc-list">${models.map((m) => this._rowHtml(m)).join('')}${devs.map((d) => this._devRowHtml(d)).join('')}</div></div>
          ${map ? `<div class="pc-col">${map}</div>` : ''}
          <div class="pc-foot"><button class="pc-detail" type="button" data-act="open" data-id="">Dettagli e stato ${icon('chevron-right')}</button></div>
        </div>`);
    }

    /* ---------- interazione ---------- */

    _onRowKey(e) {
      const row = e.target.closest?.('.pc-row');
      if ((e.key === 'Enter' || e.key === ' ') && row) {
        e.preventDefault();
        this._openDialog(row.dataset.id || null, row);
      }
    }

    _onClick(e) {
      const t = e.target;
      if (t.classList?.contains('pc-backdrop')) return this._close();
      const rng = t.closest?.('[data-range]');
      if (rng) return this._setRange(Number(rng.dataset.range));
      const act = t.closest?.('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'open') this._openDialog(act.dataset.id || null, act);
      else if (a === 'close') this._close();
      else if (a === 'map') this._openMap();
    }

    _openMap() {
      const p = this._cfg.map_path;
      if (!p) return;
      this._close();
      window.history.pushState(null, '', p);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false }, bubbles: true, composed: true }));
    }

    _onKey(e) {
      if (e.key === 'Escape' && this._open) {
        e.stopPropagation();
        this._close();
      }
    }

    _lockScroll() {
      const overlay = this.shadowRoot.querySelector('.pc-backdrop');
      if (!overlay) return;
      const body = overlay.querySelector('.pc-mbody');
      const atEdge = (dy) => !body || (dy < 0 && body.scrollTop <= 0) || (dy > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1);
      overlay.addEventListener('wheel', (e) => { if (!body || !body.contains(e.target) || atEdge(e.deltaY)) e.preventDefault(); }, { passive: false });
      let y = 0;
      overlay.addEventListener('touchstart', (e) => { const t = e.touches[0]; y = t ? t.clientY : 0; }, { passive: true });
      overlay.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        const dy = y - (t ? t.clientY : y);
        if (!body || !body.contains(e.target) || atEdge(dy)) e.preventDefault();
      }, { passive: false });
    }

    /* ---------- popup ---------- */

    _openDialog(focusId, opener) {
      if (this._open) return;
      this._open = true;
      this._focusId = focusId;
      this._opener = opener || null;
      this._range = this._cfg.history_hours;
      const ov = this.shadowRoot.getElementById('ov');
      ov.innerHTML = `<div class="pc-backdrop ${this._isDark() ? 'pc-dark' : 'pc-light'}"><div class="pc-dialog" role="dialog" aria-modal="true" aria-labelledby="pc-mt" tabindex="-1">
        <div class="pc-mhead"><h2 class="pc-mtitle" id="pc-mt">Dettagli presenza</h2><button type="button" class="pc-close" data-act="close" aria-label="Chiudi">${icon('close')}</button></div>
        <div class="pc-mbody" id="db"></div></div></div>`;
      document.addEventListener('keydown', this._onKey, true);
      this._renderBody();
      this._lockScroll();
      this.shadowRoot.querySelector('.pc-dialog').focus({ preventScroll: true });
      this._loadHistory();
    }

    _close() {
      if (!this._open) return;
      this._open = false;
      this.shadowRoot.getElementById('ov').innerHTML = '';
      document.removeEventListener('keydown', this._onKey, true);
      const op = this._opener;
      this._opener = null;
      if (op && op.isConnected) op.focus({ preventScroll: true });
    }

    _setRange(h) {
      if (!RANGES.some((r) => r.h === h) || h === this._range) return;
      this._range = h;
      this._loadHistory();
    }

    async _loadHistory() {
      const key = this._range;
      const h = this._hass;
      if (this._hist && this._hist.key === key && !this._hist.error && !this._hist.loading && Date.now() - this._hist.at < 60000) {
        this._renderBody();
        return;
      }
      this._hist = { key, loading: true, at: Date.now() };
      this._renderBody();
      const ids = this._models.map((m) => m.id);
      try {
        if (!h || typeof h.callWS !== 'function' || !ids.length) throw new Error('no-ws');
        const now = Date.now();
        const startMs = now - key * 3600000;
        const res = await h.callWS({
          type: 'history/history_during_period',
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: ids,
          include_start_time_state: true,
          significant_changes_only: false,
          minimal_response: true,
          no_attributes: true,
        });
        if (!this._hist || this._hist.key !== key) return;
        this._hist = { key, loading: false, at: Date.now(), data: res || {}, startMs };
      } catch (err) {
        if (!this._hist || this._hist.key !== key) return;
        this._hist = { key, loading: false, at: Date.now(), error: true };
      }
      if (this._open) this._renderBody();
    }

    _events(id) {
      const hs = this._hist;
      if (!hs || !hs.data) return null;
      const toMs = (v) => (typeof v === 'number' ? v * 1000 : Date.parse(v));
      const arr = (hs.data[id] || [])
        .map((e) => ({ s: e.s ?? e.state, t: toMs(e.lc ?? e.lu ?? e.last_changed ?? e.last_updated) }))
        .filter((x) => x.s != null && Number.isFinite(x.t))
        .sort((a, b) => a.t - b.t);
      const events = [];
      const known = (s) => s && !NOT_KNOWN.includes(s);
      let prev = null;
      let prevIsEvent = false;
      let prevT = null;
      arr.forEach((x, i) => {
        const isBaseline = i === 0 && x.t <= hs.startMs + 5000;
        if (prev && prev.s === x.s) return;
        if (prev && NOT_KNOWN.includes(prev.s) && NOT_KNOWN.includes(x.s)) {
          prev = x;
          return;
        }
        if (!isBaseline) {
          const ev = { t: x.t, kind: 'neutral', icon: 'map-marker-outline', label: '', sub: '', isExit: false, isReturn: false };
          const pw = prev ? prev.s : null;
          const inFor = prevIsEvent && prevT !== null ? `In casa per ${this._fmtDur(x.t - prevT)}` : '';
          if (x.s === 'home') {
            ev.kind = 'good';
            if (known(pw)) {
              ev.label = 'Rientro a casa'; ev.icon = 'home-import-outline'; ev.isReturn = true;
              if (prevIsEvent && prevT !== null) ev.sub = `Fuori casa per ${this._fmtDur(x.t - prevT)}`;
            } else { ev.label = 'A casa'; ev.icon = 'home'; }
          } else if (x.s === 'not_home') {
            if (pw === 'home') { ev.label = 'Uscita di casa'; ev.icon = 'home-export-outline'; ev.isExit = true; ev.sub = inFor; }
            else if (known(pw)) ev.label = `Partenza da ${pw}`;
            else ev.label = 'Fuori casa';
          } else if (x.s === 'unknown') {
            ev.kind = 'grey'; ev.icon = 'help-circle-outline'; ev.label = 'Posizione sconosciuta';
          } else if (x.s === 'unavailable') {
            ev.kind = 'grey'; ev.icon = 'cloud-off-outline'; ev.label = 'Non disponibile';
          } else {
            ev.kind = 'good'; ev.icon = 'map-marker'; ev.label = `Arrivo: ${x.s}`;
            if (pw === 'home') { ev.isExit = true; ev.sub = inFor || 'Uscita di casa'; }
          }
          events.push(ev);
          prevIsEvent = true;
        } else {
          prevIsEvent = false;
        }
        prev = x;
        prevT = x.t;
      });
      return events;
    }

    _entHtml(m) {
      const info = this._statusInfo(m);
      const rows = [];
      const metric = (l, v, cls = '') => rows.push(`<div class="pc-metric"><span>${esc(l)}</span><strong class="${cls}">${esc(v)}</strong></div>`);
      if (m.dist !== undefined) metric('Distanza da casa', this._fmtDist(m.dist));
      if (this._cfg.show_battery && m.battery !== null && m.battery !== undefined) {
        const tone = batteryTone(m.battery);
        metric('Batteria', `${m.battery}%${m.charging ? ' · in carica' : ''}`, tone === 'ok' ? '' : tone);
      }
      if (this._cfg.show_battery && m.watch) {
        if (m.watch.battery === null) metric('Orologio · batteria', 'Non disponibile');
        else {
          const wt = batteryTone(m.watch.battery);
          metric('Orologio · batteria', `${m.watch.battery}%${m.watch.charging ? ' · in carica' : ''}`, wt === 'ok' ? '' : wt);
        }
      }
      if (m.since) metric('Ultimo cambio', this._dayTime(m.since.getTime()));
      else if (m.sinceLong) metric('Ultimo cambio', 'Oltre 7 giorni fa');
      if (m.updated && (!m.since || Math.abs(m.updated - m.since) > 60000)) metric('Aggiornato', this._dayTime(m.updated.getTime()));
      if (m.accuracy != null && !['unknown', 'unavailable', 'missing'].includes(m.status)) metric('Precisione GPS', this._fmtDist(m.accuracy));
      if (m.place) metric('Posizione', m.place);
      if (m.sourceName) metric('Sorgente', m.sourceName);

      const hs = this._hist;
      let sums = '';
      let hist = '';
      if (!hs || hs.loading) hist = '<div class="pc-note">Carico lo storico…</div>';
      else if (hs.error) hist = '<div class="pc-note">Storico non disponibile.</div>';
      else {
        const evs = this._events(m.id) || [];
        const lastExit = [...evs].reverse().find((e) => e.isExit);
        const lastRet = [...evs].reverse().find((e) => e.isReturn);
        const chips = [];
        if (lastExit) chips.push(`<span class="pc-sumc out">${icon('home-export-outline')}Ultima uscita <b>${esc(this._dayTime(lastExit.t))}</b></span>`);
        if (lastRet) chips.push(`<span class="pc-sumc in">${icon('home-import-outline')}Ultimo rientro <b>${esc(this._dayTime(lastRet.t))}</b></span>`);
        if (lastExit && lastRet && lastRet.t > lastExit.t) chips.push(`<span class="pc-sumc">${icon('timer-outline')}Fuori casa per <b>${esc(this._fmtDur(lastRet.t - lastExit.t))}</b></span>`);
        sums = chips.length ? `<div class="pc-sums">${chips.join('')}</div>` : '';
        if (!evs.length) hist = '<div class="pc-note">Nessuno spostamento nel periodo.</div>';
        else {
          let day = '';
          const out = [];
          [...evs].reverse().slice(0, 40).forEach((e) => {
            const dk = this._dayKey(e.t);
            if (dk !== day) { day = dk; out.push(`<div class="pc-dg">${esc(this._dayLabel(e.t))}</div>`); }
            out.push(`<div class="pc-ev ${e.kind}"><div class="pc-et">${esc(this._fmtTime(e.t))}</div><div class="pc-ed">${icon(e.icon)}</div><div><div class="pc-el">${esc(e.label)}</div>${e.sub ? `<div class="pc-es">${esc(e.sub)}</div>` : ''}</div></div>`);
          });
          hist = `<div><div class="pc-hh">Spostamenti recenti</div>${out.join('')}</div>`;
        }
      }
      const popSub = ['unknown', 'unavailable', 'missing'].includes(m.status) ? '' : m.sinceLong ? 'da oltre 7 giorni' : this._sinceText(m.since);
      return `<section class="pc-ent pc-st-${m.status}" data-ent="${esc(m.id)}">
        <div class="pc-eh"><div class="pc-avatar">${this._avatarHtml(m)}</div>
          <div class="pc-meta"><span class="pc-name">${esc(m.name)}</span>${popSub ? `<div class="pc-sub"><span>${esc(popSub)}</span></div>` : ''}</div>
          <span class="pc-chip">${icon(info.icon)}<span>${esc(info.label)}</span></span></div>
        ${sums}${rows.length ? `<div class="pc-metrics">${rows.join('')}</div>` : ''}${hist}</section>`;
    }

    _devEntHtml(d) {
      const info = this._devStatus(d);
      const rows = [];
      const metric = (l, v, cls = '') => rows.push(`<div class="pc-metric"><span>${esc(l)}</span><strong class="${cls}">${esc(v)}</strong></div>`);
      metric('Tipo', DEVICE_TYPES[d.type].label);
      if (d.battery !== null) {
        const tone = batteryTone(d.battery);
        metric('Batteria', `${d.battery}%${d.charging ? ' · in carica' : ''}`, tone === 'ok' ? '' : tone);
      }
      if (d.updated) metric('Ultimo dato', this._dayTime(d.updated.getTime()));
      return `<section class="pc-ent pc-st-${d.status}" data-ent="${esc(d.id)}">
        <div class="pc-eh"><div class="pc-avatar">${icon(DEVICE_TYPES[d.type].icon)}</div>
          <div class="pc-meta"><span class="pc-name">${esc(d.name)}</span></div>
          <span class="pc-chip">${icon(info.icon)}<span>${esc(info.chip)}</span></span></div>
        <div class="pc-metrics">${rows.join('')}</div></section>`;
    }

    _renderBody() {
      const db = this.shadowRoot.getElementById('db');
      if (!db) return;
      const top = db.scrollTop;
      const seg = `<div class="pc-seg" role="group" aria-label="Periodo dello storico">${RANGES.map((r) => `<button type="button" data-range="${r.h}" aria-pressed="${r.h === this._range}">${r.label}</button>`).join('')}</div>`;
      db.innerHTML = seg + this._models.map((m) => this._entHtml(m)).join('') + this._devs.map((d) => this._devEntHtml(d)).join('');
      if (this._focusId) {
        const sec = [...db.querySelectorAll('[data-ent]')].find((s) => s.dataset.ent === this._focusId);
        if (sec) { sec.classList.add('pc-hl'); db.scrollTop = Math.max(0, sec.offsetTop - 12); }
        if (this._hist && !this._hist.loading) this._focusId = null;
      } else {
        db.scrollTop = top;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 6. Editor visuale (stesso schema di Weather Pulse e Camera Grid)    */
  /* ------------------------------------------------------------------ */

  const EDITOR_CSS = `
:host{display:block;color:var(--primary-text-color,#18221c);font-family:var(--ha-font-family-body,Roboto,Arial,sans-serif);font-size:var(--ha-font-size-m,14px)}
*,*:before,*:after{box-sizing:border-box}
.pc-editor{display:block}
.pc-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:14px;border-bottom:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent))}
.pc-tab{border:0;background:none;color:var(--secondary-text-color,#536359);border-radius:13px;padding:10px 13px;white-space:nowrap;font:inherit;cursor:pointer}
.pc-tab.active{color:var(--primary-text-color,#18221c);background:var(--secondary-background-color,color-mix(in srgb,var(--primary-text-color,#18221c) 7%,transparent));font-weight:650}
.pc-heading{font-size:21px;font-weight:500;margin:25px 0 9px}
.pc-desc{color:var(--secondary-text-color,#55665a);font-size:13px;line-height:1.5;margin-bottom:24px}
.pc-field{display:block;margin:20px 0}
.pc-label{font-size:14px;margin-bottom:10px}
.pc-input{display:block;width:100%;background:var(--secondary-background-color,color-mix(in srgb,var(--primary-text-color,#18221c) 7%,transparent));color:var(--primary-text-color,#18221c);border:0;border-bottom:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));padding:14px 13px;min-height:50px;border-radius:11px 11px 0 0;font:inherit}
.pc-editor ha-selector{display:block;width:100%}
.pc-fallback{display:none}.pc-no-native .pc-fallback{display:block}
.pc-row-opt{border-bottom:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:15px}
.pc-row-opt label{flex:1}.pc-row-opt input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary-color,#0c7157)}
.pc-muted{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#5e6c62)}
.pc-action{background:var(--secondary-background-color,color-mix(in srgb,var(--primary-text-color,#18221c) 7%,transparent));border:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));color:var(--primary-text-color,#18221c);padding:10px 14px;border-radius:14px;font:inherit;cursor:pointer}
.pc-action:disabled{opacity:.45;cursor:not-allowed}
.pc-tiny{font-size:11px;color:var(--secondary-text-color,#55665a);margin:9px 0}
.pc-input:focus-visible,.pc-action:focus-visible,.pc-tab:focus-visible,.pc-clear:focus-visible,.pc-chipbtn:focus-visible{outline:2px solid var(--primary-color,#0b7457);outline-offset:2px}
.pc-more{margin:19px 0 10px;border-bottom:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));padding:0 0 11px}
.pc-more summary{cursor:pointer;padding:13px 4px;color:var(--secondary-text-color,#56665d);font-size:13px;list-style:none}
.pc-more summary:before{content:"▸";font-size:10px;margin-right:10px}
.pc-more[open] summary:before{content:"▾"}.pc-more summary::-webkit-details-marker{display:none}
.pc-more-body{padding:2px 0 8px}
.pc-selector-line{display:flex;align-items:center;gap:8px;min-width:0}
.pc-selector-grow{flex:1;min-width:0}
.pc-clear{display:flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;background:var(--secondary-background-color,color-mix(in srgb,var(--primary-text-color,#18221c) 7%,transparent));border:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));border-radius:50%;cursor:pointer;color:var(--secondary-text-color,#57655c);padding:0}
.pc-clear ha-icon{width:18px;height:18px;--mdc-icon-size:18px}
.pc-group{padding-bottom:20px}
.pc-person-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}
.pc-person-head strong{font-size:15px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-person-picker{display:flex;gap:5px;overflow-x:auto;border-bottom:1px solid var(--divider-color,color-mix(in srgb,var(--primary-text-color,#18221c) 16%,transparent));padding:14px 0 12px}
.pc-chipbtn{border:0;border-radius:13px;padding:10px 12px;flex:none;background:none;color:var(--secondary-text-color,#536359);font:inherit;font-size:13px;cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-chipbtn.active{background:var(--secondary-background-color,color-mix(in srgb,var(--primary-text-color,#18221c) 7%,transparent));color:var(--primary-text-color,#18221c);font-weight:650}
.pc-controls{display:flex;gap:6px;flex:none;align-items:center}
.pc-controls .pc-action{padding:5px 9px;border-radius:10px}
.pc-addrow{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 25px}
`;

  const emptyPerson = () => ({ entity: '', name: '', battery_entity: '', charging_entity: '', location_entity: '', watch_battery_entity: '', watch_charging_entity: '' });
  const emptyDevice = () => ({ entity: '', name: '', type: 'tablet', charging_entity: '' });
  const S = (v) => (typeof v === 'string' ? v : '');
  const asObj = (p) => (typeof p === 'string' ? { entity: p } : p && typeof p === 'object' ? p : {});

  function editorConfig(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const base = normalize({ ...r, people: [], devices: [] });
    const people = (Array.isArray(r.people) ? r.people : []).map((p) => {
      const o = asObj(p);
      return { entity: S(o.entity), name: S(o.name), battery_entity: S(o.battery_entity), charging_entity: S(o.charging_entity), location_entity: S(o.location_entity), watch_battery_entity: S(o.watch_battery_entity), watch_charging_entity: S(o.watch_charging_entity) };
    });
    const devices = (Array.isArray(r.devices) ? r.devices : []).map((p) => {
      const o = asObj(p);
      return { entity: S(o.entity), name: S(o.name), type: DEVICE_TYPES[o.type] ? o.type : 'tablet', charging_entity: S(o.charging_entity) };
    });
    return { ...base, map_path: typeof r.map_path === 'string' ? r.map_path : DEFAULTS.map_path, people, devices };
  }

  class HomeboundCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._type = 'custom:homebound-card';
      this._config = editorConfig({});
      this._hass = null;
      this._tab = 'persone';
      this._sel = { coll: 'people', i: 0 };
      this._details = {};
      this._nativeTried = false;
      this._renderScheduled = false;
      this._duringEvent = false;
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
      this.shadowRoot.addEventListener('change', (e) => this._change(e));
    }

    set hass(hass) {
      this._hass = hass;
      this.shadowRoot.querySelectorAll('ha-selector').forEach((s) => (s.hass = hass));
    }

    setConfig(raw) {
      if (raw && typeof raw.type === 'string') this._type = raw.type;
      const next = editorConfig(raw);
      if (JSON.stringify(next) === JSON.stringify(this._config) && this.shadowRoot.querySelector('.pc-editor')) return;
      this._config = next;
      this._fixSel();
      if (this._duringEvent || this._renderScheduled) this._scheduleRender();
      else this._render();
    }

    connectedCallback() {
      this._render();
      this._ensureNative();
    }

    async _ensureNative() {
      if (this._nativeTried) return;
      this._nativeTried = true;
      if (!customElements.get('ha-selector')) {
        try {
          const helper = await window.loadCardHelpers?.();
          await helper?.importSelector?.();
        } catch (e) { /* si usa il campo di testo di riserva */ }
      }
      this._render();
    }

    _scheduleRender() {
      if (!this.isConnected || this._renderScheduled) return;
      this._renderScheduled = true;
      const done = () => { this._renderScheduled = false; if (this.isConnected) this._render(); };
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(done);
      else Promise.resolve().then(done);
    }

    _emitConfig() {
      const c = this._config;
      const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));
      const out = {
        type: this._type, eyebrow: c.eyebrow, title: c.title, show_eyebrow: c.show_eyebrow, show_title: c.show_title,
        theme_mode: c.theme_mode, show_map: c.show_map, show_battery: c.show_battery, history_hours: c.history_hours, map_path: c.map_path,
        people: c.people.map((p) => ({ entity: p.entity, ...clean({ name: p.name, battery_entity: p.battery_entity, charging_entity: p.charging_entity, location_entity: p.location_entity, watch_battery_entity: p.watch_battery_entity, watch_charging_entity: p.watch_charging_entity }) })),
        devices: c.devices.map((d) => ({ entity: d.entity, type: d.type, ...clean({ name: d.name, charging_entity: d.charging_entity }) })),
      };
      this._duringEvent = true;
      try {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: out }, bubbles: true, composed: true }));
      } finally {
        this._duringEvent = false;
      }
    }

    _update(patch) {
      const next = { ...this._config, ...patch };
      if (JSON.stringify(next) === JSON.stringify(this._config)) return;
      this._config = next;
      this._fixSel();
      this._emitConfig();
      this._scheduleRender();
    }

    _fixSel() {
      const c = this._config;
      const { coll, i } = this._sel;
      if (c[coll] && c[coll][i]) return;
      if (c[coll] && c[coll].length) this._sel = { coll, i: c[coll].length - 1 };
      else if (c.people.length) this._sel = { coll: 'people', i: c.people.length - 1 };
      else if (c.devices.length) this._sel = { coll: 'devices', i: 0 };
      else this._sel = { coll: 'people', i: 0 };
    }

    _updateItem(coll, index, patch) {
      this._update({ [coll]: this._config[coll].map((p, i) => (i === index ? { ...p, ...patch } : p)) });
    }

    _field(label, inner, help = '') {
      return `<div class="pc-field"><div class="pc-label">${esc(label)}</div>${inner}${help ? `<div class="pc-tiny">${esc(help)}</div>` : ''}</div>`;
    }

    _input(scope, key, label, value, extra = '') {
      return this._field(label, `<input class="pc-input" type="text" maxlength="70" data-scope="${scope}" data-key="${key}" value="${esc(value || '')}" ${extra}/>`);
    }

    _check(scope, key, label, checked, help = '') {
      const id = `pc-${scope}-${key}`;
      return `<div class="pc-row-opt"><label for="${id}">${esc(label)}${help ? `<div class="pc-muted">${esc(help)}</div>` : ''}</label><input id="${id}" type="checkbox" data-scope="${scope}" data-key="${key}" ${checked ? 'checked' : ''}/></div>`;
    }

    _entityField(coll, index, key, label, hint = '', placeholder = 'sensor.*') {
      const value = this._config[coll][index]?.[key] || '';
      return this._field(
        label,
        `<div class="pc-selector-line"><div class="pc-selector-grow"><div data-entity-slot="${coll}:${index}:${key}"></div>
          <div class="pc-fallback"><input class="pc-input" type="text" data-scope="${coll}:${index}" data-key="${key}" placeholder="${placeholder}" value="${esc(value)}"/></div></div>
          ${value ? `<button type="button" class="pc-clear" data-clear="${coll}:${index}:${key}" aria-label="Rimuovi ${esc(label)}" title="Rimuovi ${esc(label)}">${icon('close')}</button>` : ''}</div>`,
        hint,
      );
    }

    _domainsFor(coll, key) {
      if (key === 'entity') return coll === 'people' ? PERSON_DOMAINS : DEVICE_DOMAINS;
      if (key.endsWith('charging_entity')) return CHARGING_DOMAINS;
      if (key === 'location_entity') return LOCATION_DOMAINS;
      return BATTERY_DOMAINS;
    }

    _itemLabel(coll, p, i) {
      const so = this._hass?.states?.[p.entity];
      return p.name || so?.attributes?.friendly_name || p.entity || (coll === 'people' ? `Persona ${i + 1}` : `Dispositivo ${i + 1}`);
    }

    _details_(key, open) {
      return `data-details="${key}" ${this._details[key] ?? open ? 'open' : ''}`;
    }

    _itemHtml(coll, index) {
      const p = this._config[coll][index];
      const n = this._config[coll].length;
      const head = `<div class="pc-person-head"><strong>${esc(this._itemLabel(coll, p, index))}</strong><div class="pc-controls">
          <button type="button" class="pc-action" data-move="${coll}:${index}:-1" aria-label="Sposta su" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="pc-action" data-move="${coll}:${index}:1" aria-label="Sposta giù" ${index === n - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="pc-clear" data-delete="${coll}:${index}" aria-label="Rimuovi">${icon('close')}</button></div></div>`;
      if (coll === 'people') {
        const more = `<details class="pc-more" ${this._details_(`p-${index}`, false)}><summary>Altre opzioni</summary><div class="pc-more-body">${
          this._entityField('people', index, 'battery_entity', 'Batteria telefono (facoltativa)', 'Se non indicata, la batteria viene letta dal tracker associato alla persona, quando la espone.')
        }${
          this._entityField('people', index, 'charging_entity', 'Ricarica telefono (facoltativa)', 'Entità binary_sensor che indica se il telefono è in carica.', 'binary_sensor.*')
        }${
          this._entityField('people', index, 'location_entity', 'Geolocalizzazione telefono (facoltativa)', 'Sensore di geolocalizzazione (sensor.*), mostrato come «Posizione» nei dettagli.', 'sensor.*')
        }${
          this._entityField('people', index, 'watch_battery_entity', 'Batteria orologio (facoltativa)', 'Sensore «Watch Battery Level» della Companion app iOS: richiede la complication di Home Assistant sul quadrante.')
        }${
          this._entityField('people', index, 'watch_charging_entity', 'Stato batteria orologio (facoltativo)', 'binary_sensor che indica se l\'orologio è in carica.', 'binary_sensor.*')
        }</div></details>`;
        return `<section class="pc-group">${head}`
          + this._entityField('people', index, 'entity', 'Persona o tracker (person.* / device_tracker.*)', '', 'person.* / device_tracker.*')
          + this._input(`people:${index}`, 'name', 'Nome visualizzato (facoltativo)', p.name)
          + more + '</section>';
      }
      const types = `<select class="pc-input" data-scope="devices:${index}" data-key="type">${Object.entries(DEVICE_TYPES).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
      return `<section class="pc-group">${head}`
        + this._entityField('devices', index, 'entity', 'Sensore batteria o tracker del dispositivo', 'Ad esempio il sensore «Battery Level» della Companion app del tablet.', 'sensor.*')
        + this._input(`devices:${index}`, 'name', 'Nome visualizzato (facoltativo)', p.name)
        + this._field('Tipo', types)
        + `<details class="pc-more" ${this._details_(`d-${index}`, false)}><summary>Altre opzioni</summary><div class="pc-more-body">${
          this._entityField('devices', index, 'charging_entity', 'Ricarica (facoltativa)', 'Entità binary_sensor che indica se il dispositivo è in carica.', 'binary_sensor.*')
        }</div></details></section>`;
    }

    _listHtml() {
      const c = this._config;
      const { coll, i } = this._sel;
      const chip = (k, p, n) => `<button type="button" class="pc-chipbtn ${k === coll && n === i ? 'active' : ''}" data-select="${k}:${n}">${esc(this._itemLabel(k, p, n))}</button>`;
      const chips = [...c.people.map((p, n) => chip('people', p, n)), ...c.devices.map((p, n) => chip('devices', p, n))];
      return '<div class="pc-heading">Persone e dispositivi</div><div class="pc-desc">Seleziona una voce e configura la sua entità. I dispositivi, ad esempio un tablet, compaiono sotto le persone e mostrano batteria e ultimo dato, non la posizione.</div>'
        + (chips.length ? `<div class="pc-person-picker">${chips.join('')}</div>` : '')
        + (c[coll] && c[coll][i] ? this._itemHtml(coll, i) : '<div class="pc-muted">Nessuna voce configurata.</div>')
        + '<div class="pc-addrow"><button type="button" class="pc-action" data-add="people">+ Aggiungi persona</button><button type="button" class="pc-action" data-add="devices">+ Aggiungi tablet o dispositivo</button></div>'
        + '<div class="pc-muted">Nessun limite fisso al numero di voci.</div>';
    }

    _render() {
      if (!this.isConnected) return;
      this.shadowRoot.querySelectorAll('details[data-details]').forEach((el) => { this._details[el.dataset.details] = el.open; });
      const c = this._config;
      const tabs = [['persone', 'Persone'], ['aspetto', 'Aspetto'], ['avanzate', 'Avanzate']];
      let body = '';
      if (this._tab === 'persone') body = this._listHtml();
      if (this._tab === 'aspetto') {
        const themes = `<select class="pc-input" data-scope="global" data-key="theme_mode">${[['auto', 'Auto (Home Assistant)'], ['light', 'Light Edera'], ['dark', 'Dark Edera']].map(([v, l]) => `<option value="${v}" ${c.theme_mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
        body = '<div class="pc-heading">Aspetto Edera</div><div class="pc-desc">Personalizza intestazione, titolo e tema mantenendo lo stile Edera Light/Dark.</div>'
          + this._check('global', 'show_eyebrow', 'Mostra intestazione superiore', c.show_eyebrow)
          + (c.show_eyebrow ? this._input('global', 'eyebrow', 'Intestazione superiore', c.eyebrow) : '')
          + this._check('global', 'show_title', 'Mostra titolo', c.show_title)
          + (c.show_title ? this._input('global', 'title', 'Titolo', c.title) : '')
          + this._field('Tema', themes)
          + this._check('global', 'show_map', 'Mostra mappa schematica', c.show_map, 'Distanza e direzione da casa, senza servizi esterni.')
          + this._check('global', 'show_battery', 'Mostra batteria delle persone', c.show_battery, 'Telefono e orologio. I dispositivi in casa mostrano sempre la batteria.');
      }
      if (this._tab === 'avanzate') {
        const hours = `<select class="pc-input" data-scope="global" data-key="history_hours">${RANGES.map((r) => `<option value="${r.h}" ${c.history_hours === r.h ? 'selected' : ''}>${r.label}</option>`).join('')}</select>`;
        body = '<div class="pc-heading">Avanzate</div><div class="pc-desc">La card è di sola lettura: non invia comandi a Home Assistant.</div>'
          + this._field('Periodo predefinito dello storico', hours, 'Nel popup puoi cambiarlo anche al momento. Lo storico usa Recorder di Home Assistant.')
          + this._input('global', 'map_path', 'Pannello mappa (vuoto per nascondere il pulsante)', c.map_path, 'placeholder="/map"')
          + '<div class="pc-muted" style="margin-top:18px">La mappa mostra solo distanza e direzione da casa e non usa servizi cartografici esterni.</div>';
      }
      this.shadowRoot.innerHTML = `<style>${EDITOR_CSS}</style><div class="pc-editor"><div class="pc-tabs">${tabs.map(([id, l]) => `<button type="button" class="pc-tab ${this._tab === id ? 'active' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>${body}</div>`;
      this.shadowRoot.querySelector('.pc-editor').classList.toggle('pc-no-native', !customElements.get('ha-selector'));
      this._mountSelectors();
    }

    _mountSelectors() {
      if (!customElements.get('ha-selector')) return;
      this.shadowRoot.querySelectorAll('[data-entity-slot]').forEach((slot) => {
        const [coll, idx, key] = slot.dataset.entitySlot.split(':');
        const index = Number(idx);
        const el = document.createElement('ha-selector');
        el.hass = this._hass;
        el.selector = { entity: { domain: this._domainsFor(coll, key) } };
        el.value = this._config[coll][index]?.[key] || '';
        el.setAttribute('aria-label', key);
        el.addEventListener('value-changed', (event) => {
          event.stopPropagation();
          if (!event.detail || !Object.prototype.hasOwnProperty.call(event.detail, 'value')) return;
          this._updateItem(coll, index, { [key]: typeof event.detail.value === 'string' ? event.detail.value : '' });
        });
        slot.appendChild(el);
      });
    }

    _click(event) {
      const t = event.target;
      const tab = t.closest('[data-tab]');
      if (tab) { this._tab = tab.dataset.tab; this._render(); return; }
      const sel = t.closest('[data-select]');
      if (sel) { const [c, i] = sel.dataset.select.split(':'); this._sel = { coll: c, i: Number(i) }; this._render(); return; }
      const clear = t.closest('[data-clear]');
      if (clear) { const [c, i, k] = clear.dataset.clear.split(':'); this._updateItem(c, Number(i), { [k]: '' }); return; }
      const add = t.closest('[data-add]');
      if (add) {
        const c = add.dataset.add;
        this._sel = { coll: c, i: this._config[c].length };
        this._update({ [c]: [...this._config[c], c === 'people' ? emptyPerson() : emptyDevice()] });
        return;
      }
      const del = t.closest('[data-delete]');
      if (del) {
        const [c, i] = del.dataset.delete.split(':');
        this._sel = { coll: c, i: Math.max(0, Math.min(Number(i), this._config[c].length - 2)) };
        this._update({ [c]: this._config[c].filter((_, n) => n !== Number(i)) });
        return;
      }
      const mv = t.closest('[data-move]');
      if (mv) {
        const [c, i, d] = mv.dataset.move.split(':');
        const list = [...this._config[c]];
        const a = Number(i);
        const n = a + Number(d);
        if (n < 0 || n >= list.length) return;
        [list[a], list[n]] = [list[n], list[a]];
        this._sel = { coll: c, i: n };
        this._update({ [c]: list });
      }
    }

    _change(event) {
      const input = event.target;
      const key = input?.dataset?.key;
      if (!key) return;
      const scope = input.dataset.scope;
      const value = input.type === 'checkbox' ? input.checked : input.value;
      if (scope === 'global') {
        if (key === 'history_hours') this._update({ history_hours: Number(value) || 24 });
        else if (key === 'map_path') this._update({ map_path: String(value).trim() });
        else this._update({ [key]: value });
        return;
      }
      const [coll, idx] = String(scope).split(':');
      if ((coll === 'people' || coll === 'devices') && Number.isInteger(Number(idx))) this._updateItem(coll, Number(idx), { [key]: String(value).trim() });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 7. Registrazione                                                    */
  /* ------------------------------------------------------------------ */

  customElements.define(TAG, HomeboundCard);
  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, HomeboundCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({
      type: TAG,
      name: 'Homebound Card',
      description: 'Chi è in casa, ultimi spostamenti, batteria di telefono e orologio, dispositivi in casa e mappa schematica in stile Edera.',
      preview: true,
    });
  }
  console.info(`%c HOMEBOUND-CARD %c ${VERSION} `, 'background:#0a7156;color:#fff;font-weight:700', 'background:#18221c;color:#fff');
})();
