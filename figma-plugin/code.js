// PIPOL TUTOR Builder — draws the PIPOL TUTOR screen set into the current Figma file.
//
// Run it from Figma desktop: Plugins > Development > Import plugin from manifest...
// then Plugins > Development > PIPOL TUTOR Builder.
//
// Re-running is safe: every frame this plugin makes is named with the PREFIX below,
// and each run removes its own previous output before drawing again.

// Set to true to also delete the older screens that were made before this plugin
// (the frames named "Desktop / 01 Landing", "Desktop / 02 About", and so on).
var DELETE_LEGACY_SCREENS = false;

var PREFIX = 'PT · ';

// ---------------------------------------------------------------- design tokens

var C = {
  brand: '#3A5BD9', brandDark: '#1E2F86', brandDeep: '#121D52',
  brand50: '#EEF2FF', brand100: '#DCE4FF',
  accent: '#FF6B35', accentDark: '#E5551C', accent50: '#FFEDE4',
  teal: '#12B5A5', teal50: '#DFF7F3',
  amber: '#F59E0B', amber50: '#FEF3DC',
  green: '#16A34A', green50: '#E4F6EA',
  red: '#EF4444', red50: '#FDE8E8',
  mystic: '#7C3AED', mystic50: '#F0E9FF',
  line: '#06C755', line50: '#E6F9EE',
  page: '#F5F7FC', card: '#FFFFFF',
  border: '#E3E9F4', borderStrong: '#CBD6EA',
  ink: '#111C3E', ink2: '#46557A', ink3: '#8493B4',
  white: '#FFFFFF', footer: '#0C1533'
};

// ---------------------------------------------------------------- night mode
//
// The light palette above stays the source of truth: every screen is written once
// against C, and the night theme is a translation table applied at paint time.
// A colour translates differently depending on whether it paints a surface or a
// glyph — #FFFFFF is a card underneath and a label on top of one — so there are
// two tables, and fill() picks by node type.
//
// Ratio, per the brief: 60% #111827 ground, 30% #C5D4FF pastel periwinkle, 10%
// #FFE3A3 pastel warm yellow. The ground is already blue-toned, so the 30% reads
// across whole surfaces rather than only in the accents.

var THEME = 'light';                 // 'light' or 'dark' — set by setTheme()
var LIGHT_PREFIX = 'PT · ';
var DARK_PREFIX = 'PT ☾ ';      // dark frames are named separately so a run of
                                     // one theme never clears the other's frames
var DARK_SUFFIX = ' · กลางคืน';      // appended to the page name in night mode

var DARK_SURFACE = {
  '#F5F7FC': '#111827', '#FFFFFF': '#1A2233', '#0C1533': '#0D131F',
  '#EEF2FF': '#1B2540', '#DCE4FF': '#1E2A4A', '#E9EEFB': '#202B40', '#E1E8FF': '#1E2A4A',
  '#FFEDE4': '#2B2618', '#DFF7F3': '#14302E', '#CFF1EB': '#17352F', '#FEF3DC': '#2E2718',
  '#E4F6EA': '#16301F', '#DFF7E9': '#16301F', '#BFE9D2': '#1E3A28', '#FDE8E8': '#2E1B1F',
  '#F0E9FF': '#241C3A', '#EFE8FF': '#241C3A', '#E6F9EE': '#16301F',
  '#3A5BD9': '#C5D4FF', '#1E2F86': '#1E2A4A', '#121D52': '#16203A',
  '#3B4C93': '#2B3A55', '#2A3556': '#2A3547',
  '#FF6B35': '#FFE3A3', '#E5551C': '#F0CE86', '#FFDCCC': '#2B2618',
  '#12B5A5': '#86DCD0', '#5EE0D0': '#A9E6DC', '#F59E0B': '#FFD37A', '#FFC94D': '#FFD37A',
  '#16A34A': '#7ED598', '#EF4444': '#FF9494',
  '#7C3AED': '#CBB4FF', '#5B21B6': '#33285C', '#4A2A9E': '#33285C',
  '#241461': '#1A1430', '#5B2CC4': '#2A2050', '#3A1D8C': '#241C3A',
  '#B9A8E8': '#2E2450', '#D9CCFF': '#332A5A', '#D6C9FF': '#332A5A',
  '#7C4A03': '#2E2718', '#B45309': '#3A3018',
  '#E3E9F4': '#2A3547', '#CBD6EA': '#3A4761',
  '#111C3E': '#1A2233', '#46557A': '#222C3E', '#8493B4': '#2E3950',
  '#9DB2FF': '#1E2A4A', '#BFCCFF': '#1E2A4A', '#93A2C9': '#2A3547'
};

var DARK_TEXT = {
  '#FFFFFF': '#EEF2FF', '#111C3E': '#EEF2FF', '#46557A': '#B9C4E0', '#8493B4': '#8C99B8',
  '#3A5BD9': '#C5D4FF', '#1E2F86': '#C5D4FF', '#121D52': '#C5D4FF',
  '#DCE4FF': '#DDE5FF', '#EEF2FF': '#E9EEFF', '#E1E8FF': '#E9EEFF',
  '#9DB2FF': '#C5D4FF', '#BFCCFF': '#DDE5FF', '#93A2C9': '#98A3BE',
  '#FF6B35': '#FFE3A3', '#E5551C': '#FFE3A3', '#FFDCCC': '#FFE3A3',
  '#7C4A03': '#FFE3A3', '#B45309': '#FFD37A', '#F59E0B': '#FFD37A', '#FFC94D': '#FFD37A',
  '#12B5A5': '#86DCD0', '#5EE0D0': '#A9E6DC', '#16A34A': '#7ED598', '#04A445': '#7ED598',
  '#EF4444': '#FF9494', '#06C755': '#5FD990',
  '#7C3AED': '#CBB4FF', '#5B21B6': '#CBB4FF', '#3A1D8C': '#CBB4FF',
  '#B9A8E8': '#CBB4FF', '#D9CCFF': '#DFD6FF', '#EFE8FF': '#DFD6FF', '#D6C9FF': '#DFD6FF',
  '#E3E9F4': '#2F3A4E', '#CBD6EA': '#3A4761', '#F5F7FC': '#111827',
  '#DFF7E9': '#A9E3C0', '#DFF7F3': '#A9E6DC'
};

// A gradient stop is a surface, but the surface table translates the brand ramp
// asymmetrically: #1E2F86 lands on a navy and #3A5BD9 lands on the pale periwinkle
// that carries text elsewhere. A band painted brandDeep -> brand therefore ran from
// near-black to near-white and read as a lit slab dropped onto the night page. The
// ramp gets its own table so brand panels stay elevated navy in night mode and the
// periwinkle keeps its job as the colour on top.
var DARK_GRADIENT = {
  '#3A5BD9': '#2C3E6B', '#1E2F86': '#202C4E', '#121D52': '#1A2340'
};

function setTheme(name) {
  THEME = name === 'dark' ? 'dark' : 'light';
  PREFIX = THEME === 'dark' ? DARK_PREFIX : LIGHT_PREFIX;
}

// translate one token for the theme in play; unknown values pass through
function themed(h, isText) {
  if (THEME !== 'dark' || !h) return h;
  var m = (isText ? DARK_TEXT : DARK_SURFACE)[h.toUpperCase()];
  return m || h;
}

// Countdown to the exam. The PDF note asks whether the number tiles can turn orange
// as the date closes in — they do, below URGENT_DAYS. Both numbers are placeholder
// content (see PRODUCT.md ASSUMPTIONS); drop COUNTDOWN_DAYS under 30 to draw the
// urgent state.
var COUNTDOWN_DAYS = 128;
var URGENT_DAYS = 30;
function countdownUrgent() { return COUNTDOWN_DAYS <= URGENT_DAYS; }

var DISPLAY = 'Mitr';
var BODY = 'Anuphan';
var ICONS = 'Material Symbols Rounded';
var ICON_STYLE = 'Regular';
var HAS_ICON_FONT = true;

// Every screen function is written once and drawn at each breakpoint below.
// setBreakpoint() rewrites W, PAD and the two stacking flags before a pass,
// and the layout helpers (flex, flex2, capW, railW) read them.
var BREAKPOINTS = [
  { id: 'desktop', label: 'Desktop', w: 1440, pad: 72 },
  { id: 'tablet',  label: 'Tablet',  w: 834,  pad: 40 },
  { id: 'mobile',  label: 'Mobile',  w: 430,  pad: 20 }
];

// every screen at every width lands on this one page, one row per screen
var PAGE_NAME = '\uD83C\uDFAF PIPOL TUTOR';

var BP = 'desktop';
var W = 1440;          // frame width for the pass being drawn
var PAD = 72;          // page gutter for the pass being drawn
var NARROW = false;    // tablet or mobile: page-level two-column splits stack
var TABLET = false;    // tablet only: card grids go two across instead of stacking
var MOBILE = false;    // mobile only: everything becomes one column

function setBreakpoint(bp) {
  BP = bp.id;
  W = bp.w;
  PAD = bp.pad;
  NARROW = bp.id !== 'desktop';
  TABLET = bp.id === 'tablet';
  MOBILE = bp.id === 'mobile';
}

// pick a value per breakpoint
function bpv(desktop, tablet, mobile) {
  return MOBILE ? mobile : (TABLET ? tablet : desktop);
}

// width available between the page gutters
function contentW() { return W - PAD * 2; }

// row on desktop, column once the page is too narrow to hold two columns
function flex(gap, opts) { return NARROW ? col(gap, opts) : row(gap, opts); }

// row until phone width - for pairs that still fit side by side on a tablet
function flex2(gap, opts) { return MOBILE ? col(gap, opts) : row(gap, opts); }

// A row of equal cards. Desktop keeps all n across, tablet wraps to two, a phone
// stacks them. Children added with add() are sized to the column automatically.
var GRID_META = {};   // node id -> { cols, gap }; nodes themselves reject extra properties

function grid(parent, gap, n) {
  var per = MOBILE ? 1 : (TABLET ? Math.min(n, 2) : n);
  // The stacked grid is built as a column from the start. Flipping layoutMode on a
  // frame that has already been sized swaps which axis each sizing flag governs:
  // the FILL that add() put on the width became a FIXED height, so the phone column
  // sat at the 100px default while its cards spilled over the sections below it.
  var g = per === 1 ? col(gap, { align: 'MIN' }) : row(gap, { align: 'MIN' });
  add(parent, g, 'fill');
  if (per === 1) return g;
  // wrap even when the row is meant to hold exactly n across: a caller that adds
  // an n+1th card should push it onto a second line, not off the page edge
  g.layoutWrap = 'WRAP';
  g.counterAxisSpacing = gap;
  GRID_META[g.id] = { cols: per, gap: gap };
  return g;
}

// resize() on an auto-layout frame pins BOTH axes, so a frame sized before its
// content is filled in keeps the height it had when it was empty and everything
// added afterwards spills out of it (and gets clipped, since cards clip). Every
// resize meant to set only a width has to hand the height back to the layout.
function hugHeight(node) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return node;
  if (node.layoutMode === 'VERTICAL') node.primaryAxisSizingMode = 'AUTO';
  else node.counterAxisSizingMode = 'AUTO';
  return node;
}

// resize to a fixed width on wide screens, but never wider than the content box
function capW(node, w) {
  node.resize(Math.min(w, contentW()), node.height);
  return hugHeight(node);
}

// a fixed-width side rail on desktop that becomes a full-width block when stacked
function railW(node, w) {
  if (node.parent && node.parent.layoutMode === 'VERTICAL') {
    node.layoutSizingHorizontal = 'FILL';   // the split stacked, so fill the width
    return node;
  }
  node.resize(TABLET ? Math.min(w, 300) : w, node.height);
  node.counterAxisSizingMode = 'FIXED';
  if (node.layoutMode === 'VERTICAL') node.primaryAxisSizingMode = 'AUTO';
  return node;
}

// ---------------------------------------------------------------- tiny helpers

function hex(h) {
  return {
    r: parseInt(h.slice(1, 3), 16) / 255,
    g: parseInt(h.slice(3, 5), 16) / 255,
    b: parseInt(h.slice(5, 7), 16) / 255
  };
}
function solid(h, opacity) {
  var p = { type: 'SOLID', color: hex(h) };
  if (opacity !== undefined) p.opacity = opacity;
  return p;
}
// A translucent white is a lightening overlay, not a surface colour — it has to
// stay white in night mode or the panels it paints vanish into the ground.
function overlayWhite(h, opacity) {
  return h && h.toUpperCase() === '#FFFFFF' && opacity !== undefined && opacity < 1;
}
function fill(node, h, opacity) {
  var hx = overlayWhite(h, opacity) ? h : themed(h, node.type === 'TEXT');
  node.fills = [solid(hx, opacity)];
}
function noFill(node) { node.fills = []; }
function stroke(node, h, weight, opacity) {
  var hx = overlayWhite(h, opacity) ? h : themed(h, false);
  node.strokes = [solid(hx, opacity)];
  node.strokeWeight = weight || 1;
}
function shadow(node, level) {
  var e = {
    s: { c: 0.06, y: 2, r: 6, sp: 0 },
    m: { c: 0.10, y: 14, r: 30, sp: -8 },
    l: { c: 0.16, y: 30, r: 56, sp: -18 }
  }[level];
  // on a dark ground the navy shadow reads as nothing — go black and deeper
  var col = THEME === 'dark'
    ? { r: 0, g: 0, b: 0, a: Math.min(0.6, e.c * 2.4) }
    : { r: 0.067, g: 0.110, b: 0.243, a: e.c };
  node.effects = [{
    type: 'DROP_SHADOW',
    color: col,
    offset: { x: 0, y: e.y }, radius: e.r, spread: e.sp,
    visible: true, blendMode: 'NORMAL'
  }];
}
function themedStop(h) {
  if (THEME !== 'dark' || !h) return h;
  return DARK_GRADIENT[h.toUpperCase()] || themed(h, false);
}
function gradient(node, from, to, angle) {
  from = themedStop(from);
  to = themedStop(to);
  var t = angle === 'v'
    ? [[0, 1, 0], [-1, 0, 1]]
    : [[1, 0.35, 0], [-0.35, 1, 0.18]];
  node.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: t,
    gradientStops: [
      { position: 0, color: Object.assign({ a: 1 }, hex(from)) },
      { position: 1, color: Object.assign({ a: 1 }, hex(to)) }
    ]
  }];
}

// auto-layout frame
function stack(dir, gap, opts) {
  opts = opts || {};
  var f = figma.createFrame();
  f.layoutMode = dir === 'v' ? 'VERTICAL' : 'HORIZONTAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap || 0;
  f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = 0;
  f.clipsContent = false;
  noFill(f);
  if (opts.name) f.name = opts.name;
  if (opts.pad !== undefined) pad(f, opts.pad);
  if (opts.px !== undefined) { f.paddingLeft = f.paddingRight = opts.px; }
  if (opts.py !== undefined) { f.paddingTop = f.paddingBottom = opts.py; }
  if (opts.radius !== undefined) f.cornerRadius = opts.radius;
  if (opts.bg) fill(f, opts.bg);
  if (opts.border) stroke(f, opts.border, opts.borderW || 1);
  if (opts.shadow) shadow(f, opts.shadow);
  if (opts.align) f.counterAxisAlignItems = opts.align;      // MIN CENTER MAX
  if (opts.justify) f.primaryAxisAlignItems = opts.justify;  // MIN CENTER MAX SPACE_BETWEEN
  if (opts.wrap) {
    f.primaryAxisSizingMode = 'FIXED';
    f.layoutWrap = 'WRAP';
    f.counterAxisSpacing = opts.wrapGap || gap;
  }
  return f;
}
function col(gap, opts) { return stack('v', gap, opts); }
function row(gap, opts) { return stack('h', gap, opts); }
function pad(f, v) {
  if (typeof v === 'number') { f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = v; }
  else {
    f.paddingTop = v[0]; f.paddingRight = v[1];
    f.paddingBottom = v.length > 2 ? v[2] : v[0];
    f.paddingLeft = v.length > 3 ? v[3] : v[1];
  }
}
function add(parent, child, sizing) {
  parent.appendChild(child);
  var meta = GRID_META[parent.id];
  if (meta) {
    var basis = parent.width > 0 ? parent.width : contentW();
    var w = Math.floor((basis - meta.gap * (meta.cols - 1)) / meta.cols);
    child.resize(Math.max(120, w), child.height);
    child.layoutSizingHorizontal = 'FIXED';
    hugHeight(child);
    return child;
  }
  if (sizing === 'fill') child.layoutSizingHorizontal = 'FILL';
  if (sizing === 'fillv') child.layoutSizingVertical = 'FILL';
  return child;
}
function fixedW(node, w) { node.resize(w, node.height); hugHeight(node); }

// text
function txt(chars, o) {
  o = o || {};
  var t = figma.createText();
  t.fontName = { family: o.display ? DISPLAY : BODY, style: o.style || (o.display ? 'SemiBold' : 'Regular') };
  t.fontSize = o.size || 16;
  t.lineHeight = { unit: 'PERCENT', value: o.lh || (o.display ? 134 : 178) };
  if (o.ls !== undefined) t.letterSpacing = { unit: 'PIXELS', value: o.ls };
  t.characters = chars;
  fill(t, o.color || C.ink);
  t.textAutoResize = o.nowrap ? 'WIDTH_AND_HEIGHT' : 'HEIGHT';
  if (o.width) { t.resize(o.width, t.height); }
  if (o.align) t.textAlignHorizontal = o.align;
  return t;
}
// display type set for 1440 is too loud on a phone, so headings step down
function fit(size) {
  if (MOBILE) return Math.max(15, Math.round(size * 0.68 * 10) / 10);
  if (NARROW) return Math.max(15, Math.round(size * 0.84 * 10) / 10);
  return size;
}
function heading(s, base, extra, o) {
  var merged = Object.assign({ display: true }, extra, o || {});
  merged.size = fit(merged.size === undefined ? base : merged.size);
  return txt(s, merged);
}
function h1(s, o) { return heading(s, 44, { size: 44, lh: 128 }, o); }
function h2(s, o) { return heading(s, 34, { size: 34, lh: 132 }, o); }
function h3(s, o) { return heading(s, 22, { size: 22, lh: 138 }, o); }
function h4(s, o) { return heading(s, 18, { size: 18, style: 'Medium', lh: 140 }, o); }
function body(s, o) { return txt(s, Object.assign({ size: 16, color: C.ink2 }, o || {})); }
function small(s, o) { return txt(s, Object.assign({ size: 13.5, color: C.ink3, lh: 160 }, o || {})); }

function icon(name, size, color) {
  var t = figma.createText();
  if (HAS_ICON_FONT) {
    t.fontName = { family: ICONS, style: ICON_STYLE };
    t.fontSize = size || 20;
    t.characters = name;
  } else {
    t.fontName = { family: BODY, style: 'SemiBold' };
    t.fontSize = (size || 20) * 0.7;
    t.characters = '•';
  }
  t.lineHeight = { unit: 'PERCENT', value: 100 };
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  fill(t, color || C.ink2);
  t.name = 'icon/' + name;
  return t;
}

// round icon tile
function iconTile(name, size, bg, fg, radius) {
  var f = col(0, { bg: bg, radius: radius === undefined ? Math.round(size * 0.32) : radius, align: 'CENTER', justify: 'CENTER' });
  f.name = 'icon tile';
  f.resize(size, size);
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.appendChild(icon(name, Math.round(size * 0.52), fg));
  return f;
}

function numTile(label, size, bg, fg, radius) {
  var f = col(0, { bg: bg, radius: radius === undefined ? 11 : radius, align: 'CENTER', justify: 'CENTER' });
  f.name = 'number tile';
  f.resize(size, size);
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.appendChild(txt(label, { display: true, style: 'Medium', size: Math.round(size * 0.41), lh: 120, color: fg }));
  return f;
}

function pill(label, bg, fg, iconName) {
  // "icon ไฟ ต้องถูกทำใส่ ของเพิ่ม ชิดกว่านี้" — the icon sits tight against its
  // label, and the left padding tucks in behind it, so the chip reads as one unit
  var p = row(iconName ? 6 : 8, { bg: bg, radius: 999, align: 'CENTER' });
  pad(p, [8, 16]);
  if (iconName) p.paddingLeft = 12;
  p.name = 'pill';
  if (iconName) p.appendChild(icon(iconName, 16, fg));
  p.appendChild(txt(label, { display: true, style: 'Medium', size: 13.5, lh: 140, color: fg, nowrap: true }));
  return p;
}

function btn(label, kind, iconName, trailingIcon) {
  var map = {
    primary: [C.accent, C.white],
    brand: [C.brand, C.white],
    line: [C.line, C.white],
    ghost: [C.card, C.ink],
    light: [C.white, C.brandDark]
  };
  var c = map[kind] || map.primary;
  var b = row(9, { bg: c[0], radius: 999, align: 'CENTER', justify: 'CENTER' });
  pad(b, [16, 26]);
  b.name = 'button/' + kind;
  if (kind === 'ghost') stroke(b, C.borderStrong, 1.5);
  else shadow(b, 'm');
  if (iconName && !trailingIcon) b.appendChild(icon(iconName, 20, c[1]));
  b.appendChild(txt(label, { display: true, style: 'Medium', size: 16, lh: 130, color: c[1], nowrap: true }));
  if (iconName && trailingIcon) b.appendChild(icon(iconName, 20, c[1]));
  return b;
}

function card(gap, opts) {
  opts = Object.assign({ bg: C.card, border: C.border, radius: 24, pad: 24, shadow: 's' }, opts || {});
  return col(gap, opts);
}

function vgap(h) {
  var f = figma.createFrame();
  f.name = 'spacer';
  f.layoutMode = 'NONE';
  f.resize(8, h);
  noFill(f);
  f.clipsContent = false;
  return f;
}
function divider(width, color) {
  var d = figma.createFrame();
  d.name = 'divider';
  d.resize(width || 100, 1);
  fill(d, color || C.border);
  return d;
}

function tick(label, iconName, iconColor, textColor) {
  var r = row(11, { align: 'MIN' });
  r.appendChild(icon(iconName || 'check_circle', 21, iconColor || C.teal));
  var t = txt(label, { size: 15.5, color: textColor || C.ink });
  r.appendChild(t);
  return r;
}

function bar(widthPct, colorHex, totalW, height) {
  var track = figma.createFrame();
  track.name = 'bar';
  track.resize(totalW, height || 11);
  track.cornerRadius = 99;
  fill(track, C.page);
  track.clipsContent = true;
  var f = figma.createFrame();
  f.resize(Math.max(4, Math.round(totalW * widthPct)), height || 11);
  f.cornerRadius = 99;
  fill(f, colorHex);
  track.appendChild(f);
  return track;
}

// donut progress ring (real arc, not a bar bent into a circle)
function ring(pct, size, thickness, colorHex, bigLabel, smallLabel) {
  var f = figma.createFrame();
  f.name = 'progress ring';
  f.layoutMode = 'NONE';
  f.resize(size, size);
  noFill(f);
  f.clipsContent = false;
  var inner = Math.max(0, (size - thickness * 2) / size);

  var track = figma.createEllipse();
  f.appendChild(track);
  track.resize(size, size);
  track.x = 0; track.y = 0;
  track.arcData = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: inner };
  fill(track, C.page);

  if (pct > 0) {
    var arc = figma.createEllipse();
    f.appendChild(arc);
    arc.resize(size, size);
    arc.x = 0; arc.y = 0;
    var st = -Math.PI / 2;
    arc.arcData = { startingAngle: st, endingAngle: st + Math.PI * 2 * Math.min(pct, 0.9999), innerRadius: inner };
    fill(arc, colorHex);
  }

  var big = txt(bigLabel, { display: true, size: Math.round(size * 0.26), lh: 118, align: 'CENTER' });
  f.appendChild(big);
  big.resize(size, big.height);
  var sm = txt(smallLabel, { size: Math.round(size * 0.095), color: C.ink3, lh: 135, align: 'CENTER' });
  f.appendChild(sm);
  sm.resize(size, sm.height);
  var th = big.height + sm.height + 2;
  big.x = 0; big.y = Math.round((size - th) / 2);
  sm.x = 0; sm.y = big.y + big.height + 2;
  return f;
}

function avatar(initial, size, fromHex, toHex) {
  var a = col(0, { radius: 999, align: 'CENTER', justify: 'CENTER' });
  a.name = 'avatar';
  a.resize(size, size);
  a.primaryAxisSizingMode = 'FIXED';
  a.counterAxisSizingMode = 'FIXED';
  gradient(a, fromHex || C.mystic, toHex || C.brand);
  a.appendChild(txt(initial, { display: true, style: 'SemiBold', size: Math.round(size * 0.42), lh: 120, color: C.white }));
  return a;
}

// photo / media placeholder
function slot(w, h, tintFrom, tintTo, iconName, title, note) {
  var f = col(8, { radius: 24, align: 'CENTER', justify: 'CENTER', pad: 24 });
  f.name = 'PLACEHOLDER · ' + title;
  f.resize(w, h);
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.clipsContent = true;
  gradient(f, tintFrom, tintTo);
  stroke(f, C.border, 1);
  f.appendChild(icon(iconName, 38, C.brand));
  var t1 = txt(title, { display: true, style: 'Medium', size: 15, lh: 140, color: C.brandDark, align: 'CENTER' });
  t1.resize(Math.min(w - 48, 260), t1.height);
  f.appendChild(t1);
  if (note) {
    var t2 = txt(note, { size: 13, color: C.ink3, lh: 160, align: 'CENTER' });
    t2.resize(Math.min(w - 48, 260), t2.height);
    f.appendChild(t2);
  }
  return f;
}

// A row of buttons. Two Thai-labelled buttons are wider than a 430 frame, so on a
// phone the row wraps instead of overflowing.
function btnRow(gap, opts) {
  opts = Object.assign({ align: 'CENTER' }, opts || {});
  if (!MOBILE) return row(gap, opts);
  opts.wrap = true;
  opts.wrapGap = gap;
  return row(gap, opts);   // caller sets FILL after appending, which fixes the primary axis
}

// ---------------------------------------------------------------- page shell

function screenFrame(name, width) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = 'VERTICAL';
  f.itemSpacing = 0;
  f.resize(width || W, 800);
  f.counterAxisSizingMode = 'FIXED';   // width stays put
  f.primaryAxisSizingMode = 'AUTO';    // height hugs the content
  f.clipsContent = true;
  fill(f, C.page);
  return f;
}

function band(parent, opts) {
  opts = opts || {};
  var s = col(opts.gap === undefined ? 0 : opts.gap, {
    px: opts.px === undefined ? PAD : opts.px,
    align: opts.align
  });
  // vertical rhythm set for a 1440 canvas is wasteful on a phone
  var vk = MOBILE ? 0.55 : (NARROW ? 0.75 : 1);
  s.paddingTop = Math.round((opts.top === undefined ? 72 : opts.top) * vk);
  s.paddingBottom = Math.round((opts.bottom === undefined ? 72 : opts.bottom) * vk);
  if (opts.bg) fill(s, opts.bg);
  if (opts.name) s.name = opts.name;
  add(parent, s, 'fill');
  return s;
}

function brandMark(size, onDark) {
  var b = row(11, { align: 'CENTER' });
  b.name = 'brand';
  var mk = col(0, { radius: 13, align: 'CENTER', justify: 'CENTER' });
  mk.resize(size, size);
  mk.primaryAxisSizingMode = 'FIXED';
  mk.counterAxisSizingMode = 'FIXED';
  if (onDark) fill(mk, C.white, 0.16); else gradient(mk, C.brand, C.brandDark);
  mk.appendChild(txt('จภ', { display: true, style: 'Medium', size: 15, lh: 120, color: C.white }));
  b.appendChild(mk);
  var t = col(0);
  t.appendChild(txt('PIPOL TUTOR', { display: true, size: 16, lh: 128, color: onDark ? C.white : C.ink, nowrap: true }));
  t.appendChild(txt('ติวเข้า ม.1 จภ.', { size: 12.5, lh: 140, color: onDark ? C.brand100 : C.ink3, nowrap: true }));
  b.appendChild(t);
  return b;
}

function siteHeader(current, app) {
  var hd = row(20, { bg: C.card, align: 'CENTER', justify: 'SPACE_BETWEEN', px: PAD, py: 14 });
  hd.name = 'header';
  hd.appendChild(brandMark(42, false));

  var items = ['หน้าแรก', 'รู้จักพี่ที', 'คอร์สเรียน', 'คลังข้อสอบ', 'รีวิว', 'ดูดวง'];
  var nav = row(24, { align: 'CENTER' });
  nav.name = 'nav';
  if (TABLET) {
    // the six links fit, but only with the spacing and type pulled in
    nav.itemSpacing = 15;
  }
  if (MOBILE) {
    // six links do not fit; the current page keeps its label, the rest go behind the menu
    var cur = row(8, { bg: C.brand50, radius: 999, align: 'CENTER' });
    pad(cur, [7, 14]);
    cur.appendChild(txt(current, { display: true, style: 'Medium', size: 14, lh: 135, color: C.brand, nowrap: true }));
    nav.appendChild(cur);
    hd.appendChild(nav);

    var burger = col(0, { bg: C.page, radius: 14, align: 'CENTER', justify: 'CENTER' });
    burger.name = 'menu';
    burger.resize(42, 42);
    burger.primaryAxisSizingMode = 'FIXED';
    burger.counterAxisSizingMode = 'FIXED';
    stroke(burger, C.border, 1.5);
    burger.appendChild(icon('menu', 23, C.ink));
    hd.appendChild(burger);
    return hd;
  }
  for (var i = 0; i < items.length; i++) {
    var on = items[i] === current;
    var link = col(6, { align: 'CENTER' });
    var label = txt(items[i], {
      size: TABLET ? 13.5 : 15.5, lh: 150, nowrap: true,
      color: on ? C.brand : C.ink2,
      display: on, style: on ? 'Medium' : 'Regular'
    });
    link.appendChild(label);
    if (on) {
      var u = divider(Math.max(24, Math.round(label.width)), C.accent);
      u.resize(u.width, 2);
      link.appendChild(u);
    }
    nav.appendChild(link);
  }
  hd.appendChild(nav);

  if (app) {
    var a = row(10, { bg: C.page, border: C.border, radius: 999, align: 'CENTER' });
    pad(a, [6, 14, 6, 6]);
    var av = col(0, { bg: C.brand100, radius: 999, align: 'CENTER', justify: 'CENTER' });
    av.resize(34, 34);
    av.primaryAxisSizingMode = 'FIXED';
    av.counterAxisSizingMode = 'FIXED';
    av.appendChild(icon('person', 19, C.brand));
    a.appendChild(av);
    var ac = col(0);
    ac.appendChild(txt('น้องมิ้นท์', { display: true, style: 'Medium', size: 14, lh: 130, nowrap: true }));
    ac.appendChild(txt('คอร์สเต็มรูปแบบ · ถึง 25 ม.ค. 69', { size: 12, lh: 135, color: C.ink3, nowrap: true }));
    a.appendChild(ac);
    a.appendChild(icon('expand_more', 20, C.ink3));
    hd.appendChild(a);
  } else {
    var b = btn('เข้าสู่ระบบ', 'primary', 'login');
    pad(b, [12, 20]);
    hd.appendChild(b);
  }
  return hd;
}

function ctaBand(parent) {
  var s = band(parent, { top: 20, bottom: 84 });
  s.name = 'section / CTA';
  var b = flex(NARROW ? 24 : 40, { radius: 30, align: NARROW ? 'MIN' : 'CENTER', justify: 'SPACE_BETWEEN', pad: MOBILE ? 26 : (NARROW ? 34 : 46) });
  gradient(b, C.brandDeep, C.brand);
  shadow(b, 'l');
  add(s, b, 'fill');

  var l = col(11);
  l.appendChild(h2('รุ่นที่ 7 เปิดรับแล้ว เหลือ 9 ที่นั่ง', { size: 32, color: C.white }));
  var p = txt('ยังไม่แน่ใจว่าเหมาะกับลูกหรือเปล่า ทักไลน์มาคุยกับพี่ทีก่อนได้ ไม่มีการตื๊อให้สมัคร', { size: 16, color: C.brand100 });
  l.appendChild(p);
  add(b, l, 'fill');
  p.layoutSizingHorizontal = 'FILL';

  var r = btnRow(12);
  r.appendChild(btn('ดูคอร์สและราคา', 'primary', 'shopping_bag'));
  r.appendChild(btn('ทักไลน์พี่ที', 'line', 'chat_bubble'));
  b.appendChild(r);
  if (MOBILE) r.layoutSizingHorizontal = 'FILL';
  return s;
}

function siteFooter(parent) {
  var f = col(32, { bg: C.footer, px: PAD });
  f.name = 'footer';
  f.paddingTop = 56; f.paddingBottom = 26;
  add(parent, f, 'fill');

  var top = flex(NARROW ? 30 : 44, { align: 'MIN' });
  add(f, top, 'fill');

  var left = col(14);
  left.appendChild(brandMark(42, true));
  var d = txt('คอร์สติวเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย สอนโดยพี่ที ศิษย์เก่า จภ. โดยตรง',
    { size: 14.5, color: '#93A2C9', lh: 170 });
  capW(d, 320);
  left.appendChild(d);
  top.appendChild(left);
  left.layoutSizingHorizontal = 'FILL';

  var cols = [
    ['เมนู', ['หน้าแรก', 'รู้จักพี่ที', 'คอร์สเรียน', 'คลังข้อสอบ', 'ดูดวง']],
    ['ช่วยเหลือ', ['วิธีสมัครและชำระเงิน', 'เข้ากลุ่ม LINE', 'คำถามที่พบบ่อย', 'ติดต่อพี่ที']],
    ['ข้อกำหนด', ['เงื่อนไขการใช้งาน', 'นโยบายความเป็นส่วนตัว', 'นโยบายการคืนเงิน']]
  ];
  var linkWrap = MOBILE ? col(24) : top;
  if (MOBILE) { add(top, linkWrap, 'fill'); }
  for (var i = 0; i < cols.length; i++) {
    var c = col(10);
    c.appendChild(txt(cols[i][0], { display: true, style: 'Medium', size: 15, lh: 140, color: C.white, nowrap: true }));
    for (var j = 0; j < cols[i][1].length; j++) {
      c.appendChild(txt(cols[i][1][j], { size: 14.5, lh: 190, color: '#93A2C9', nowrap: true }));
    }
    linkWrap.appendChild(c);
    c.layoutSizingHorizontal = 'FILL';
  }

  var line = divider(0, '#2A3556');
  add(f, line, 'fill');

  var bot = flex2(MOBILE ? 6 : 26, { justify: 'SPACE_BETWEEN', align: 'MIN' });
  bot.appendChild(txt('© 2568 PIPOL TUTOR — สงวนลิขสิทธิ์ทุกประการ', { size: 13.5, color: '#93A2C9', nowrap: true }));
  bot.appendChild(txt('ออกแบบสำหรับนักเรียนที่ตั้งใจสอบเข้า จภ.', { size: 13.5, color: '#93A2C9', nowrap: true }));
  add(f, bot, 'fill');

  var note = row(0, { radius: 14 });
  pad(note, [13, 15]);
  stroke(note, '#2A3556', 1);
  var nt = txt('หมายเหตุสำหรับผู้ว่าจ้าง: ชื่อผู้สอน รูปภาพ ประวัติ ตัวเลขสถิติ คะแนน รีวิว และข้อความทั้งหมดเป็นเนื้อหาตัวอย่างเพื่อดูงานออกแบบ ต้องแทนที่ด้วยข้อมูลจริงก่อนเผยแพร่ และต้องขออนุญาตผู้ปกครองก่อนใช้ภาพหรือข้อความของนักเรียน',
    { size: 12.5, color: '#93A2C9', lh: 175 });
  note.appendChild(nt);
  add(f, note, 'fill');
  nt.layoutSizingHorizontal = 'FILL';
  return f;
}

// text-only footer for screens that should stay focused (login, exam, fortune)
function slimFooter(parent) {
  var f = col(0, { bg: C.footer, px: PAD });
  f.name = 'footer slim';
  f.paddingTop = 26; f.paddingBottom = 26;
  add(parent, f, 'fill');

  var bot = flex2(MOBILE ? 6 : 26, { justify: 'SPACE_BETWEEN', align: 'MIN' });
  bot.appendChild(txt('© 2568 PIPOL TUTOR — สงวนลิขสิทธิ์ทุกประการ', { size: 13.5, color: '#93A2C9', nowrap: true }));
  bot.appendChild(txt('ออกแบบสำหรับนักเรียนที่ตั้งใจสอบเข้า จภ.', { size: 13.5, color: '#93A2C9', nowrap: true }));
  add(f, bot, 'fill');
  return f;
}

function sectionHead(parent, title, sub, center) {
  var h = col(13, center ? { align: 'CENTER' } : {});
  var t = h2(title, { align: center ? 'CENTER' : 'LEFT' });
  h.appendChild(t);
  if (sub) {
    var p = txt(sub, { size: 16, color: C.ink2, align: center ? 'CENTER' : 'LEFT' });
    capW(p, center ? 760 : 640);
    h.appendChild(p);
  }
  add(parent, h, 'fill');
  t.layoutSizingHorizontal = 'FILL';
  return h;
}

// ---------------------------------------------------------------- shared blocks

function trustChip(iconName, title, sub, bg, fg) {
  var t = row(10, { bg: C.card, border: C.border, radius: 16, align: 'CENTER' });
  pad(t, [10, 15, 10, 11]);
  t.appendChild(iconTile(iconName, 33, bg, fg, 11));
  var c = col(0);
  c.appendChild(txt(title, { display: true, style: 'Medium', size: 14.5, lh: 132, nowrap: true }));
  c.appendChild(txt(sub, { size: 12.5, lh: 135, color: C.ink3, nowrap: true }));
  t.appendChild(c);
  return t;
}

// hero portrait with floating chips
function portrait(parent, w) {
  w = Math.min(w, contentW());
  var k = w / 520;                       // everything below was drawn against a 520 wide block
  var r = function (v) { return Math.round(v * k); };

  var wrap = col(0, { name: 'portrait' });
  wrap.resize(w, r(560));
  wrap.primaryAxisSizingMode = 'FIXED';
  wrap.counterAxisSizingMode = 'FIXED';
  wrap.layoutMode = 'NONE';
  noFill(wrap);
  wrap.clipsContent = false;

  var blob = figma.createEllipse();
  blob.resize(w - r(40), r(500));
  blob.x = r(26); blob.y = r(30);
  gradient(blob, C.brand, C.brandDark);
  blob.opacity = 0.14;
  wrap.appendChild(blob);

  var ph = slot(w - r(120), r(520), '#E9EEFB', '#DCE4FF', 'account_box', 'รูปพี่ที — ภาพหลัก', 'แนวตั้ง 4:4.5 · ครึ่งตัว พื้นหลังโล่ง');
  ph.cornerRadius = 28;
  shadow(ph, 'l');
  ph.x = r(60); ph.y = r(20);
  wrap.appendChild(ph);

  function floatChip(x, y, iconName, iconColor, title, sub) {
    var c = row(10, { bg: C.card, border: C.border, radius: 18, align: 'CENTER' });
    pad(c, [11, 15]);
    shadow(c, 'm');
    c.appendChild(icon(iconName, 22, iconColor));
    var t = col(0);
    t.appendChild(txt(title, { display: true, style: 'Medium', size: 15, lh: 128, nowrap: true }));
    t.appendChild(txt(sub, { size: 12.5, lh: 135, color: C.ink3, nowrap: true }));
    c.appendChild(t);
    wrap.appendChild(c);
    c.x = x; c.y = y;
    return c;
  }
  floatChip(0, r(96), 'menu_book', C.accent, 'สอนสด 24 ครั้ง', 'มีคลิปย้อนหลัง');
  var chip2 = floatChip(0, r(252), 'task_alt', C.teal, 'ข้อสอบจำลอง 100 ข้อ', 'ตรวจอัตโนมัติ');
  chip2.x = Math.max(0, w - chip2.width);

  var rate = col(3, { bg: C.card, border: C.border, radius: 18 });
  pad(rate, [13, 16]);
  shadow(rate, 'm');
  rate.appendChild(txt('4.9 / 5.0', { display: true, size: 17, lh: 128, nowrap: true }));
  var stars = row(2);
  for (var i = 0; i < 5; i++) stars.appendChild(icon('star', 15, C.amber));
  rate.appendChild(stars);
  rate.appendChild(txt('จากผู้ปกครอง 86 ท่าน', { size: 12.5, lh: 135, color: C.ink3, nowrap: true }));
  wrap.appendChild(rate);
  rate.x = r(30); rate.y = r(460);

  // The block is absolutely positioned and its cards are sized by their text, which
  // does not scale with the block. Left at a fixed height the rating card hangs out
  // of the bottom and lands on the section below, so grow the wrap to whatever the
  // children actually need.
  var need = 0;
  for (var c2 = 0; c2 < wrap.children.length; c2++) {
    var ch = wrap.children[c2];
    if (ch.y + ch.height > need) need = ch.y + ch.height;
  }
  wrap.resize(w, Math.max(r(560), Math.ceil(need) + 8));

  add(parent, wrap);
  return wrap;
}

function heroCopy(parent, pillText, pillIcon, title, lede, ctas) {
  var c = col(0);
  add(parent, c, 'fill');
  var p = pill(pillText, C.brand50, C.brandDark, pillIcon);
  c.appendChild(p);

  c.appendChild(vgap(18));

  var t = h1(title, { size: 46, lh: 128 });
  c.appendChild(t);
  t.layoutSizingHorizontal = 'FILL';
  c.appendChild(vgap(18));

  var l = txt(lede, { size: 18, color: C.ink2, lh: 180 });
  c.appendChild(l);
  l.layoutSizingHorizontal = 'FILL';
  c.appendChild(vgap(12));

  var r = btnRow(13);
  for (var i = 0; i < ctas.length; i++) r.appendChild(ctas[i]);
  c.appendChild(r);
  r.layoutSizingHorizontal = 'FILL';
  c.appendChild(vgap(12));

  var trust = row(11, { wrap: true, wrapGap: 11 });
  c.appendChild(trust);
  trust.layoutSizingHorizontal = 'FILL';
  trust.appendChild(trustChip('workspace_premium', 'ศิษย์เก่า จภ.', 'เข้า ม.1 ปี 2560', C.brand50, C.brand));
  trust.appendChild(trustChip('groups', 'นักเรียน 120+ คน', 'ตั้งแต่ปี 2563', C.teal50, C.teal));
  trust.appendChild(trustChip('history_edu', 'สอนมาแล้ว 6 รุ่น', 'พี่ทีสอนเองทุกคาบ', C.accent50, C.accentDark));

  // answers the note on the login button: what a signed-in user gets that a visitor does not
  c.appendChild(vgap(12));
  var m = small('เข้าสู่ระบบแล้วได้เพิ่ม — ทำข้อสอบจำลอง 100 ข้อ · ดูคะแนนรายบทย้อนหลัง · ดูคลิปติวย้อนหลัง · เข้ากลุ่ม LINE ถามพี่ที');
  c.appendChild(m); m.layoutSizingHorizontal = 'FILL';
  return c;
}

function planCard(parent, data) {
  var hot = data.hot;
  var c = col(18, { radius: 26, pad: 28, border: hot ? null : C.border, bg: hot ? null : C.card });
  if (hot) {
    gradient(c, C.brandDeep, C.brandDark);
    shadow(c, 'l');
    // a lifted navy panel on a navy page needs an edge — the light card gets its
    // separation from the white-on-page contrast, which night mode does not have
    if (THEME === 'dark') stroke(c, C.brand, 1.5);
  }
  else shadow(c, 's');
  add(parent, c, 'fill');

  var tag = pill(data.tag, hot ? C.accent : C.brand50, hot ? C.white : C.brand);
  c.appendChild(tag);

  var name = h3(data.name, { size: 22, color: hot ? C.white : C.ink });
  c.appendChild(name); name.layoutSizingHorizontal = 'FILL';
  var d = txt(data.desc, { size: 14.5, color: hot ? C.brand100 : C.ink3 });
  c.appendChild(d); d.layoutSizingHorizontal = 'FILL';

  var price = row(8, { align: 'BASELINE' });
  price.counterAxisAlignItems = 'BASELINE';
  price.appendChild(txt(data.price, { display: true, size: 40, lh: 110, color: hot ? C.white : C.ink, nowrap: true }));
  price.appendChild(txt(data.unit, { size: 14, color: hot ? C.brand100 : C.ink3, nowrap: true }));
  c.appendChild(price);

  var hr = divider(200, hot ? '#3B4C93' : C.border);
  c.appendChild(hr); hr.layoutSizingHorizontal = 'FILL';

  var list = col(11);
  c.appendChild(list); list.layoutSizingHorizontal = 'FILL';
  for (var i = 0; i < data.feats.length; i++) {
    var r = tick(data.feats[i], 'check_circle', hot ? '#5EE0D0' : C.teal, hot ? C.white : C.ink);
    list.appendChild(r);
    r.layoutSizingHorizontal = 'FILL';
    r.children[1].layoutSizingHorizontal = 'FILL';
  }

  // Two buttons on every card, per the PDF sketch: the quiet one to read more, the
  // loud one to sign up. They stack so neither is squeezed on a phone.
  var acts = col(10);
  c.appendChild(acts); acts.layoutSizingHorizontal = 'FILL';
  if (data.cta2) {
    var b2 = btn(data.cta2, hot ? 'light' : 'ghost');
    acts.appendChild(b2); b2.layoutSizingHorizontal = 'FILL';
  }
  var b = btn(data.cta, 'primary');
  acts.appendChild(b); b.layoutSizingHorizontal = 'FILL';
  return c;
}

function resultCard(parent, name, school, from, to, quote) {
  var c = card(15);
  add(parent, c, 'fill');
  var top = row(12, { align: 'CENTER' });
  var av = iconTile('person', 50, C.brand100, C.brand, 999);
  top.appendChild(av);
  var who = col(0);
  who.appendChild(txt(name, { display: true, style: 'Medium', size: 16, lh: 132, nowrap: true }));
  who.appendChild(txt(school, { size: 13, color: C.ink3, lh: 145, nowrap: true }));
  top.appendChild(who);
  c.appendChild(top);

  var sc = row(11, { bg: C.brand50, radius: 16, align: 'CENTER' });
  pad(sc, [13, 15]);
  c.appendChild(sc); sc.layoutSizingHorizontal = 'FILL';
  sc.appendChild(txt(from, { size: 14, color: C.ink3, nowrap: true }));
  sc.appendChild(icon('trending_flat', 20, C.teal));
  sc.appendChild(txt(to, { display: true, size: 23, lh: 120, color: C.brandDark, nowrap: true }));
  var sp = vgap(4);
  sc.appendChild(sp); sp.layoutSizingHorizontal = 'FILL';
  sc.appendChild(txt('คะแนน / 100', { size: 13, color: C.ink3, nowrap: true }));

  var q = txt(quote, { size: 15.5, color: C.ink2 });
  c.appendChild(q); q.layoutSizingHorizontal = 'FILL';
  return c;
}

function menuCard(parent, iconName, bg, fg, title, desc, meta) {
  var c = card(12, { radius: 22 });
  add(parent, c, 'fill');
  c.appendChild(iconTile(iconName, 48, bg, fg, 15));
  var t = h4(title); c.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  var d = txt(desc, { size: 14.5, color: C.ink2 }); c.appendChild(d); d.layoutSizingHorizontal = 'FILL';
  var f = row(10, { align: 'CENTER', justify: 'SPACE_BETWEEN' });
  f.appendChild(txt(meta, { size: 13, color: C.ink3, nowrap: true }));
  f.appendChild(icon('arrow_forward', 19, C.brand));
  c.appendChild(f); f.layoutSizingHorizontal = 'FILL';
  return c;
}

function statCard(parent, iconName, bg, fg, value, label) {
  var c = row(14, { bg: C.card, border: C.border, radius: 20, align: 'CENTER' });
  pad(c, [18, 20]);
  shadow(c, 's');
  add(parent, c, 'fill');
  c.appendChild(iconTile(iconName, 44, bg, fg, 14));
  var t = col(0);
  t.appendChild(txt(value, { display: true, size: 21, lh: 124, nowrap: true }));
  t.appendChild(txt(label, { size: 13.5, color: C.ink3, lh: 145, nowrap: true }));
  c.appendChild(t);
  return c;
}

function faqItem(parent, q, a, open) {
  var c = card(0, { radius: 18, pad: 20 });
  add(parent, c, 'fill');
  var head = row(16, { align: 'CENTER', justify: 'SPACE_BETWEEN' });
  var qt = txt(q, { display: true, style: 'Medium', size: 16.5, lh: 145 });
  head.appendChild(qt);
  head.appendChild(icon(open ? 'remove' : 'add', 23, C.brand));
  c.appendChild(head); head.layoutSizingHorizontal = 'FILL';
  qt.layoutSizingHorizontal = 'FILL';
  if (open) {
    c.appendChild(vgap(10));
    var at = txt(a, { size: 15.5, color: C.ink2 });
    c.appendChild(at); at.layoutSizingHorizontal = 'FILL';
  }
  return c;
}

// ---------------------------------------------------------------- screens

var PLANS = [
  { tag: 'ชุดข้อสอบ', name: 'ชุดข้อสอบเสมือนจริง', desc: 'เหมาะกับคนที่อยากวัดระดับตัวเองก่อน',
    price: '฿590', unit: '/ ชุด', cta: 'สมัครชุดข้อสอบ', cta2: 'ดูรายละเอียด', hot: false,
    feats: ['ข้อสอบจำลอง 100 ข้อ ครบ 5 วิชา', 'จับเวลาเสมือนห้องสอบจริง', 'ตรวจอัตโนมัติ + สรุปรายบท', 'ทำซ้ำได้ 3 ครั้ง'] },
  { tag: 'ยอดนิยม', name: 'คอร์สติวเข้า จภ. เต็มรูปแบบ', desc: 'คอร์สหลัก สอนสดครบทุกวิชาจนถึงวันสอบ',
    price: '฿4,900', unit: '/ คอร์ส', cta: 'สมัครคอร์สนี้', cta2: 'ดูรายละเอียด', hot: true,
    feats: ['ติวสด 24 ครั้ง + คลิปย้อนหลัง', 'เอกสารประกอบการเรียนแบบพิมพ์', 'ชุดข้อสอบเสมือนจริง 1 ชุด', 'กลุ่ม LINE ถามได้ตลอด', 'ติวเสริมเฉพาะกลุ่มก่อนสอบ'] },
  { tag: 'คุ้มที่สุด', name: 'คอร์ส + คลังข้อสอบทั้งหมด', desc: 'ได้ทุกอย่างของคอร์สหลัก บวกคลังข้อสอบทุกชุด',
    price: '฿5,200', unit: '/ แพ็ก', cta: 'สมัครแพ็กนี้', cta2: 'ดูรายละเอียด', hot: false,
    feats: ['ทุกอย่างในคอร์สเต็มรูปแบบ', 'คลังข้อสอบทุกชุด ไม่จำกัดครั้ง', 'รายงานวิเคราะห์รายสัปดาห์', 'ดูดวงแนวทางการสอบ 1 ครั้ง'] }
];

function buildPlans(parent) {
  var g = grid(parent, NARROW ? 16 : 22, 3);
  for (var i = 0; i < PLANS.length; i++) planCard(g, PLANS[i]);
  return g;
}

function buildResults(parent) {
  var g = grid(parent, NARROW ? 16 : 22, 3);
  resultCard(g, 'น้องปุ๊กกี้', 'สอบติด จภ. ปทุมธานี · รุ่น 5', '42', '78',
    'ตอนแรกพาร์ทเชาวน์ทำไม่ทันเลย พอทำข้อสอบซ้ำ ๆ แล้วดูสรุปว่าพลาดบทไหน คะแนนขึ้นมาเยอะมากค่ะ');
  resultCard(g, 'น้องเจได', 'สอบติด จภ. ชลบุรี · รุ่น 6', '55', '84',
    'ชอบระบบปักธงมากครับ ข้อไหนไม่มั่นใจกดธงไว้ก่อน ทำให้ไม่เสียเวลาจมอยู่ข้อเดียวจนหมดเวลา');
  resultCard(g, 'น้องแพรว', 'สอบติด จภ. เพชรบุรี · รุ่น 6', '48', '81',
    'พี่ทีตอบในไลน์ไวมาก ถามตอนสี่ทุ่มยังได้คำตอบ ทำให้ไม่ค้างคาไปถึงวันสอบค่ะ');
  return g;
}

// ---- 01 Landing
function screenLanding() {
  var f = screenFrame(PREFIX + '01 หน้าแรก');
  add(f, siteHeader('หน้าแรก', false), 'fill');

  var hero = band(f, { top: 56, bottom: 80 });
  hero.name = 'section / hero';
  var hr = flex(NARROW ? 34 : 58, { align: 'CENTER' });
  add(hero, hr, 'fill');
  heroCopy(hr, 'เปิดรับรุ่นที่ 7 · เหลือ 9 ที่นั่ง', 'local_fire_department',
    'ติวเข้า ม.1 จภ. กับพี่ที\nติวเตอร์ที่สอบเข้าเองมาก่อน',
    'คอร์สสอนสดครบ 5 วิชาตามแนวข้อสอบจริง พร้อมคลังข้อสอบเสมือนจริง 100 ข้อ ตรวจอัตโนมัติ และรายงานว่าน้องยังต้องซ่อมบทไหนบ้าง',
    [btn('ลองทำข้อสอบฟรี 10 ข้อ', 'primary', 'play_circle'), btn('ดูคอร์สและราคา', 'ghost', 'school')]);
  portrait(hr, 520);

  // what we do
  var wd = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  wd.name = 'section / เราทำอะไร';
  wd.itemSpacing = 40;
  fill(wd, C.card);
  sectionHead(wd, 'เราทำอะไรให้น้องบ้าง',
    'ไม่ใช่แค่คอร์สติว แต่เป็นระบบเตรียมสอบที่ทำให้รู้ว่าตอนนี้ยืนอยู่ตรงไหน และต้องซ่อมตรงไหนต่อ', true);
  var g = grid(wd, NARROW ? 16 : 20, 4);   // four cards — a three-column row spilled the fourth off the page
  menuCard(g, 'record_voice_over', C.brand50, C.brand, 'ติวสดทุกสัปดาห์', 'พี่ทีสอนเองครบทั้ง 5 วิชา มีคลิปย้อนหลังดูซ้ำได้ไม่จำกัด', 'สอนสด 24 ครั้ง');
  menuCard(g, 'quiz', C.teal50, C.teal, 'คลังข้อสอบจำลอง 100 ข้อ', 'ทำเสมือนจริง จับเวลา เลื่อนทีละข้อ ปักธงข้อที่ไม่มั่นใจไว้ได้', 'ทำซ้ำได้ 3 ครั้ง');
  menuCard(g, 'insights', C.accent50, C.accentDark, 'ตรวจและวิเคราะห์ทันที', 'ตรวจบนเซิร์ฟเวอร์ สรุปคะแนนรายบท บอกจุดที่ต้องซ่อมก่อน', 'รู้ผลทันทีที่ส่ง');
  menuCard(g, 'forum', C.green50, C.green, 'กลุ่ม LINE ส่วนตัว', 'จ่ายเงินเสร็จระบบส่งลิงก์เข้ากลุ่มอัตโนมัติ ถามได้จนถึงวันสอบ', 'ตอบเองทุกคำถาม');

  // results
  var rs = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  rs.name = 'section / ผลนักเรียน';
  rs.itemSpacing = 40;
  sectionHead(rs, 'ผลของรุ่นพี่ที่เรียนกับพี่ที',
    'คะแนนจากชุดข้อสอบเสมือนจริงชุดเดียวกัน ครั้งแรกเทียบกับครั้งสุดท้ายก่อนสอบ', true);
  buildResults(rs);

  // for parents — the client's note asks the page to catch the student first and
  // then settle the parent's mind, with the price coming after the reassurance
  var pn = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  pn.name = 'section / สำหรับผู้ปกครอง';
  pn.itemSpacing = 40;
  fill(pn, C.card);
  sectionHead(pn, 'ถึงผู้ปกครอง — สิ่งที่พี่ทีสัญญาไว้',
    'อยากให้เห็นภาพให้ครบก่อนตัดสินใจ ไม่มีโทรตาม ไม่มีการตื๊อให้สมัคร', true);
  var pg = grid(pn, NARROW ? 16 : 20, 3);
  menuCard(pg, 'verified_user', C.brand50, C.brand, 'พี่ทีสอนเองทุกคาบ',
    'ศิษย์เก่า จภ. เข้า ม.1 ปี 2560 สอนเองครบทั้ง 5 วิชา ไม่มีติวเตอร์มาสอนแทน', 'ดูประวัติพี่ที');
  menuCard(pg, 'insights', C.teal50, C.teal, 'เห็นความคืบหน้าทุกสัปดาห์',
    'ทำข้อสอบเสร็จมีรายงานคะแนนรายบททันที รู้ว่าน้องยังอ่อนบทไหนก่อนถึงวันสอบ', 'รายงานส่งเข้ากลุ่ม LINE');
  menuCard(pg, 'volunteer_activism', C.green50, C.green, 'ไม่ตรงกับที่คิดไว้ คืนเงินได้',
    'เรียนแล้วรู้สึกไม่ตรงกับที่คาดไว้ ทักมาในกลุ่มได้เลย คืนเงินตามเงื่อนไขที่เขียนไว้ชัด', 'อ่านนโยบายคืนเงิน');
  var pnote = txt('ถามก่อนได้ ไม่ต้องสมัคร — ทักไลน์มาคุยกับพี่ทีเรื่องแนวทางของน้องก่อนได้เลย',
    { size: 15, color: C.ink3, align: 'CENTER' });
  add(pn, pnote, 'fill');

  // countdown
  var cd = band(f, { top: 0, bottom: 40 });
  cd.name = 'section / countdown';
  var box = col(26, { radius: 28, pad: 44, align: 'CENTER' });
  gradient(box, C.brandDeep, C.brand);
  shadow(box, 'l');
  add(cd, box, 'fill');
  var ct = h2('นับถอยหลังสู่วันสอบคัดเลือก ม.1', { color: C.white, align: 'CENTER', size: 32 });
  box.appendChild(ct); ct.layoutSizingHorizontal = 'FILL';
  var cs = txt('สนามสอบ จภ. · 25 มกราคม 2569 — ปิดรับสมัครคอร์ส 30 กันยายน 2568',
    { size: 16, color: C.brand100, align: 'CENTER' });
  box.appendChild(cs); cs.layoutSizingHorizontal = 'FILL';
  var tiles = row(14, { justify: 'CENTER' });
  box.appendChild(tiles); tiles.layoutSizingHorizontal = 'FILL';
  var urgent = countdownUrgent();
  var td = [[String(COUNTDOWN_DAYS), 'วัน'], ['06', 'ชั่วโมง'], ['42', 'นาที'], ['19', 'วินาที']];
  for (var i = 0; i < td.length; i++) {
    var t = col(7, { radius: 20, align: 'CENTER' });
    pad(t, [18, 10]);
    // close to the exam the tiles go orange — the one place the accent is spent twice
    // on this screen, and only because the urgency is the message
    if (urgent) { fill(t, C.accent); stroke(t, C.accentDark, 1); }
    else { fill(t, C.white, 0.12); stroke(t, C.white, 1, 0.18); }
    if (!MOBILE) { t.resize(150, t.height); t.counterAxisSizingMode = 'FIXED'; t.primaryAxisSizingMode = 'AUTO'; }
    t.appendChild(txt(td[i][0], { display: true, size: 38, lh: 105, color: C.white, align: 'CENTER', nowrap: true }));
    t.appendChild(txt(td[i][1], { size: 13, color: urgent ? C.white : C.brand100, align: 'CENTER', nowrap: true }));
    tiles.appendChild(t);
    if (MOBILE) t.layoutSizingHorizontal = 'FILL';
  }

  // pricing
  var pr = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  pr.name = 'section / คอร์ส';
  pr.itemSpacing = 40;
  fill(pr, C.card);
  sectionHead(pr, 'ถ้าพร้อมแล้ว เลือกแบบที่ตรงกับน้องที่สุด',
    'ดูให้ครบก่อนค่อยตัดสินใจ จ่ายครั้งเดียวใช้ได้ถึงวันสอบ ชำระเงินเสร็จระบบเปิดสิทธิ์ทันทีพร้อมส่งลิงก์เข้ากลุ่ม LINE', true);
  buildPlans(pr);

  ctaBand(f);
  siteFooter(f);
  return f;
}

// ---- 02 About
function screenAbout() {
  var f = screenFrame(PREFIX + '02 รู้จักพี่ที');
  add(f, siteHeader('รู้จักพี่ที', false), 'fill');

  var hero = band(f, { top: 56, bottom: 80 });
  hero.name = 'section / hero';
  var hr = flex(NARROW ? 34 : 58, { align: 'CENTER' });
  add(hero, hr, 'fill');
  heroCopy(hr, 'ผู้สอนคนเดียว ดูแลเองทุกรุ่น', 'verified',
    'สวัสดีครับ พี่ชื่อ “ที”\nติวเตอร์ที่เคยสอบเข้า จภ. ด้วยตัวเอง',
    'พี่สอนเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัยมา 6 ปี ดูแลนักเรียนมาแล้วกว่า 120 คน ทุกคอร์สพี่สอนเอง ตรวจงานเอง และตอบคำถามในกลุ่มเอง ไม่มีการส่งต่อให้ผู้ช่วย',
    [btn('ดูคอร์สของพี่ที', 'primary', 'school'), btn('ทักไลน์ถามก่อนได้', 'line', 'chat_bubble')]);
  portrait(hr, 520);

  // credential band
  var cb = band(f, { top: 38, bottom: 38 });
  cb.name = 'section / วุฒิ';
  gradient(cb, C.brandDeep, C.brand);
  var cg = grid(cb, NARROW ? 24 : 36, 4);  // four credentials, four columns
  var creds = [
    ['school', 'จภ. ปทุมธานี', 'ศิษย์เก่า เข้าเรียน ม.1 ปี 2560'],
    ['engineering', 'วิศวกรรมศาสตร์', 'มหาวิทยาลัยเกษตรศาสตร์'],
    ['edit_document', 'เขียนข้อสอบเอง', 'คลังข้อสอบเสมือนจริง 100 ข้อ'],
    ['diversity_3', 'รับ 40 คน / รุ่น', 'เพื่อให้ตอบคำถามได้ทั่วถึง']
  ];
  for (var i = 0; i < creds.length; i++) {
    var it = row(14, { align: 'MIN' });
    it.appendChild(icon(creds[i][0], 27, '#9DB2FF'));
    var c2 = col(2);
    c2.appendChild(txt(creds[i][1], { display: true, style: 'Medium', size: 21, lh: 126, color: C.white }));
    c2.appendChild(txt(creds[i][2], { size: 14, color: '#BFCCFF', lh: 155 }));
    it.appendChild(c2);
    add(cg, it, 'fill');
    c2.layoutSizingHorizontal = 'FILL';
    c2.children[0].layoutSizingHorizontal = 'FILL';
    c2.children[1].layoutSizingHorizontal = 'FILL';
  }

  // why rows
  var wy = band(f, { top: 76, bottom: 40 });
  wy.name = 'section / ทำไมต้องพี่ที';
  wy.itemSpacing = 44;
  sectionHead(wy, 'ทำไมผู้ปกครองถึงเลือกให้ลูกเรียนกับพี่ที',
    'สามอย่างที่พี่ทำต่างจากคอร์สติวทั่วไป และเป็นเหตุผลที่นักเรียนส่วนใหญ่มาจากการบอกต่อ', false);

  var rowsData = [
    { n: '1', flip: false, tintA: '#EEF2FF', tintB: '#E1E8FF', icon: 'record_voice_over',
      slotTitle: 'รูปพี่ทีกำลังสอนหน้าห้อง', slotNote: 'แนวนอน 4:3 · เห็นกระดานและนักเรียนในเฟรม',
      h: 'พี่สอนเองทุกคาบ ไม่ส่งต่อให้ผู้ช่วย',
      p: 'คนที่น้องเห็นในคลิปแนะนำ คือคนเดียวกับที่ยืนสอนจริงทุกสัปดาห์ ตรวจการบ้านเอง และตอบคำถามในกลุ่มเอง พี่เลยจำได้ว่าน้องคนไหนติดตรงไหน โดยไม่ต้องเปิดดูประวัติ',
      t: ['สอนสด 24 ครั้ง ครบทั้ง 5 วิชาตามแนวข้อสอบ จภ.', 'มีคลิปย้อนหลังให้ดูซ้ำได้ไม่จำกัดจนถึงวันสอบ', 'เอกสารประกอบการเรียนแบบพิมพ์ ส่งถึงบ้าน'] },
    { n: '2', flip: true, tintA: '#DFF7F3', tintB: '#CFF1EB', icon: 'devices',
      slotTitle: 'ภาพหน้าจอระบบทำข้อสอบ', slotNote: 'แนวนอน 4:3 · ถ่ายจากจอจริง พร้อมธงสีรายข้อ',
      h: 'วัดผลเป็นตัวเลขทุกสัปดาห์ ไม่ต้องเดาว่าพร้อมหรือยัง',
      p: 'น้องทำข้อสอบเสมือนจริง 100 ข้อบนเว็บ จับเวลาเหมือนห้องสอบจริง ปักธงข้อที่ไม่มั่นใจไว้กลับมาทบทวนได้ ระบบตรวจให้ทันทีแล้วสรุปว่าบทไหนยังพลาดซ้ำ',
      t: ['ตรวจคำตอบบนเซิร์ฟเวอร์ เฉลยไม่หลุดออกมาที่เครื่องน้อง', 'คำตอบถูกบันทึกอัตโนมัติ ทำค้างไว้แล้วกลับมาทำต่อได้', 'รายงานคะแนนรายบท ผู้ปกครองดูได้ด้วย'] },
    { n: '3', flip: false, tintA: '#FFEDE4', tintB: '#FFDCCC', icon: 'forum',
      slotTitle: 'รูปหมู่นักเรียนรุ่นที่ผ่านมา', slotNote: 'แนวนอน 4:3 · ขออนุญาตผู้ปกครองก่อนใช้ภาพเด็ก',
      h: 'กลุ่ม LINE ส่วนตัว ถามได้จนถึงวันสอบ',
      p: 'ชำระเงินเสร็จ ระบบเปิดสิทธิ์และส่งลิงก์เข้ากลุ่มให้อัตโนมัติ ในกลุ่มพี่ตอบคำถามเองทุกข้อ ส่วนใหญ่ได้คำตอบภายในคืนเดียว และมีสรุปสิ่งที่ต้องอ่านให้ทุกวันอาทิตย์',
      t: ['ถ่ายรูปโจทย์ที่ติดส่งเข้ากลุ่มได้เลย', 'แจ้งข่าวการรับสมัครและกำหนดการสอบให้ตลอด', 'ผู้ปกครองเข้ากลุ่มดูได้ ไม่มีอะไรปิดบัง'] }
  ];
  for (var k = 0; k < rowsData.length; k++) {
    var d = rowsData[k];
    var r = flex(NARROW ? 44 : 56, { align: 'CENTER' });
    add(wy, r, 'fill');

    // The photo is a 4:3 slot, so the block that holds it has to be 4:3 too. Pinning
    // the height instead (it used to be 340 when stacked) left the photo hanging 110px
    // past the bottom on a tablet, straight over the paragraph underneath.
    var slW = Math.min(600, contentW());
    var slH = Math.round(slW * 0.75);
    var media = col(0, { name: 'media' });
    media.layoutMode = 'NONE';
    media.resize(slW, slH);
    noFill(media);
    media.clipsContent = false;
    var sl = slot(slW, slH, d.tintA, d.tintB, d.icon, d.slotTitle, d.slotNote);
    shadow(sl, 'm');
    sl.x = 0; sl.y = 0;
    media.appendChild(sl);
    var badge = col(0, { bg: C.accent, radius: 17, align: 'CENTER', justify: 'CENTER' });
    badge.resize(50, 50);
    badge.primaryAxisSizingMode = 'FIXED';
    badge.counterAxisSizingMode = 'FIXED';
    shadow(badge, 'm');
    badge.appendChild(txt(d.n, { display: true, size: 20, lh: 110, color: C.white }));
    media.appendChild(badge);
    badge.x = -10; badge.y = -14;

    var copy = col(13);
    var ht = h3(d.h, { size: 27 });
    copy.appendChild(ht);
    var pt = txt(d.p, { size: 16, color: C.ink2 });
    copy.appendChild(pt);
    var ticks = col(10);
    copy.appendChild(ticks);
    for (var m = 0; m < d.t.length; m++) {
      var tk = tick(d.t[m]);
      ticks.appendChild(tk);
    }

    if (d.flip) { r.appendChild(copy); r.appendChild(media); }
    else { r.appendChild(media); r.appendChild(copy); }
    copy.layoutSizingHorizontal = 'FILL';
    ht.layoutSizingHorizontal = 'FILL';
    pt.layoutSizingHorizontal = 'FILL';
    ticks.layoutSizingHorizontal = 'FILL';
    for (var q = 0; q < ticks.children.length; q++) {
      ticks.children[q].layoutSizingHorizontal = 'FILL';
      ticks.children[q].children[1].layoutSizingHorizontal = 'FILL';
    }
  }

  // timeline
  var tl = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  tl.name = 'section / เส้นทาง';
  tl.itemSpacing = 40;
  fill(tl, C.card);
  sectionHead(tl, 'เส้นทางกว่าจะมาเป็นคอร์สนี้',
    'ทุกรุ่นที่ผ่านมาเปลี่ยนเนื้อหาและชุดข้อสอบไปทีละนิด จนมาเป็นรูปแบบปัจจุบัน', true);
  var tg = flex(NARROW ? 16 : 20, { align: 'MIN' });
  add(tl, tg, 'fill');
  var steps = [
    ['2560', 'สอบติด จภ.', 'เข้าเรียน ม.1 สายวิทย์–คณิต ที่ จภ. ปทุมธานี', false],
    ['2562', 'เริ่มติวรุ่นน้อง', 'ติวให้รุ่นน้องในโรงเรียนช่วงเย็น ไม่คิดค่าใช้จ่าย', false],
    ['2563', 'เปิดคอร์สรุ่นแรก', 'นักเรียน 12 คน สอบติด 8 คน สอนที่บ้านตัวเอง', false],
    ['2566', 'ทำคลังข้อสอบเอง', 'เขียนข้อสอบเสมือนจริงชุดแรก 100 ข้อจากข้อผิดที่เจอซ้ำ', false],
    ['2568', 'ย้ายขึ้นออนไลน์', 'ตรวจอัตโนมัติ วิเคราะห์รายบท เปิดรับรุ่นที่ 7', true]
  ];
  for (var i2 = 0; i2 < steps.length; i2++) {
    var st = col(14);
    var dot = col(0, { radius: 999, align: 'CENTER', justify: 'CENTER' });
    dot.resize(52, 52);
    dot.primaryAxisSizingMode = 'FIXED';
    dot.counterAxisSizingMode = 'FIXED';
    if (steps[i2][3]) { fill(dot, C.brand); } else { fill(dot, C.card); stroke(dot, C.borderStrong, 3); }
    dot.appendChild(txt(steps[i2][0], { display: true, style: 'Medium', size: 13.5, lh: 120, color: steps[i2][3] ? C.white : C.ink2 }));
    st.appendChild(dot);
    var sh = h4(steps[i2][1], { size: 17 });
    st.appendChild(sh);
    var sp2 = txt(steps[i2][2], { size: 14.5, color: C.ink2, lh: 165 });
    st.appendChild(sp2);
    add(tg, st, 'fill');
    sh.layoutSizingHorizontal = 'FILL';
    sp2.layoutSizingHorizontal = 'FILL';
  }

  // parent chat
  var pc = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  pc.name = 'section / เสียงผู้ปกครอง';
  pc.itemSpacing = 36;
  sectionHead(pc, 'เสียงจากผู้ปกครอง', 'ข้อความจากกลุ่ม LINE ของรุ่นที่ผ่านมา (ขออนุญาตเผยแพร่แล้ว)', true);
  var chat = card(16, { radius: 26, pad: 28 });
  capW(chat, 900);
  chat.counterAxisSizingMode = 'FIXED';
  pc.appendChild(chat);
  var chd = row(12, { align: 'CENTER' });
  chat.appendChild(chd); chd.layoutSizingHorizontal = 'FILL';
  chd.appendChild(iconTile('forum', 38, C.line50, C.line, 12));
  chd.appendChild(txt('กลุ่ม PIPOL TUTOR รุ่นที่ 6', { display: true, style: 'Medium', size: 16, lh: 140, nowrap: true }));
  var chsp = vgap(4);
  chd.appendChild(chsp); chsp.layoutSizingHorizontal = 'FILL';
  chd.appendChild(txt('ผู้ปกครอง 38 ท่าน', { size: 13, color: C.ink3, nowrap: true }));
  var chline = divider(200, C.border);
  chat.appendChild(chline); chline.layoutSizingHorizontal = 'FILL';

  var msgs = [
    ['them', 'ขอบคุณคุณครูมากนะคะ ลูกกลับมาบอกว่าครั้งนี้ทำข้อสอบทันทุกข้อเป็นครั้งแรกเลย', 'คุณแม่น้องปุ๊กกี้'],
    ['me', 'ดีใจด้วยครับ ที่เห็นชัดคือพาร์ทคำนวณเร็วขึ้นเยอะ เดี๋ยวอาทิตย์หน้าเพิ่มโจทย์เชาวน์ให้อีกชุดนะครับ', 'พี่ที'],
    ['them', 'ที่ประทับใจคือมีรายงานคะแนนให้ผู้ปกครองดูด้วย ทำให้รู้ว่าต้องช่วยลูกตรงไหน ไม่ต้องคอยถามลูกอย่างเดียวครับ', 'คุณพ่อน้องเจได'],
    ['them', 'ถามอะไรตอบไวมากค่ะ ไม่เคยปล่อยให้รอข้ามวัน', 'คุณแม่น้องแพรว']
  ];
  var mlist = col(11);
  chat.appendChild(mlist); mlist.layoutSizingHorizontal = 'FILL';
  for (var mi = 0; mi < msgs.length; mi++) {
    var wrapRow = row(0, { justify: msgs[mi][0] === 'me' ? 'MAX' : 'MIN' });
    mlist.appendChild(wrapRow); wrapRow.layoutSizingHorizontal = 'FILL';
    var bub = col(5, { radius: 20, pad: 15 });
    if (msgs[mi][0] === 'me') { fill(bub, '#DFF7E9'); stroke(bub, '#BFE9D2', 1); }
    else { fill(bub, C.page); stroke(bub, C.border, 1); }
    capW(bub, NARROW ? contentW() - 90 : 660);
    bub.counterAxisSizingMode = 'FIXED';
    var bt = txt(msgs[mi][1], { size: 15.5, color: C.ink });
    bub.appendChild(bt); bt.layoutSizingHorizontal = 'FILL';
    var bs = txt(msgs[mi][2], { size: 12, color: C.ink3, lh: 140 });
    bub.appendChild(bs); bs.layoutSizingHorizontal = 'FILL';
    wrapRow.appendChild(bub);
  }

  // faq
  var fq = band(f, { top: 76, bottom: 40, align: 'CENTER' });
  fq.name = 'section / FAQ';
  fq.itemSpacing = 30;
  fill(fq, C.card);
  sectionHead(fq, 'คำถามที่ผู้ปกครองถามบ่อย', null, true);
  var fl = col(11);
  capW(fl, 900);
  fl.counterAxisSizingMode = 'FIXED';
  fq.appendChild(fl);
  faqItem(fl, 'พี่ทีสอนเองจริงไหม หรือมีผู้ช่วยสอนแทน',
    'สอนเองทุกคาบครับ ทั้งสอนสด ตรวจงาน และตอบคำถามในกลุ่ม LINE ไม่มีผู้ช่วยสอนแทน นี่คือเหตุผลที่รับได้แค่ 40 คนต่อรุ่น', true);
  faqItem(fl, 'ถ้าเรียนไม่ทัน หรือติดธุระวันที่สอนสด ทำอย่างไร',
    'ทุกคาบมีคลิปย้อนหลังให้ดูซ้ำได้ไม่จำกัดจนถึงวันสอบ และถามค้างไว้ในกลุ่มได้ตลอด ไม่มีการตัดสิทธิ์ถ้าเข้าเรียนสดไม่ครบ', false);
  faqItem(fl, 'ผู้ปกครองดูความคืบหน้าของลูกได้ไหม',
    'ได้ครับ ทุกครั้งที่น้องทำข้อสอบ ระบบจะสรุปคะแนนรายบทและเวลาเฉลี่ยต่อข้อ ผู้ปกครองเข้าดูได้จากบัญชีเดียวกัน', false);
  faqItem(fl, 'จ่ายเงินแล้วเริ่มเรียนได้เลยไหม',
    'ได้ทันทีครับ เมื่อชำระเงินสำเร็จ ระบบจะเปิดสิทธิ์เข้าเรียนและส่งลิงก์เข้ากลุ่ม LINE ให้อัตโนมัติ ไม่ต้องรอแอดมินยืนยัน', false);

  ctaBand(f);
  siteFooter(f);
  return f;
}

// ---- 03 Login
function screenLogin() {
  var f = screenFrame(PREFIX + '03 เข้าสู่ระบบ');
  add(f, siteHeader('หน้าแรก', false), 'fill');

  var r = flex(0, { align: 'CENTER' });
  add(f, r, 'fill');
  if (NARROW) { r.primaryAxisSizingMode = 'AUTO'; }
  else { r.resize(W, 860); r.counterAxisSizingMode = 'FIXED'; }

  var left = col(22, { justify: 'CENTER' });
  pad(left, [56, 56]);
  gradient(left, C.brandDeep, C.brand);
  if (!NARROW) {
    left.resize(620, 860);
    left.primaryAxisSizingMode = 'FIXED';
    left.counterAxisSizingMode = 'FIXED';
  }
  r.appendChild(left);
  if (NARROW) left.layoutSizingHorizontal = 'FILL';
  left.appendChild(brandMark(44, true));
  var lt = h2('เข้าสู่ระบบเพื่อเริ่มทำข้อสอบ\nและดูคะแนนของน้อง', { color: C.white, size: 33 });
  left.appendChild(lt); lt.layoutSizingHorizontal = 'FILL';
  var lp = txt('ระบบใช้บัญชี Google ในการยืนยันตัวตน เพื่อให้คำตอบและคะแนนของน้องถูกบันทึกไว้ต่อเนื่อง ไม่หายแม้เปลี่ยนเครื่อง',
    { size: 16.5, color: C.brand100 });
  left.appendChild(lp); lp.layoutSizingHorizontal = 'FILL';
  var lf = col(14);
  left.appendChild(lf); lf.layoutSizingHorizontal = 'FILL';
  var lfeat = [
    ['cloud_done', 'คำตอบถูกบันทึกอัตโนมัติบนเซิร์ฟเวอร์'],
    ['lock', 'เฉลยเก็บไว้ฝั่งเซิร์ฟเวอร์ ไม่ส่งมาที่เครื่องน้อง'],
    ['devices', 'ทำต่อจากเครื่องไหนก็ได้ ทั้งมือถือและคอม']
  ];
  for (var i = 0; i < lfeat.length; i++) {
    var t = tick(lfeat[i][1], lfeat[i][0], '#5EE0D0', C.brand100);
    lf.appendChild(t); t.layoutSizingHorizontal = 'FILL';
    t.children[1].layoutSizingHorizontal = 'FILL';
  }

  var right = col(0, { bg: C.card, align: 'CENTER', justify: 'CENTER' });
  pad(right, [56, 56]);
  r.appendChild(right);
  right.layoutSizingHorizontal = 'FILL';
  right.layoutSizingVertical = 'FILL';

  var cardBox = col(20, { align: 'CENTER' });
  capW(cardBox, 440);
  cardBox.counterAxisSizingMode = 'FIXED';
  right.appendChild(cardBox);
  var ct = h2('ยินดีต้อนรับกลับมา', { size: 26, align: 'CENTER' });
  cardBox.appendChild(ct); ct.layoutSizingHorizontal = 'FILL';
  var cp = txt('เข้าสู่ระบบด้วยบัญชี Google ของน้อง\nไม่ต้องตั้งรหัสผ่านใหม่', { size: 16, color: C.ink2, align: 'CENTER' });
  cardBox.appendChild(cp); cp.layoutSizingHorizontal = 'FILL';

  var g = row(12, { bg: C.card, radius: 999, align: 'CENTER', justify: 'CENTER' });
  pad(g, [15, 24]);
  stroke(g, C.borderStrong, 1.5);
  shadow(g, 's');
  var dot = figma.createEllipse();
  dot.resize(22, 22);
  fill(dot, '#EA4335');
  g.appendChild(dot);
  g.appendChild(txt('ดำเนินการต่อด้วย Google', { display: true, style: 'Medium', size: 16, lh: 130, nowrap: true }));
  cardBox.appendChild(g); g.layoutSizingHorizontal = 'FILL';

  var dv = row(14, { align: 'CENTER' });
  var d1 = divider(120, C.border), d2 = divider(120, C.border);
  dv.appendChild(d1);
  dv.appendChild(txt('ระบบรองรับเฉพาะ Google', { size: 13, color: C.ink3, nowrap: true }));
  dv.appendChild(d2);
  cardBox.appendChild(dv); dv.layoutSizingHorizontal = 'FILL';
  d1.layoutSizingHorizontal = 'FILL'; d2.layoutSizingHorizontal = 'FILL';

  var nb = row(11, { bg: C.brand50, radius: 16, align: 'MIN' });
  pad(nb, [14, 16]);
  nb.appendChild(icon('info', 20, C.brand));
  var nt = txt('ถ้าน้องซื้อคอร์สไว้แล้ว ระบบจะเปิดสิทธิ์ให้อัตโนมัติเมื่อเข้าสู่ระบบด้วยอีเมลเดียวกับที่ใช้ชำระเงิน',
    { size: 14.5, color: C.ink2 });
  nb.appendChild(nt);
  cardBox.appendChild(nb); nb.layoutSizingHorizontal = 'FILL'; nt.layoutSizingHorizontal = 'FILL';

  var tm = txt('การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว',
    { size: 13.5, color: C.ink3, align: 'CENTER' });
  cardBox.appendChild(tm); tm.layoutSizingHorizontal = 'FILL';

  slimFooter(f);
  return f;
}

// ---- 04 Dashboard
function screenDashboard() {
  var f = screenFrame(PREFIX + '04 เมนูหลัก');
  add(f, siteHeader('หน้าแรก', true), 'fill');

  var b = band(f, { top: 40, bottom: 72 });
  b.itemSpacing = 30;
  b.name = 'section / dashboard';

  var head = flex2(MOBILE ? 16 : 20, { align: MOBILE ? 'MIN' : 'CENTER', justify: 'SPACE_BETWEEN' });
  add(b, head, 'fill');
  var hl = col(6);
  hl.appendChild(h2('สวัสดีน้องมิ้นท์', { size: 32 }));
  hl.appendChild(txt('เหลืออีก 128 วันก่อนสอบ — สัปดาห์นี้ยังเหลือชุดข้อสอบที่ยังไม่ได้ทำ 1 ชุด', { size: 16, color: C.ink2 }));
  head.appendChild(hl); hl.layoutSizingHorizontal = 'FILL';
  head.appendChild(btn('ทำข้อสอบต่อจากข้อ 12', 'primary', 'play_arrow'));

  var sg = grid(b, NARROW ? 16 : 20, 4);
  statCard(sg, 'assignment_turned_in', C.brand50, C.brand, '68 / 100', 'ข้อที่ทำไปแล้ว');
  statCard(sg, 'flag', C.red50, C.red, '7 ข้อ', 'ปักธงไว้ทบทวน');
  statCard(sg, 'trending_up', C.green50, C.green, '72%', 'คะแนนเฉลี่ยล่าสุด');
  statCard(sg, 'schedule', C.accent50, C.accentDark, '128 วัน', 'เหลือถึงวันสอบ');

  var mh = h3('เมนูทั้งหมด', { size: 22 });
  add(b, mh, 'fill');

  var g1 = grid(b, NARROW ? 16 : 20, 3);
  menuCard(g1, 'play_lesson', C.brand50, C.brand, 'คอร์สของฉัน', 'ดูคลิปย้อนหลังและเอกสารประกอบ', 'เรียนไปแล้ว 14 / 24 ครั้ง');
  menuCard(g1, 'quiz', C.teal50, C.teal, 'ทำข้อสอบ', 'ชุดข้อสอบเสมือนจริง 100 ข้อ', 'ทำค้างไว้ที่ข้อ 12');
  menuCard(g1, 'insights', C.accent50, C.accentDark, 'ผลคะแนนและวิเคราะห์', 'สรุปคะแนนรายบทและจุดอ่อน', 'อัปเดตล่าสุด 3 วันที่แล้ว');

  var g2 = grid(b, NARROW ? 16 : 20, 3);
  menuCard(g2, 'shopping_bag', C.amber50, '#B45309', 'ซื้อคอร์ส / ชุดข้อสอบ', 'ดูรายการที่ยังไม่ได้ซื้อ', 'มีชุดใหม่ 2 ชุด');
  menuCard(g2, 'auto_awesome', C.mystic50, C.mystic, 'ดูดวงแนวทางสอบ', 'กรอกข้อมูลเพื่อดูคำทำนาย', 'ใช้สิทธิ์ได้อีก 1 ครั้ง');
  menuCard(g2, 'forum', C.green50, C.green, 'กลุ่ม LINE', 'เข้ากลุ่มถามพี่ทีได้ตลอด', 'เข้ากลุ่มแล้ว');

  siteFooter(f);
  return f;
}

// ---- 05 Catalog
function screenCatalog() {
  var f = screenFrame(PREFIX + '05 คอร์ส & ข้อสอบ');
  add(f, siteHeader('คอร์สเรียน', false), 'fill');

  var b = band(f, { top: 48, bottom: 72 });
  b.itemSpacing = 34;
  var head = col(14);
  add(b, head, 'fill');
  head.appendChild(pill('คอร์สและชุดข้อสอบทั้งหมด', C.brand50, C.brandDark, 'shopping_bag'));
  var t = h1('เลือกสิ่งที่ตรงกับจังหวะของน้อง', { size: 42 });
  head.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  var p = txt('ซื้อครั้งเดียว ใช้ได้ถึงวันสอบ 25 มกราคม 2569 ชำระเงินสำเร็จระบบเปิดสิทธิ์ให้อัตโนมัติทันที',
    { size: 18, color: C.ink2 });
  head.appendChild(p); p.layoutSizingHorizontal = 'FILL';

  buildPlans(b);

  var g = row(14, { bg: C.card, border: C.border, radius: 20, align: 'CENTER' });
  pad(g, 22);
  add(b, g, 'fill');
  g.appendChild(icon('shield', 24, C.brand));
  var gc = col(2);
  gc.appendChild(txt('ไม่พอใจภายใน 7 วันแรก คืนเงินเต็มจำนวน', { display: true, style: 'Medium', size: 16, lh: 140 }));
  gc.appendChild(txt('เงื่อนไขเป็นไปตามนโยบายการคืนเงิน', { size: 14.5, color: C.ink3 }));
  g.appendChild(gc); gc.layoutSizingHorizontal = 'FILL';
  var gb = btn('อ่านนโยบาย', 'ghost');
  pad(gb, [12, 19]);
  g.appendChild(gb);

  siteFooter(f);
  return f;
}

// ---- 06 Course detail
function screenCourseDetail() {
  var f = screenFrame(PREFIX + '06 รายละเอียดคอร์ส');
  add(f, siteHeader('คอร์สเรียน', false), 'fill');

  var b = band(f, { top: 36, bottom: 72 });
  b.itemSpacing = 18;
  var crumb = txt('คอร์สเรียน · คอร์สติวเข้า จภ. เต็มรูปแบบ', { size: 14, color: C.ink3 });
  add(b, crumb, 'fill');

  var split = flex2(NARROW ? 28 : 40, { align: 'MIN' });
  add(b, split, 'fill');

  var main = col(0);
  split.appendChild(main);
  main.layoutSizingHorizontal = 'FILL';
  main.appendChild(pill('รุ่นที่ 7 · เหลือ 9 ที่นั่ง', C.accent50, C.accentDark, 'local_fire_department'));
  main.appendChild(vgap(14));
  var t = h1('คอร์สติวเข้า จภ. เต็มรูปแบบ', { size: 40 });
  main.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  main.appendChild(vgap(14));
  var lede = txt('สอนสด 24 ครั้งโดยพี่ที ครบทั้ง 5 วิชาตามแนวข้อสอบคัดเลือก ม.1 พร้อมชุดข้อสอบเสมือนจริงและกลุ่ม LINE ส่วนตัวจนถึงวันสอบ',
    { size: 18, color: C.ink2 });
  main.appendChild(lede); lede.layoutSizingHorizontal = 'FILL';
  main.appendChild(vgap(26));

  var vidW = Math.min(820, contentW());
  var vid = slot(vidW, Math.round(vidW * 0.5634), '#EEF2FF', '#E1E8FF', 'smart_display', 'คลิปแนะนำคอร์ส', 'แนวนอน 16:9 · พี่ทีพูดแนะนำคอร์ส 60–90 วินาที');
  shadow(vid, 'm');
  main.appendChild(vid); vid.layoutSizingHorizontal = 'FILL';
  main.appendChild(vgap(34));

  var h1a = h3('คอร์สนี้เหมาะกับใคร', { size: 22 });
  main.appendChild(h1a); h1a.layoutSizingHorizontal = 'FILL';
  main.appendChild(vgap(16));
  var who = col(10);
  main.appendChild(who); who.layoutSizingHorizontal = 'FILL';
  var whoList = ['น้อง ม.6 ที่ตั้งใจสอบเข้า ม.1 จภ. รอบคัดเลือก', 'คนที่อ่านเองแล้วไม่รู้ว่าตัวเองอ่อนตรงไหน', 'คนที่ทำข้อสอบไม่ทันเวลา แม้จะทำโจทย์ได้'];
  for (var i = 0; i < whoList.length; i++) {
    var tk = tick(whoList[i]);
    who.appendChild(tk); tk.layoutSizingHorizontal = 'FILL';
    tk.children[1].layoutSizingHorizontal = 'FILL';
  }
  main.appendChild(vgap(34));

  var h2a = h3('เนื้อหาในคอร์ส', { size: 22 });
  main.appendChild(h2a); h2a.layoutSizingHorizontal = 'FILL';
  main.appendChild(vgap(16));
  var lessons = card(0, { pad: 8 });
  lessons.paddingLeft = lessons.paddingRight = 22;
  main.appendChild(lessons); lessons.layoutSizingHorizontal = 'FILL';
  var ld = [
    ['01', 'คณิตศาสตร์ · พื้นฐานที่ออกสอบซ้ำทุกปี', '6 ครั้ง · จำนวน อัตราส่วน สมการ เรขาคณิต', '6 ชม.'],
    ['02', 'วิทยาศาสตร์ · ฟิสิกส์ เคมี ชีวะเบื้องต้น', '6 ครั้ง · เน้นโจทย์วิเคราะห์และการทดลอง', '6 ชม.'],
    ['03', 'ความสามารถทางเชาวน์', '5 ครั้ง · อนุกรม มิติสัมพันธ์ ตรรกะ', '5 ชม.'],
    ['04', 'ภาษาไทยและภาษาอังกฤษ', '4 ครั้ง · การอ่านจับใจความและคำศัพท์', '4 ชม.'],
    ['05', 'ตะลุยโจทย์และจับเวลาก่อนสอบ', '3 ครั้ง · ทำข้อสอบเต็มชุดพร้อมเฉลยละเอียด', '4.5 ชม.']
  ];
  for (var j = 0; j < ld.length; j++) {
    var lr = row(14, { align: 'MIN' });
    pad(lr, [15, 0]);
    lessons.appendChild(lr); lr.layoutSizingHorizontal = 'FILL';
    lr.appendChild(numTile(ld[j][0], 34, C.brand50, C.brandDark, 11));
    var lc = col(2);
    lc.appendChild(txt(ld[j][1], { display: true, style: 'Medium', size: 16, lh: 145 }));
    lc.appendChild(txt(ld[j][2], { size: 14, color: C.ink3, lh: 155 }));
    lr.appendChild(lc); lc.layoutSizingHorizontal = 'FILL';
    lr.appendChild(txt(ld[j][3], { size: 13.5, color: C.ink3, nowrap: true }));
    if (j < ld.length - 1) {
      var dv2 = divider(200, C.border);
      lessons.appendChild(dv2); dv2.layoutSizingHorizontal = 'FILL';
    }
  }

  // buy box
  var aside = card(16, { pad: 24, shadow: 'm' });
  split.appendChild(aside);
  railW(aside, 380);
  aside.appendChild(pill('เริ่มเรียน 5 ต.ค. 2568', C.brand50, C.brandDark, 'event_available'));
  var pr = row(8);
  pr.counterAxisAlignItems = 'BASELINE';
  pr.appendChild(txt('฿4,900', { display: true, size: 36, lh: 112, nowrap: true }));
  pr.appendChild(txt('จ่ายครั้งเดียว', { size: 14, color: C.ink3, nowrap: true }));
  aside.appendChild(pr);
  var pn = txt('ใช้สิทธิ์ได้ถึงวันสอบ 25 มกราคม 2569', { size: 14.5, color: C.ink2 });
  aside.appendChild(pn); pn.layoutSizingHorizontal = 'FILL';
  var b1 = btn('สมัครคอร์สนี้', 'primary', 'shopping_cart');
  aside.appendChild(b1); b1.layoutSizingHorizontal = 'FILL';
  var b2 = btn('ถามพี่ทีก่อนตัดสินใจ', 'line', 'chat_bubble');
  aside.appendChild(b2); b2.layoutSizingHorizontal = 'FILL';
  var ad = divider(200, C.border);
  aside.appendChild(ad); ad.layoutSizingHorizontal = 'FILL';
  var incl = col(10);
  aside.appendChild(incl); incl.layoutSizingHorizontal = 'FILL';
  var inclList = ['สอนสด 24 ครั้ง + คลิปย้อนหลัง', 'ชุดข้อสอบเสมือนจริง 1 ชุด', 'เอกสารแบบพิมพ์ส่งถึงบ้าน', 'กลุ่ม LINE ส่วนตัวจนถึงวันสอบ'];
  for (var k = 0; k < inclList.length; k++) {
    var tk2 = tick(inclList[k]);
    incl.appendChild(tk2); tk2.layoutSizingHorizontal = 'FILL';
    tk2.children[1].layoutSizingHorizontal = 'FILL';
  }
  var nb2 = row(11, { bg: C.brand50, radius: 16, align: 'MIN' });
  pad(nb2, [14, 16]);
  nb2.appendChild(icon('lock', 20, C.brand));
  var nt2 = txt('ชำระเงินผ่านระบบที่ปลอดภัย ระบบเปิดสิทธิ์อัตโนมัติทันทีที่ชำระสำเร็จ', { size: 14, color: C.ink2 });
  nb2.appendChild(nt2);
  aside.appendChild(nb2); nb2.layoutSizingHorizontal = 'FILL'; nt2.layoutSizingHorizontal = 'FILL';

  siteFooter(f);
  return f;
}

// ---- 07 Checkout
// The 18 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย campuses — options for the "จภ. ที่ต้องการสอบเข้า" dropdown.
var PCSHS_CAMPUSES = [
  'จภ. เชียงราย', 'จภ. พิษณุโลก', 'จภ. ลพบุรี', 'จภ. ปทุมธานี', 'จภ. ชลบุรี', 'จภ. เพชรบุรี',
  'จภ. นครศรีธรรมราช', 'จภ. ตรัง', 'จภ. สตูล', 'จภ. มุกดาหาร', 'จภ. เลย', 'จภ. บุรีรัมย์',
  'จภ. กาฬสินธุ์', 'จภ. กาญจนบุรี', 'จภ. กำแพงเพชร', 'จภ. ลำปาง', 'จภ. สระแก้ว', 'จภ. สุพรรณบุรี'
];
function screenCheckout() {
  var f = screenFrame(PREFIX + '07 ชำระเงิน');
  add(f, siteHeader('คอร์สเรียน', false), 'fill');

  var b = band(f, { top: 40, bottom: 72 });
  b.itemSpacing = 26;
  var head = col(8);
  add(b, head, 'fill');
  var t = h1('ชำระเงิน', { size: 36 });
  head.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  head.appendChild(txt('ขั้นตอนที่ 2 จาก 3 · เลือกวิธีชำระเงิน', { size: 16, color: C.ink2 }));

  var split = flex2(NARROW ? 28 : 40, { align: 'MIN' });
  add(b, split, 'fill');

  var main = col(22);
  split.appendChild(main); main.layoutSizingHorizontal = 'FILL';

  var info = card(16);
  main.appendChild(info); info.layoutSizingHorizontal = 'FILL';
  info.appendChild(h3('ข้อมูลผู้เรียน', { size: 19 }));
  // [label, value, kind, hint] — kind 'select' draws a dropdown (chevron); options come from PCSHS_CAMPUSES
  var fields = [
    ['ชื่อ-นามสกุลนักเรียน', 'ด.ญ. มิ้นท์ ใจดี', 'text', null],
    ['โรงเรียนปัจจุบัน', 'โรงเรียนสาธิตปทุมธานี', 'text', null],
    ['จภ. ที่ต้องการสอบเข้า', PCSHS_CAMPUSES[3], 'select', 'เลือกได้ 1 แห่งจาก 18 แห่งทั่วประเทศ'],
    ['Instagram นักเรียน', '@mint.jaidee', 'text', 'ใช้ติดต่อน้องโดยตรงและส่งข่าวรุ่น'],
    ['เบอร์ผู้ปกครอง', '08x-xxx-xxxx', 'text', null],
    ['อีเมลรับใบเสร็จ', 'parent@example.com', 'text', null]
  ];
  for (var i = 0; i < fields.length; i += 2) {
    var fr = flex2(16, { align: 'MIN' });
    info.appendChild(fr); fr.layoutSizingHorizontal = 'FILL';
    for (var j = i; j < i + 2 && j < fields.length; j++) {
      var fc = col(8);
      fc.appendChild(txt(fields[j][0], { display: true, style: 'Medium', size: 14.5, lh: 140 }));
      var inp = row(10, { bg: C.page, border: C.border, borderW: 1.5, radius: 14, align: 'CENTER' });
      pad(inp, [14, 16]);
      var iv = txt(fields[j][1], { size: 16 });
      inp.appendChild(iv);
      if (fields[j][2] === 'select') {
        var isp = vgap(4);
        inp.appendChild(isp); isp.layoutSizingHorizontal = 'FILL';
        inp.appendChild(icon('expand_more', 20, C.ink3));
      } else {
        iv.layoutSizingHorizontal = 'FILL';
      }
      fc.appendChild(inp);
      add(fr, fc, 'fill');
      inp.layoutSizingHorizontal = 'FILL';
      if (fields[j][3]) {
        var hint = txt(fields[j][3], { size: 13, color: C.ink3 });
        fc.appendChild(hint); hint.layoutSizingHorizontal = 'FILL';
      }
    }
  }

  var pay = card(14);
  main.appendChild(pay); pay.layoutSizingHorizontal = 'FILL';
  pay.appendChild(h3('วิธีชำระเงิน', { size: 19 }));
  var methods = [
    ['พร้อมเพย์ / สแกน QR', 'สแกนแล้วระบบตรวจสอบอัตโนมัติภายใน 1 นาที', 'PromptPay', true],
    ['บัตรเครดิต / เดบิต', 'Visa, Mastercard, JCB · ผ่อน 0% ได้บางธนาคาร', 'Card', false],
    ['โอนผ่านโมบายแบงก์กิ้ง', 'เลือกธนาคารแล้วยืนยันในแอป', 'Mobile Banking', false]
  ];
  for (var m = 0; m < methods.length; m++) {
    var sel = methods[m][3];
    var pr2 = row(14, { radius: 18, align: 'CENTER' });
    pad(pr2, 16);
    stroke(pr2, sel ? C.brand : C.border, 1.5);
    if (sel) fill(pr2, C.brand50); else noFill(pr2);
    pay.appendChild(pr2); pr2.layoutSizingHorizontal = 'FILL';

    var radio = col(0, { radius: 999, align: 'CENTER', justify: 'CENTER' });
    radio.resize(22, 22);
    radio.primaryAxisSizingMode = 'FIXED';
    radio.counterAxisSizingMode = 'FIXED';
    noFill(radio);
    stroke(radio, sel ? C.brand : C.borderStrong, 2);
    if (sel) {
      var inner = figma.createEllipse();
      inner.resize(11, 11);
      fill(inner, C.brand);
      radio.appendChild(inner);
    }
    pr2.appendChild(radio);

    var pc2 = col(2);
    pc2.appendChild(txt(methods[m][0], { display: true, style: 'Medium', size: 16, lh: 142 }));
    pc2.appendChild(txt(methods[m][1], { size: 13.5, color: C.ink3, lh: 155 }));
    pr2.appendChild(pc2); pc2.layoutSizingHorizontal = 'FILL';

    var logo = row(0, { bg: C.page, border: C.border, radius: 8 });
    pad(logo, [5, 9]);
    logo.appendChild(txt(methods[m][2], { size: 12, color: C.ink3, nowrap: true }));
    pr2.appendChild(logo);
  }
  var sec = row(11, { bg: C.brand50, radius: 16, align: 'MIN' });
  pad(sec, [14, 16]);
  sec.appendChild(icon('verified_user', 20, C.brand));
  var secT = txt('ระบบไม่เก็บเลขบัตรของท่านไว้บนเว็บไซต์ ทุกขั้นตอนดำเนินการผ่านผู้ให้บริการชำระเงินที่ได้มาตรฐาน',
    { size: 14.5, color: C.ink2 });
  sec.appendChild(secT);
  pay.appendChild(sec); sec.layoutSizingHorizontal = 'FILL'; secT.layoutSizingHorizontal = 'FILL';

  // summary
  var aside = card(16, { pad: 24, shadow: 'm' });
  split.appendChild(aside);
  railW(aside, 380);
  aside.appendChild(h3('สรุปคำสั่งซื้อ', { size: 19 }));
  var item = row(14, { align: 'MIN' });
  item.appendChild(iconTile('school', 34, C.brand50, C.brandDark, 11));
  var ic2 = col(2);
  ic2.appendChild(txt('คอร์สติวเข้า จภ. เต็มรูปแบบ', { display: true, style: 'Medium', size: 15.5, lh: 145 }));
  ic2.appendChild(txt('รุ่นที่ 7 · เริ่ม 5 ต.ค. 2568', { size: 13.5, color: C.ink3, lh: 155 }));
  item.appendChild(ic2);
  aside.appendChild(item); item.layoutSizingHorizontal = 'FILL'; ic2.layoutSizingHorizontal = 'FILL';
  var sd = divider(200, C.border);
  aside.appendChild(sd); sd.layoutSizingHorizontal = 'FILL';

  var sums = [['ราคาคอร์ส', '฿4,900', C.ink], ['ส่วนลดรุ่นที่ 7 (สมัครก่อน 30 ก.ย.)', '−฿400', C.green], ['ค่าจัดส่งเอกสาร', 'ฟรี', C.ink]];
  var sumCol = col(2);
  aside.appendChild(sumCol); sumCol.layoutSizingHorizontal = 'FILL';
  for (var s2 = 0; s2 < sums.length; s2++) {
    var sr = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
    pad(sr, [9, 0]);
    var sl = txt(sums[s2][0], { size: 15 });
    sr.appendChild(sl);
    sr.appendChild(txt(sums[s2][1], { size: 15, color: sums[s2][2], nowrap: true }));
    sumCol.appendChild(sr); sr.layoutSizingHorizontal = 'FILL'; sl.layoutSizingHorizontal = 'FILL';
  }
  var sd2 = divider(200, C.border);
  aside.appendChild(sd2); sd2.layoutSizingHorizontal = 'FILL';
  var total = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
  total.appendChild(txt('ยอดชำระทั้งหมด', { size: 17 }));
  total.appendChild(txt('฿4,500', { display: true, size: 26, lh: 120, color: C.brandDark, nowrap: true }));
  aside.appendChild(total); total.layoutSizingHorizontal = 'FILL';
  var pb = btn('ยืนยันและชำระเงิน', 'primary', 'lock');
  aside.appendChild(pb); pb.layoutSizingHorizontal = 'FILL';
  var pt = txt('เมื่อกดยืนยัน ถือว่ายอมรับเงื่อนไขการใช้งานและนโยบายการคืนเงิน', { size: 13, color: C.ink3 });
  aside.appendChild(pt); pt.layoutSizingHorizontal = 'FILL';

  siteFooter(f);
  return f;
}

// ---- 08 Success
function screenSuccess() {
  var f = screenFrame(PREFIX + '08 ชำระเงินสำเร็จ');
  add(f, siteHeader('คอร์สเรียน', true), 'fill');

  var b = band(f, { top: 70, bottom: 80, align: 'CENTER' });
  b.itemSpacing = 20;

  var wrap = col(20, { align: 'CENTER' });
  capW(wrap, 760);
  wrap.counterAxisSizingMode = 'FIXED';
  b.appendChild(wrap);

  var seal = col(0, { radius: 999, align: 'CENTER', justify: 'CENTER' });
  seal.resize(96, 96);
  seal.primaryAxisSizingMode = 'FIXED';
  seal.counterAxisSizingMode = 'FIXED';
  fill(seal, C.green50);
  stroke(seal, '#BFE9D2', 3);
  seal.appendChild(icon('check', 50, C.green));
  wrap.appendChild(seal);

  var t = h1('ชำระเงินสำเร็จแล้ว', { size: 36, align: 'CENTER' });
  wrap.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  var p = txt('ระบบเปิดสิทธิ์เข้าเรียนให้เรียบร้อย น้องเริ่มทำข้อสอบและดูคลิปได้ทันที ใบเสร็จส่งไปที่ parent@example.com แล้ว',
    { size: 16, color: C.ink2, align: 'CENTER' });
  wrap.appendChild(p); p.layoutSizingHorizontal = 'FILL';

  var lineCard = row(18, { radius: 24, align: 'CENTER' });
  pad(lineCard, 26);
  gradient(lineCard, C.line, '#04A445');
  shadow(lineCard, 'm');
  wrap.appendChild(lineCard); lineCard.layoutSizingHorizontal = 'FILL';
  lineCard.appendChild(icon('forum', 38, C.white));
  var lc = col(4);
  lc.appendChild(txt('เข้ากลุ่ม LINE ของรุ่นที่ 7', { display: true, style: 'Medium', size: 19, lh: 140, color: C.white }));
  lc.appendChild(txt('ลิงก์นี้ใช้ได้เฉพาะบัญชีที่ชำระเงินแล้ว กรุณาเข้ากลุ่มภายใน 7 วัน', { size: 14.5, color: '#DFF7E9', lh: 160 }));
  lineCard.appendChild(lc); lc.layoutSizingHorizontal = 'FILL';
  var lb = btn('เข้ากลุ่มเลย', 'light', 'open_in_new');
  pad(lb, [13, 20]);
  lineCard.appendChild(lb);

  var order = card(2, { pad: 24, radius: 22 });
  wrap.appendChild(order); order.layoutSizingHorizontal = 'FILL';
  var od = [['หมายเลขคำสั่งซื้อ', 'PT-2568-00417'], ['รายการ', 'คอร์สติวเข้า จภ. เต็มรูปแบบ (รุ่นที่ 7)'],
            ['วิธีชำระเงิน', 'พร้อมเพย์ · 20 ส.ค. 2568 21:14 น.'], ['สิทธิ์ใช้งานถึง', '25 มกราคม 2569']];
  for (var i = 0; i < od.length; i++) {
    var orow = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
    pad(orow, [9, 0]);
    var ol = txt(od[i][0], { size: 15, color: C.ink2 });
    orow.appendChild(ol);
    orow.appendChild(txt(od[i][1], { size: 15, nowrap: true }));
    order.appendChild(orow); orow.layoutSizingHorizontal = 'FILL'; ol.layoutSizingHorizontal = 'FILL';
  }
  var odv = divider(200, C.border);
  order.appendChild(odv); odv.layoutSizingHorizontal = 'FILL';
  var otot = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
  pad(otot, [12, 0, 0, 0]);
  otot.appendChild(txt('ยอดที่ชำระ', { size: 17 }));
  otot.appendChild(txt('฿4,500', { display: true, size: 26, lh: 120, color: C.brandDark, nowrap: true }));
  order.appendChild(otot); otot.layoutSizingHorizontal = 'FILL';

  var acts = btnRow(13, { justify: 'CENTER' });
  acts.appendChild(btn('เริ่มทำข้อสอบชุดแรก', 'primary', 'quiz'));
  acts.appendChild(btn('ไปที่คอร์สของฉัน', 'ghost', 'play_lesson'));
  wrap.appendChild(acts); acts.layoutSizingHorizontal = 'FILL';

  siteFooter(f);
  return f;
}

// ---- 09 Exam engine
function screenExam() {
  var f = screenFrame(PREFIX + '09 ทำข้อสอบ');

  // ---- exam bar: identity, streak, XP, time
  var topbar = row(NARROW ? 10 : 18, { bg: C.card, align: 'CENTER', px: PAD, py: 14 });
  topbar.name = 'exam bar';
  add(f, topbar, 'fill');
  if (NARROW) {
    topbar.layoutWrap = 'WRAP';
    topbar.counterAxisSpacing = 10;
  }

  var who = row(12, { align: 'CENTER' });
  who.appendChild(avatar('ป', 46, C.mystic, C.brand));
  var bt = col(2);
  var bn = row(8, { align: 'CENTER' });
  bn.appendChild(txt('น้องปุ๊กกี้', { display: true, size: 16, lh: 130, nowrap: true }));
  bn.appendChild(pill('เลเวล 7', C.mystic50, C.mystic, 'workspace_premium'));
  bt.appendChild(bn);
  bt.appendChild(txt('ชุดข้อสอบเสมือนจริง ชุดที่ 1 · 100 ข้อ', { size: 12.5, color: C.ink3, lh: 140, nowrap: true }));
  who.appendChild(bt);
  topbar.appendChild(who);

  if (!NARROW) {
    var spacer = vgap(4);
    topbar.appendChild(spacer); spacer.layoutSizingHorizontal = 'FILL';
  }

  topbar.appendChild(pill('ทำติดกัน 5 วัน', C.accent50, C.accentDark, 'local_fire_department'));
  topbar.appendChild(pill('+240 XP วันนี้', C.mystic50, C.mystic, 'bolt'));

  var saved = row(7, { bg: C.green50, radius: 999, align: 'CENTER' });
  pad(saved, [8, 14]);
  saved.appendChild(icon('cloud_done', 17, C.green));
  saved.appendChild(txt('เซฟให้แล้ว', { size: 13.5, color: C.green, nowrap: true }));
  topbar.appendChild(saved);

  var timer = row(9, { bg: C.accent50, radius: 999, align: 'CENTER' });
  pad(timer, [9, 16]);
  timer.appendChild(icon('timer', 19, C.accentDark));
  timer.appendChild(txt('48:12', { display: true, size: 17, lh: 120, color: C.accentDark, nowrap: true }));
  topbar.appendChild(timer);

  var quit = row(8, { bg: C.card, radius: 999, align: 'CENTER' });
  pad(quit, [9, 16]);
  stroke(quit, C.borderStrong, 1.5);
  quit.appendChild(icon('pause_circle', 19, C.ink2));
  quit.appendChild(txt('พักไว้ก่อน', { display: true, style: 'Medium', size: 14.5, lh: 130, color: C.ink2, nowrap: true }));
  topbar.appendChild(quit);

  // ---- subject tabs: the bar promises 5 subjects, this is where they live
  var subs = row(10, { bg: C.card, align: 'CENTER', px: PAD });
  subs.name = 'subject tabs';
  subs.paddingBottom = 14;
  add(f, subs, 'fill');
  if (NARROW) {
    subs.layoutWrap = 'WRAP';
    subs.counterAxisSpacing = 10;
  }
  var sd = [
    ['คณิตศาสตร์', 'functions', 30, 24, true],
    ['วิทยาศาสตร์', 'science', 30, 21, false],
    ['ความสามารถทั่วไป', 'extension', 15, 12, false],
    ['ภาษาไทย', 'menu_book', 15, 8, false],
    ['ภาษาอังกฤษ', 'translate', 10, 3, false]
  ];
  for (var s0 = 0; s0 < sd.length; s0++) {
    var on = sd[s0][4];
    var tab = row(9, { radius: 999, align: 'CENTER' });
    pad(tab, [10, 18]);
    if (on) { fill(tab, C.brand50); stroke(tab, C.brand, 1.5); }
    else { fill(tab, C.page); stroke(tab, C.border, 1.5); }
    tab.appendChild(icon(sd[s0][1], 18, on ? C.brand : C.ink3));
    tab.appendChild(txt(sd[s0][0], { display: true, style: 'Medium', size: 14.5, lh: 130, color: on ? C.brandDark : C.ink2, nowrap: true }));
    tab.appendChild(txt(sd[s0][3] + '/' + sd[s0][2], { size: 13, lh: 140, color: on ? C.brand : C.ink3, nowrap: true }));
    subs.appendChild(tab);
  }
  if (!NARROW) {
    var subsp = vgap(4);
    subs.appendChild(subsp); subsp.layoutSizingHorizontal = 'FILL';
    subs.appendChild(txt('ข้ามไปวิชาไหนก่อนก็ได้ คำตอบเก็บแยกตามวิชา', { size: 13, color: C.ink3, lh: 150, nowrap: true }));
  }
  add(f, divider(W), 'fill');

  var b = band(f, { top: 26, bottom: 56 });
  var g = flex(NARROW ? 16 : 28, { align: 'MIN' });
  add(b, g, 'fill');

  var left = col(18);
  g.appendChild(left); left.layoutSizingHorizontal = 'FILL';

  // ---- checkpoint track: the reward loop, first thing on the page
  var quest = card(14, { radius: 26, pad: 24 });
  left.appendChild(quest); quest.layoutSizingHorizontal = 'FILL';
  var qh = row(12, { align: 'CENTER' });
  quest.appendChild(qh); qh.layoutSizingHorizontal = 'FILL';
  qh.appendChild(icon('flag_circle', 24, C.mystic));
  qh.appendChild(txt('ด่านวันนี้', { display: true, size: 18, lh: 135, nowrap: true }));
  var qsp0 = vgap(4);
  qh.appendChild(qsp0); qsp0.layoutSizingHorizontal = 'FILL';
  qh.appendChild(txt('อีก 7 ข้อถึงด่าน 75 ข้อ', { display: true, style: 'Medium', size: 15, lh: 135, color: C.mystic, nowrap: true }));

  var qbar = bar(0.68, C.mystic, 600, 14);
  quest.appendChild(qbar); qbar.layoutSizingHorizontal = 'FILL';

  var cps = row(0, { justify: 'SPACE_BETWEEN', align: 'MIN' });
  quest.appendChild(cps); cps.layoutSizingHorizontal = 'FILL';
  var cpd = [
    ['25', 'ครบ 25 ข้อ', 'check_circle', 'done'],
    ['50', 'ครบ 50 ข้อ', 'check_circle', 'done'],
    ['75', 'อีก 7 ข้อ', 'bolt', 'next'],
    ['100', 'จบชุด', 'emoji_events', 'lock']
  ];
  for (var ci = 0; ci < cpd.length; ci++) {
    var st = cpd[ci][3];
    var cp = col(7, { align: 'CENTER' });
    var dotBg = st === 'done' ? C.green50 : (st === 'next' ? C.mystic50 : C.page);
    var dotFg = st === 'done' ? C.green : (st === 'next' ? C.mystic : C.ink3);
    var dot = iconTile(cpd[ci][2], 44, dotBg, dotFg, 999);
    if (st === 'next') stroke(dot, C.mystic, 2);
    else if (st === 'lock') stroke(dot, C.border, 1.5);
    cp.appendChild(dot);
    cp.appendChild(txt(cpd[ci][1], {
      display: true, style: 'Medium', size: 13, lh: 140,
      color: st === 'lock' ? C.ink3 : C.ink2, align: 'CENTER', nowrap: true
    }));
    cps.appendChild(cp);
  }

  // ---- coach message
  var msg = row(12, { bg: C.amber50, radius: 20, align: 'MIN' });
  pad(msg, [16, 18]);
  left.appendChild(msg); msg.layoutSizingHorizontal = 'FILL';
  msg.appendChild(icon('sentiment_very_satisfied', 22, '#B45309'));
  var mc = col(2);
  mc.appendChild(txt('อีก 48 นาที กำลังดีเลย', { display: true, style: 'Medium', size: 15.5, lh: 145, color: '#7C4A03' }));
  mc.appendChild(txt('เหลืออีก 32 ข้อ ข้อไหนยากข้ามไปก่อนได้ เดี๋ยวค่อยวนกลับมาเก็บ', { size: 15, color: '#7C4A03', lh: 165 }));
  msg.appendChild(mc); mc.layoutSizingHorizontal = 'FILL';
  msg.appendChild(icon('close', 20, C.ink3));

  // ---- question card
  var q = card(0, { radius: 28, pad: 34, shadow: 'm' });
  left.appendChild(q); q.layoutSizingHorizontal = 'FILL';

  var qt = row(14, { align: 'CENTER' });
  q.appendChild(qt); qt.layoutSizingHorizontal = 'FILL';
  if (MOBILE) { qt.layoutWrap = 'WRAP'; qt.counterAxisSpacing = 12; }
  qt.appendChild(txt('ข้อ 12', { display: true, size: 22, lh: 125, nowrap: true }));
  qt.appendChild(pill('คณิตศาสตร์ · สมการเชิงเส้น', C.brand50, C.brandDark, 'functions'));
  var qsp = vgap(4);
  qt.appendChild(qsp); qsp.layoutSizingHorizontal = 'FILL';
  var flag = row(8, { bg: C.card, radius: 999, align: 'CENTER' });
  pad(flag, [10, 18]);
  stroke(flag, C.borderStrong, 1.5);
  flag.appendChild(icon('flag', 19, C.ink2));
  flag.appendChild(txt('ปักธงไว้ทบทวน', { display: true, style: 'Medium', size: 14.5, lh: 130, color: C.ink2, nowrap: true }));
  qt.appendChild(flag);

  q.appendChild(vgap(18));
  var qb = txt('ถ้า 3x + 7 = 25 แล้วค่าของ x² − 2x เท่ากับข้อใด', { size: 20, lh: 185 });
  q.appendChild(qb); qb.layoutSizingHorizontal = 'FILL';
  q.appendChild(vgap(18));

  var fig = col(6, { radius: 18, align: 'CENTER', justify: 'CENTER' });
  pad(fig, 22);
  fill(fig, C.page);
  stroke(fig, C.borderStrong, 1);
  fig.appendChild(icon('image', 26, C.ink3));
  fig.appendChild(txt('พื้นที่สำหรับรูปประกอบโจทย์ (ถ้ามี) — รองรับรูปภาพและตาราง', { size: 13.5, color: C.ink3, align: 'CENTER' }));
  q.appendChild(fig); fig.layoutSizingHorizontal = 'FILL';
  fig.children[1].layoutSizingHorizontal = 'FILL';
  q.appendChild(vgap(18));

  var opts = col(12);
  q.appendChild(opts); opts.layoutSizingHorizontal = 'FILL';
  var od = [['ก', '18', false], ['ข', '24', true], ['ค', '30', false], ['ง', '36', false]];
  for (var i = 0; i < od.length; i++) {
    var sel = od[i][2];
    var o = row(16, { radius: 20, align: 'CENTER' });
    pad(o, [16, 20]);
    if (sel) { fill(o, C.brand50); stroke(o, C.brand, 2); }
    else { fill(o, C.card); stroke(o, C.border, 1.5); }
    opts.appendChild(o); o.layoutSizingHorizontal = 'FILL';
    var key = col(0, { radius: 14, align: 'CENTER', justify: 'CENTER' });
    key.resize(42, 42);
    key.primaryAxisSizingMode = 'FIXED';
    key.counterAxisSizingMode = 'FIXED';
    if (sel) fill(key, C.brand); else { fill(key, C.page); stroke(key, C.border, 1); }
    key.appendChild(txt(od[i][0], { display: true, style: 'Medium', size: 17, lh: 120, color: sel ? C.white : C.ink2 }));
    o.appendChild(key);
    var ov = txt(od[i][1], { size: 17.5 });
    o.appendChild(ov); ov.layoutSizingHorizontal = 'FILL';
    if (sel) o.appendChild(icon('check_circle', 24, C.brand));
  }

  q.appendChild(vgap(22));
  var nav = flex2(14, { justify: 'SPACE_BETWEEN', align: MOBILE ? 'CENTER' : 'CENTER' });
  q.appendChild(nav); nav.layoutSizingHorizontal = 'FILL';
  nav.appendChild(btn('ข้อก่อนหน้า', 'ghost', 'arrow_back'));
  var clr = row(8, { align: 'CENTER' });
  clr.appendChild(icon('backspace', 18, C.ink3));
  clr.appendChild(txt('ล้างคำตอบข้อนี้', { display: true, style: 'Medium', size: 14.5, lh: 130, color: C.ink3, nowrap: true }));
  nav.appendChild(clr);
  nav.appendChild(btn('ข้อถัดไป', 'brand', 'arrow_forward', true));

  q.appendChild(vgap(12));
  var kb = txt('เคล็ดลับ: กดปุ่ม ก ข ค ง บนคีย์บอร์ดเลือกคำตอบได้ กดลูกศรซ้ายขวาเปลี่ยนข้อ', { size: 13, color: C.ink3, lh: 155, align: 'CENTER' });
  q.appendChild(kb); kb.layoutSizingHorizontal = 'FILL';

  // ---- security note
  var sec = row(12, { bg: C.brand50, radius: 20, align: 'MIN' });
  pad(sec, [15, 18]);
  left.appendChild(sec); sec.layoutSizingHorizontal = 'FILL';
  sec.appendChild(icon('lock', 21, C.brand));
  var sc2 = col(2);
  sc2.appendChild(txt('เฉลยไม่ถูกส่งมาที่เครื่องของน้อง', { display: true, style: 'Medium', size: 15.5, lh: 145 }));
  sc2.appendChild(txt('ระบบตรวจคำตอบบนเซิร์ฟเวอร์ทั้งหมด เปิด F12 หรือดูซอร์สโค้ดก็ไม่พบเฉลย', { size: 15, color: C.ink2, lh: 165 }));
  sec.appendChild(sc2); sc2.layoutSizingHorizontal = 'FILL';

  // ---- side panel
  var side = card(18, { pad: 22, radius: 28 });
  g.appendChild(side);
  railW(side, 330);

  // stacked under the question the rail is full width, which is too wide for one
  // column of small controls, so a tablet splits it in two
  var sideA = side, sideB = side;
  if (TABLET) {
    var sideSplit = row(22, { align: 'MIN' });
    side.appendChild(sideSplit); sideSplit.layoutSizingHorizontal = 'FILL';
    sideA = col(18);
    sideB = col(18);
    sideSplit.appendChild(sideA); sideA.layoutSizingHorizontal = 'FILL';
    sideSplit.appendChild(sideB); sideB.layoutSizingHorizontal = 'FILL';
  }

  var rw = col(10, { align: 'CENTER' });
  sideA.appendChild(rw); rw.layoutSizingHorizontal = 'FILL';
  rw.appendChild(ring(0.68, 156, 16, C.brand, '68', 'จาก 100 ข้อ'));
  rw.appendChild(txt('ตอบแล้ว 68 ข้อ · ปักธงไว้ 7 ข้อ', { size: 13.5, color: C.ink3, lh: 155, align: 'CENTER', nowrap: true }));

  var lv = col(8, { bg: C.mystic50, radius: 18 });
  pad(lv, [14, 16]);
  sideA.appendChild(lv); lv.layoutSizingHorizontal = 'FILL';
  var lvh = row(9, { align: 'CENTER' });
  lv.appendChild(lvh); lvh.layoutSizingHorizontal = 'FILL';
  lvh.appendChild(icon('bolt', 19, C.mystic));
  lvh.appendChild(txt('เลเวล 7', { display: true, style: 'Medium', size: 15, lh: 135, nowrap: true }));
  var lvsp = vgap(4);
  lvh.appendChild(lvsp); lvsp.layoutSizingHorizontal = 'FILL';
  lvh.appendChild(txt('240 / 300 XP', { size: 13, color: C.mystic, lh: 140, nowrap: true }));
  var lvb = bar(0.8, C.mystic, 254, 9);
  lv.appendChild(lvb); lvb.layoutSizingHorizontal = 'FILL';
  var lvn = txt('อีก 60 XP ขึ้นเลเวล 8 ปลดกรอบโปรไฟล์ใหม่', { size: 12.5, color: C.ink2, lh: 155 });
  lv.appendChild(lvn); lvn.layoutSizingHorizontal = 'FILL';

  var palette = row(5, { wrap: true, wrapGap: 5 });
  palette.resize(TABLET ? Math.round((contentW() - 66) / 2) : (MOBILE ? contentW() - 84 : 286), 100);
  palette.primaryAxisSizingMode = 'FIXED';
  palette.counterAxisSizingMode = 'AUTO';
  sideB.appendChild(palette); palette.layoutSizingHorizontal = 'FILL';
  var flags = { 4: 1, 9: 1, 15: 1, 23: 1, 31: 1, 44: 1, 57: 1 };
  for (var n = 1; n <= 100; n++) {
    var cell = col(0, { radius: 8, align: 'CENTER', justify: 'CENTER' });
    cell.resize(23, 23);
    cell.primaryAxisSizingMode = 'FIXED';
    cell.counterAxisSizingMode = 'FIXED';
    var fg = C.ink3;
    if (n === 12) { fill(cell, C.brand); stroke(cell, C.brand, 1); fg = C.white; }
    else if (flags[n]) { fill(cell, C.red); stroke(cell, C.red, 1); fg = C.white; }
    else if (n <= 68) { fill(cell, C.green); stroke(cell, C.green, 1); fg = C.white; }
    else { fill(cell, C.page); stroke(cell, C.border, 1); }
    cell.appendChild(txt(String(n), { display: true, size: 9.5, lh: 110, color: fg }));
    palette.appendChild(cell);
  }

  var legend = col(9);
  sideB.appendChild(legend); legend.layoutSizingHorizontal = 'FILL';
  var lg = [[C.page, C.border, 'ยังไม่ได้ทำ'], [C.green, C.green, 'ตอบแล้ว'], [C.red, C.red, 'ปักธงไว้ทบทวน'], [C.brand, C.brand, 'ข้อที่กำลังทำอยู่']];
  for (var l = 0; l < lg.length; l++) {
    var lr2 = row(9, { align: 'CENTER' });
    var sw = col(0, { radius: 5 });
    sw.resize(16, 16);
    sw.primaryAxisSizingMode = 'FIXED';
    sw.counterAxisSizingMode = 'FIXED';
    fill(sw, lg[l][0]);
    stroke(sw, lg[l][1], 1);
    lr2.appendChild(sw);
    lr2.appendChild(txt(lg[l][2], { size: 13.5, color: C.ink2, nowrap: true }));
    legend.appendChild(lr2);
  }

  var pre = col(8, { bg: C.page, radius: 18 });
  pad(pre, [14, 16]);
  sideB.appendChild(pre); pre.layoutSizingHorizontal = 'FILL';
  pre.appendChild(txt('ก่อนส่ง เช็กให้ครบ', { display: true, style: 'Medium', size: 14.5, lh: 140 }));
  var pl = [
    ['radio_button_unchecked', C.ink3, 'ยังไม่ได้ตอบ 32 ข้อ'],
    ['flag', C.red, 'ปักธงรอทบทวน 7 ข้อ'],
    ['timer', C.accentDark, 'เหลือเวลา 48:12 หมดเวลาระบบส่งให้เอง']
  ];
  for (var pi = 0; pi < pl.length; pi++) {
    var pr = row(8, { align: 'MIN' });
    pr.appendChild(icon(pl[pi][0], 17, pl[pi][1]));
    var pt2 = txt(pl[pi][2], { size: 13.5, color: C.ink2, lh: 155 });
    pr.appendChild(pt2);
    pre.appendChild(pr); pr.layoutSizingHorizontal = 'FILL';
    pt2.layoutSizingHorizontal = 'FILL';
  }

  var sb = btn('ส่งคำตอบและตรวจ', 'primary', 'task_alt');
  sideB.appendChild(sb); sb.layoutSizingHorizontal = 'FILL';
  var sn = txt('ส่งได้เมื่อทำครบทุกข้อ หรือเมื่อหมดเวลา', { size: 12.5, color: C.ink3, align: 'CENTER' });
  sideB.appendChild(sn); sn.layoutSizingHorizontal = 'FILL';

  slimFooter(f);
  return f;
}

// ---- 10 Score report
function screenScore() {
  var f = screenFrame(PREFIX + '10 สรุปคะแนน');
  add(f, siteHeader('คลังข้อสอบ', true), 'fill');

  var b = band(f, { top: 40, bottom: 72 });
  b.itemSpacing = 26;

  var hero = flex(NARROW ? 24 : 40, { radius: 28, align: NARROW ? 'MIN' : 'CENTER', justify: 'SPACE_BETWEEN', pad: MOBILE ? 24 : (NARROW ? 32 : 44) });
  gradient(hero, C.brandDeep, C.brand);
  shadow(hero, 'l');
  add(b, hero, 'fill');
  var hl = col(14);
  hl.appendChild(pill('ทำเมื่อ 20 ส.ค. 2568 · ใช้เวลา 74 นาที', '#3B4C93', C.white, 'event'));
  var ht = h2('สรุปผลชุดข้อสอบเสมือนจริง ชุดที่ 1', { color: C.white, size: 32 });
  hl.appendChild(ht);
  var hp = txt('คะแนนดีขึ้น 11 คะแนนจากครั้งก่อน จุดที่ต้องซ่อมก่อนคือเรขาคณิตและการอ่านจับใจความ',
    { size: 16, color: C.brand100 });
  hl.appendChild(hp);
  hero.appendChild(hl); hl.layoutSizingHorizontal = 'FILL';
  ht.layoutSizingHorizontal = 'FILL'; hp.layoutSizingHorizontal = 'FILL';

  var bs = col(6, { radius: 24, align: 'CENTER' });
  pad(bs, [24, 34]);
  fill(bs, C.white, 0.12);
  stroke(bs, C.white, 1, 0.2);
  bs.appendChild(txt('78', { display: true, size: 64, lh: 105, color: C.white, nowrap: true }));
  bs.appendChild(txt('คะแนน จาก 100', { size: 14, color: C.brand100, nowrap: true }));
  hero.appendChild(bs);

  var sg = grid(b, NARROW ? 16 : 20, 4);
  statCard(sg, 'check_circle', C.green50, C.green, '78 ข้อ', 'ตอบถูก');
  statCard(sg, 'cancel', C.red50, C.red, '19 ข้อ', 'ตอบผิด');
  statCard(sg, 'help', C.amber50, '#B45309', '3 ข้อ', 'ไม่ได้ตอบ');
  statCard(sg, 'timer', C.brand50, C.brand, '44 วินาที', 'เวลาเฉลี่ยต่อข้อ');

  var split = flex2(NARROW ? 28 : 40, { align: 'MIN' });
  add(b, split, 'fill');

  var topics = card(0, { pad: 26 });
  split.appendChild(topics); topics.layoutSizingHorizontal = 'FILL';
  var th = h3('คะแนนรายบท', { size: 20 });
  topics.appendChild(th); th.layoutSizingHorizontal = 'FILL';
  topics.appendChild(vgap(12));
  var td2 = [
    ['คณิตศาสตร์ · สมการ', 0.90, C.green, '18 / 20'],
    ['คณิตศาสตร์ · เรขาคณิต', 0.45, C.red, '9 / 20'],
    ['วิทยาศาสตร์', 0.85, C.green, '17 / 20'],
    ['ความสามารถทางเชาวน์', 0.70, C.amber, '14 / 20'],
    ['ภาษาไทย · อ่านจับใจความ', 0.60, C.amber, '12 / 20'],
    ['ภาษาอังกฤษ', 0.80, C.green, '8 / 10']
  ];
  for (var i = 0; i < td2.length; i++) {
    var tr = row(16, { align: 'CENTER' });
    pad(tr, [13, 0]);
    topics.appendChild(tr); tr.layoutSizingHorizontal = 'FILL';
    var tn = txt(td2[i][0], { display: true, style: 'Medium', size: 15.5, lh: 145 });
    capW(tn, MOBILE ? 130 : 180);
    tr.appendChild(tn);
    var tb = bar(td2[i][1], td2[i][2], 300, 11);
    tr.appendChild(tb); tb.layoutSizingHorizontal = 'FILL';
    var tv = txt(td2[i][3], { display: true, style: 'Medium', size: 15, lh: 140, nowrap: true });
    tr.appendChild(tv);
    if (i < td2.length - 1) {
      var dl = divider(200, C.border);
      topics.appendChild(dl); dl.layoutSizingHorizontal = 'FILL';
    }
  }

  var aside = card(16, { pad: 24, shadow: 'm' });
  split.appendChild(aside);
  railW(aside, 380);
  aside.appendChild(h3('พี่ทีแนะนำให้ทำต่อ', { size: 19 }));
  var recs = [
    ['priority_high', C.red, 'ทบทวนเรขาคณิต บทพื้นที่และปริมาตร ก่อนอย่างอื่น'],
    ['flag', C.accent, 'กลับไปดู 7 ข้อที่ปักธงไว้ ส่วนใหญ่อยู่ในบทเดียวกัน'],
    ['timer', C.brand, 'พาร์ทอ่านจับใจความใช้เวลาเกินเฉลี่ย 22 วินาทีต่อข้อ']
  ];
  var rc = col(10);
  aside.appendChild(rc); rc.layoutSizingHorizontal = 'FILL';
  for (var r2 = 0; r2 < recs.length; r2++) {
    var t2 = tick(recs[r2][2], recs[r2][0], recs[r2][1]);
    rc.appendChild(t2); t2.layoutSizingHorizontal = 'FILL';
    t2.children[1].layoutSizingHorizontal = 'FILL';
  }
  var rb1 = btn('ดูเฉลยละเอียดรายข้อ', 'brand', 'visibility');
  aside.appendChild(rb1); rb1.layoutSizingHorizontal = 'FILL';
  var rb2 = btn('ทำชุดนี้ใหม่ (เหลือ 2 ครั้ง)', 'ghost', 'replay');
  aside.appendChild(rb2); rb2.layoutSizingHorizontal = 'FILL';
  var rn = row(11, { bg: C.brand50, radius: 16, align: 'MIN' });
  pad(rn, [14, 16]);
  rn.appendChild(icon('forum', 20, C.brand));
  var rnt = txt('ถ้าดูเฉลยแล้วยังไม่เข้าใจ ถ่ายรูปข้อนั้นส่งเข้ากลุ่ม LINE ได้เลย', { size: 14, color: C.ink2 });
  rn.appendChild(rnt);
  aside.appendChild(rn); rn.layoutSizingHorizontal = 'FILL'; rnt.layoutSizingHorizontal = 'FILL';

  siteFooter(f);
  return f;
}

// ---- 11 Fortune form
function screenFortuneForm() {
  var f = screenFrame(PREFIX + '11 ดูดวง — กรอกข้อมูล');
  add(f, siteHeader('ดูดวง', true), 'fill');

  var b = band(f, { top: 56, bottom: 64 });
  gradient(b, '#241461', '#5B2CC4');
  var g = flex(NARROW ? 36 : 48, { align: 'CENTER' });
  add(b, g, 'fill');

  var left = col(0);
  g.appendChild(left); left.layoutSizingHorizontal = 'FILL';
  left.appendChild(pill('โมดูลดูดวงแนวทางการสอบ', '#4A2A9E', C.white, 'auto_awesome'));
  left.appendChild(vgap(16));
  var t = h1('ดูดวงแนวทางการเตรียมสอบ\nของน้องในรอบนี้', { size: 42, color: C.white });
  left.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  left.appendChild(vgap(14));
  var p = txt('กรอกข้อมูลให้ครบ ระบบจะประมวลผลคำทำนายตามกติกาที่ตกลงกับผู้สอนไว้ แล้วสรุปเป็นแนวทางการอ่านหนังสือและช่วงเวลาที่เหมาะกับน้อง',
    { size: 17, color: '#D9CCFF' });
  left.appendChild(p); p.layoutSizingHorizontal = 'FILL';
  left.appendChild(vgap(22));
  var lf = col(12);
  left.appendChild(lf); lf.layoutSizingHorizontal = 'FILL';
  var pts = ['ใช้เวลาไม่เกิน 1 นาที', 'ผลคำทำนายเก็บไว้ในบัญชีของน้อง กลับมาดูซ้ำได้', 'คำทำนายเป็นความบันเทิง ไม่ใช่การรับประกันผลสอบ'];
  for (var i = 0; i < pts.length; i++) {
    var tk = tick(pts[i], 'check_circle', '#FFC94D', '#D9CCFF');
    lf.appendChild(tk); tk.layoutSizingHorizontal = 'FILL';
    tk.children[1].layoutSizingHorizontal = 'FILL';
  }

  var form = col(16, { radius: 26, pad: 26 });
  fill(form, C.white, 0.1);
  stroke(form, C.white, 1, 0.2);
  g.appendChild(form);
  railW(form, 520);

  var fields = [
    ['ชื่อ-นามสกุล', 'เช่น ด.ญ. มิ้นท์ ใจดี', null],
    ['วัน เดือน ปีเกิด', '17 / 04 / 2556', null],
    ['เวลาเกิดโดยประมาณ', '07:30 น.', 'ถ้าไม่แน่ใจ ใส่ช่วงเวลาที่ใกล้เคียงที่สุดได้'],
    ['สนามสอบที่ตั้งใจไว้', 'จภ. ปทุมธานี', null]
  ];
  for (var j = 0; j < fields.length; j++) {
    var fc = col(8);
    form.appendChild(fc); fc.layoutSizingHorizontal = 'FILL';
    fc.appendChild(txt(fields[j][0], { display: true, style: 'Medium', size: 14.5, lh: 140, color: C.white }));
    var inp = row(10, { radius: 14, align: 'CENTER' });
    pad(inp, [14, 16]);
    fill(inp, C.white, 0.14);
    stroke(inp, C.white, 1.5, 0.24);
    fc.appendChild(inp); inp.layoutSizingHorizontal = 'FILL';
    var iv = txt(fields[j][1], { size: 16, color: '#EFE8FF' });
    inp.appendChild(iv);
    if (j === 3) {
      var isp = vgap(4);
      inp.appendChild(isp); isp.layoutSizingHorizontal = 'FILL';
      inp.appendChild(icon('expand_more', 20, '#B9A8E8'));
    } else {
      iv.layoutSizingHorizontal = 'FILL';
    }
    if (fields[j][2]) {
      var hint = txt(fields[j][2], { size: 13, color: '#B9A8E8' });
      fc.appendChild(hint); hint.layoutSizingHorizontal = 'FILL';
    }
  }
  // the question is written by the student, not picked from a list
  var qf = col(8);
  form.appendChild(qf); qf.layoutSizingHorizontal = 'FILL';
  var qlab = row(10, { align: 'CENTER' });
  qf.appendChild(qlab); qlab.layoutSizingHorizontal = 'FILL';
  qlab.appendChild(txt('คำถามที่อยากถาม', { display: true, style: 'Medium', size: 14.5, lh: 140, color: C.white, nowrap: true }));
  var qsp = vgap(4);
  qlab.appendChild(qsp); qsp.layoutSizingHorizontal = 'FILL';
  qlab.appendChild(txt('พิมพ์เองได้เลย', { size: 13, color: '#B9A8E8', nowrap: true }));

  var qbox = col(10, { radius: 14 });
  pad(qbox, [14, 16]);
  fill(qbox, C.white, 0.14);
  stroke(qbox, C.white, 1.5, 0.24);
  qf.appendChild(qbox); qbox.layoutSizingHorizontal = 'FILL';
  var qv = txt('หนูอ่านหนังสือทุกวันแต่คะแนนคณิตไม่ขึ้นเลย ควรเปลี่ยนวิธีอ่านยังไงดีคะ',
    { size: 16, color: '#EFE8FF', lh: 175 });
  qbox.appendChild(qv); qv.layoutSizingHorizontal = 'FILL';
  var qmeta = row(10, { align: 'CENTER' });
  qbox.appendChild(qmeta); qmeta.layoutSizingHorizontal = 'FILL';
  var qcur = row(7, { align: 'CENTER' });
  qcur.appendChild(icon('edit_note', 17, '#B9A8E8'));
  qcur.appendChild(txt('ถามเป็นคำพูดของน้องเองได้เลย', { size: 12.5, color: '#B9A8E8', nowrap: true }));
  qmeta.appendChild(qcur);
  var qmsp = vgap(4);
  qmeta.appendChild(qmsp); qmsp.layoutSizingHorizontal = 'FILL';
  qmeta.appendChild(txt('62 / 200', { size: 12.5, color: '#B9A8E8', nowrap: true }));

  var qsug = row(8, { wrap: true, wrapGap: 8 });
  qsug.resize(Math.min(468, contentW() - 52), 40);
  qsug.primaryAxisSizingMode = 'FIXED';
  qsug.counterAxisSizingMode = 'AUTO';
  qf.appendChild(qsug); qsug.layoutSizingHorizontal = 'FILL';
  var sug = ['ควรอ่านวิชาไหนก่อนดี', 'ช่วงไหนของวันสมองแล่นสุด', 'ทำข้อสอบไม่ทันเวลาแก้ยังไง', 'ควรพักตอนไหน'];
  for (var sgi = 0; sgi < sug.length; sgi++) {
    var sg = row(0, { radius: 999 });
    pad(sg, [7, 13]);
    stroke(sg, C.white, 1, 0.28);
    sg.appendChild(txt(sug[sgi], { size: 13, color: '#D9CCFF', lh: 140, nowrap: true }));
    qsug.appendChild(sg);
  }
  var qh2 = txt('กดตัวอย่างเพื่อเติมลงช่อง แล้วแก้เป็นคำถามของน้องเองได้', { size: 12.5, color: '#B9A8E8', lh: 155 });
  qf.appendChild(qh2); qh2.layoutSizingHorizontal = 'FILL';

  var sb = row(9, { radius: 999, align: 'CENTER', justify: 'CENTER' });
  pad(sb, [16, 26]);
  fill(sb, '#FFC94D');
  shadow(sb, 'm');
  sb.appendChild(icon('auto_awesome', 20, '#3A1D8C'));
  sb.appendChild(txt('ดูคำทำนาย', { display: true, style: 'Medium', size: 16, lh: 130, color: '#3A1D8C', nowrap: true }));
  form.appendChild(sb); sb.layoutSizingHorizontal = 'FILL';
  var fn = txt('ข้อมูลนี้ใช้เพื่อประมวลผลคำทำนายเท่านั้น ไม่ถูกเปิดเผยต่อบุคคลอื่น',
    { size: 13, color: '#B9A8E8', align: 'CENTER' });
  form.appendChild(fn); fn.layoutSizingHorizontal = 'FILL';

  slimFooter(f);
  return f;
}

// ---- 13 Fortune result
function screenFortuneResult() {
  var f = screenFrame(PREFIX + '13 ดูดวง — คำทำนาย');
  add(f, siteHeader('ดูดวง', true), 'fill');

  var b = band(f, { top: 40, bottom: 72 });
  b.itemSpacing = 22;

  var head = flex(NARROW ? 16 : 20, { bg: C.card, border: C.border, radius: 26, align: NARROW ? 'MIN' : 'CENTER' });
  pad(head, MOBILE ? 18 : 24);
  shadow(head, 'm');
  add(b, head, 'fill');
  head.appendChild(iconTile('auto_awesome', 86, C.mystic50, C.mystic, 26));
  var hc = col(10);
  hc.appendChild(pill('เกิด 17 เมษายน 2556 · เวลา 07:30 น.', C.mystic50, '#5B21B6', 'calendar_month'));
  var ht = h2('คำทำนายสำหรับน้องมิ้นท์', { size: 30 });
  hc.appendChild(ht);
  var hq = row(10, { bg: C.mystic50, radius: 14, align: 'MIN' });
  pad(hq, [11, 14]);
  hq.appendChild(icon('format_quote', 18, C.mystic));
  var hqt = txt('หนูอ่านหนังสือทุกวันแต่คะแนนคณิตไม่ขึ้นเลย ควรเปลี่ยนวิธีอ่านยังไงดีคะ', { size: 14.5, color: '#5B21B6', lh: 165 });
  hq.appendChild(hqt);
  hc.appendChild(hq); hq.layoutSizingHorizontal = 'FILL'; hqt.layoutSizingHorizontal = 'FILL';
  var hp = txt('คำตอบสั้น ๆ: ปัญหาไม่ได้อยู่ที่เวลาอ่าน แต่อยู่ที่ช่วงเวลาที่อ่าน ลองย้ายคณิตมาช่วงเช้าตรู่ถึงสาย และเลี่ยงบ่ายแก่ ๆ', { size: 16, color: C.ink2 });
  hc.appendChild(hp);
  head.appendChild(hc); hc.layoutSizingHorizontal = 'FILL';
  ht.layoutSizingHorizontal = 'FILL'; hp.layoutSizingHorizontal = 'FILL';
  head.appendChild(btn('บันทึกเป็นรูป', 'ghost', 'download'));

  var g = grid(b, NARROW ? 16 : 20, 3);
  var secs = [
    ['menu_book', C.mystic50, C.mystic, 'ด้านการเรียน',
     'ดวงการเรียนของน้องรอบนี้อยู่ในเกณฑ์ดีขึ้นเรื่อย ๆ จุดแข็งคือความจำเชิงตรรกะ เหมาะกับการอ่านแบบสรุปเป็นแผนภาพมากกว่าอ่านยาว ๆ ควรทบทวนวิชาคำนวณในช่วงเช้า'],
    ['schedule', C.amber50, '#B45309', 'ช่วงเวลาที่เหมาะ',
     '06.00–10.00 น. เป็นช่วงที่สมาธิดีที่สุด เหมาะกับโจทย์ที่ต้องคิดหลายขั้น ส่วน 15.00–17.00 น. เหมาะกับการทบทวนของเก่าและท่องศัพท์มากกว่าเรียนเรื่องใหม่'],
    ['psychology_alt', C.accent50, C.accentDark, 'สิ่งที่ควรระวัง',
     'ระวังการเร่งทำโจทย์ยากเกินระดับจนเสียกำลังใจ ในเดือนพฤศจิกายนอาจมีช่วงที่รู้สึกว่าคะแนนไม่ขึ้น ให้กลับไปทำโจทย์พื้นฐานซ้ำแทนการเพิ่มความยาก']
  ];
  for (var i = 0; i < secs.length; i++) {
    var c = card(12, { radius: 22 });
    add(g, c, 'fill');
    var ch = row(12, { align: 'CENTER' });
    ch.appendChild(iconTile(secs[i][0], 40, secs[i][1], secs[i][2], 13));
    ch.appendChild(h4(secs[i][3], { size: 18 }));
    c.appendChild(ch); ch.layoutSizingHorizontal = 'FILL';
    var cp = txt(secs[i][4], { size: 15.5, color: C.ink2 });
    c.appendChild(cp); cp.layoutSizingHorizontal = 'FILL';
  }

  var g2 = grid(b, NARROW ? 16 : 20, 2);

  var lucky = card(12, { radius: 22 });
  add(g2, lucky, 'fill');
  var lh = row(12, { align: 'CENTER' });
  lh.appendChild(iconTile('emoji_events', 40, C.green50, C.green, 13));
  lh.appendChild(h4('เลขและสิ่งนำโชคของน้อง', { size: 18 }));
  lucky.appendChild(lh); lh.layoutSizingHorizontal = 'FILL';
  var chips = row(10, { wrap: true, wrapGap: 10 });
  lucky.appendChild(chips); chips.layoutSizingHorizontal = 'FILL';
  var lk = ['เลข 3', 'เลข 7', 'สีฟ้าคราม', 'วันพฤหัสบดี', 'ดินสอไม้'];
  for (var k = 0; k < lk.length; k++) chips.appendChild(pill(lk[k], C.mystic50, '#5B21B6'));
  var ln = txt('ใช้เป็นกำลังใจได้ แต่สิ่งที่เปลี่ยนคะแนนจริงคือจำนวนโจทย์ที่ทำและการทบทวนจุดที่ผิดซ้ำ',
    { size: 14.5, color: C.ink3 });
  lucky.appendChild(ln); ln.layoutSizingHorizontal = 'FILL';

  var adv = card(12, { radius: 22 });
  add(g2, adv, 'fill');
  var ah = row(12, { align: 'CENTER' });
  ah.appendChild(iconTile('tips_and_updates', 40, C.brand50, C.brand, 13));
  ah.appendChild(h4('คำแนะนำจากพี่ที', { size: 18 }));
  adv.appendChild(ah); ah.layoutSizingHorizontal = 'FILL';
  var ap = txt('คำทำนายบอกจังหวะเวลาได้ แต่บอกคะแนนไม่ได้ ถ้าน้องอยากรู้ว่าตอนนี้อยู่ตรงไหนจริง ๆ ให้ทำข้อสอบเสมือนจริงชุดถัดไปแล้วดูรายงานรายบท จะเห็นชัดกว่าเยอะ',
    { size: 15.5, color: C.ink2 });
  adv.appendChild(ap); ap.layoutSizingHorizontal = 'FILL';
  adv.appendChild(btn('ไปทำข้อสอบชุดถัดไป', 'brand', 'quiz'));

  var dis = row(12, { bg: C.card, border: C.border, radius: 18, align: 'MIN' });
  pad(dis, [18, 22]);
  add(b, dis, 'fill');
  dis.appendChild(icon('info', 21, C.ink3));
  var dt = txt('คำทำนายนี้ประมวลผลจากกติกาที่ตกลงร่วมกับผู้สอน มีไว้เพื่อความบันเทิงและเป็นแนวทางจัดตารางอ่านหนังสือเท่านั้น ไม่ใช่การพยากรณ์ผลสอบ และไม่ควรใช้แทนการเตรียมตัว',
    { size: 14, color: C.ink3 });
  dis.appendChild(dt); dt.layoutSizingHorizontal = 'FILL';

  slimFooter(f);
  return f;
}

// ---- 12 Fortune checkout
function screenFortunePay() {
  var f = screenFrame(PREFIX + '12 ดูดวง — ชำระเงิน');
  add(f, siteHeader('ดูดวง', true), 'fill');

  var hero = band(f, { top: 40, bottom: 44 });
  gradient(hero, '#241461', '#5B2CC4');
  var hc = col(0);
  add(hero, hc, 'fill');
  hc.appendChild(pill('ขั้นตอนที่ 2 จาก 2 · ชำระเงิน', '#4A2A9E', C.white, 'auto_awesome'));
  hc.appendChild(vgap(14));
  var ht = h1('ชำระค่าดูดวงแนวทางการสอบ', { size: 38, color: C.white });
  hc.appendChild(ht); ht.layoutSizingHorizontal = 'FILL';
  hc.appendChild(vgap(8));
  var hs = txt('จ่ายครั้งเดียว อ่านคำทำนายได้ทันทีหลังชำระเงิน และเก็บไว้เปิดดูซ้ำได้ตลอด',
    { size: 16.5, color: '#D6C9FF', lh: 175 });
  hc.appendChild(hs); hs.layoutSizingHorizontal = 'FILL';

  var b = band(f, { top: 36, bottom: 72 });
  b.itemSpacing = 26;
  var split = flex2(NARROW ? 28 : 40, { align: 'MIN' });
  add(b, split, 'fill');

  var main = col(22);
  split.appendChild(main); main.layoutSizingHorizontal = 'FILL';

  // what the fortune form collected, read back for checking
  var info = card(16);
  main.appendChild(info); info.layoutSizingHorizontal = 'FILL';
  var ih = row(12, { align: 'CENTER' });
  info.appendChild(ih); ih.layoutSizingHorizontal = 'FILL';
  ih.appendChild(h3('ข้อมูลที่กรอกไว้', { size: 19 }));
  var ihsp = vgap(4);
  ih.appendChild(ihsp); ihsp.layoutSizingHorizontal = 'FILL';
  var edit = row(7, { align: 'CENTER' });
  edit.appendChild(icon('edit', 18, C.mystic));
  edit.appendChild(txt('แก้ไข', { display: true, style: 'Medium', size: 14.5, lh: 130, color: C.mystic, nowrap: true }));
  ih.appendChild(edit);

  var fields = [
    ['ชื่อเล่นน้อง', 'น้องปุ๊กกี้'],
    ['วันเกิด', '14 มีนาคม 2557'],
    ['เวลาเกิด', '07:20 น.'],
    ['สนามสอบที่ตั้งใจไว้', 'จภ. ปทุมธานี']
  ];
  for (var i = 0; i < fields.length; i += 2) {
    var fr = flex2(16, { align: 'MIN' });
    info.appendChild(fr); fr.layoutSizingHorizontal = 'FILL';
    for (var j = i; j < i + 2 && j < fields.length; j++) {
      var fc = col(8);
      fc.appendChild(txt(fields[j][0], { display: true, style: 'Medium', size: 14.5, lh: 140 }));
      var inp = row(0, { bg: C.page, border: C.border, borderW: 1.5, radius: 14 });
      pad(inp, [14, 16]);
      inp.appendChild(txt(fields[j][1], { size: 16 }));
      fc.appendChild(inp);
      add(fr, fc, 'fill');
      inp.layoutSizingHorizontal = 'FILL';
    }
  }

  var qr2 = col(8);
  info.appendChild(qr2); qr2.layoutSizingHorizontal = 'FILL';
  qr2.appendChild(txt('คำถามที่น้องถาม', { display: true, style: 'Medium', size: 14.5, lh: 140 }));
  var qbx = row(0, { bg: C.mystic50, radius: 14 });
  pad(qbx, [14, 16]);
  qr2.appendChild(qbx); qbx.layoutSizingHorizontal = 'FILL';
  var qtx = txt('หนูอ่านหนังสือทุกวันแต่คะแนนคณิตไม่ขึ้นเลย ควรเปลี่ยนวิธีอ่านยังไงดีคะ', { size: 16, lh: 175 });
  qbx.appendChild(qtx); qtx.layoutSizingHorizontal = 'FILL';

  // payment methods, QR first because the amount is small
  var pay = card(14);
  main.appendChild(pay); pay.layoutSizingHorizontal = 'FILL';
  pay.appendChild(h3('วิธีชำระเงิน', { size: 19 }));
  var methods = [
    ['พร้อมเพย์ / สแกน QR', 'สแกนแล้วคำทำนายเปิดให้อ่านภายใน 1 นาที', 'PromptPay', true],
    ['บัตรเครดิต / เดบิต', 'Visa, Mastercard, JCB', 'Card', false],
    ['โอนผ่านโมบายแบงก์กิ้ง', 'เลือกธนาคารแล้วยืนยันในแอป', 'Mobile Banking', false]
  ];
  for (var m = 0; m < methods.length; m++) {
    var sel = methods[m][3];
    var pr2 = row(14, { radius: 18, align: 'CENTER' });
    pad(pr2, 16);
    stroke(pr2, sel ? C.mystic : C.border, 1.5);
    if (sel) fill(pr2, C.mystic50); else noFill(pr2);
    pay.appendChild(pr2); pr2.layoutSizingHorizontal = 'FILL';

    var radio = col(0, { radius: 999, align: 'CENTER', justify: 'CENTER' });
    radio.resize(22, 22);
    radio.primaryAxisSizingMode = 'FIXED';
    radio.counterAxisSizingMode = 'FIXED';
    noFill(radio);
    stroke(radio, sel ? C.mystic : C.borderStrong, 2);
    if (sel) {
      var inner = figma.createEllipse();
      inner.resize(11, 11);
      fill(inner, C.mystic);
      radio.appendChild(inner);
    }
    pr2.appendChild(radio);

    var pc2 = col(2);
    pc2.appendChild(txt(methods[m][0], { display: true, style: 'Medium', size: 16, lh: 142 }));
    pc2.appendChild(txt(methods[m][1], { size: 13.5, color: C.ink3, lh: 155 }));
    pr2.appendChild(pc2); pc2.layoutSizingHorizontal = 'FILL';

    var logo = row(0, { bg: C.page, border: C.border, radius: 8 });
    pad(logo, [5, 9]);
    logo.appendChild(txt(methods[m][2], { size: 12, color: C.ink3, nowrap: true }));
    pr2.appendChild(logo);
  }

  // the buyer is 11-12 years old, so the parent has to be the one who confirms
  var con = row(13, { bg: C.amber50, radius: 18, align: 'MIN' });
  pad(con, [16, 18]);
  main.appendChild(con); con.layoutSizingHorizontal = 'FILL';
  var box = col(0, { radius: 7, align: 'CENTER', justify: 'CENTER' });
  box.resize(24, 24);
  box.primaryAxisSizingMode = 'FIXED';
  box.counterAxisSizingMode = 'FIXED';
  fill(box, C.amber);
  box.appendChild(icon('check', 17, C.white));
  con.appendChild(box);
  var cc = col(3);
  cc.appendChild(txt('ผู้ปกครองรับทราบและยินยอมให้ชำระเงิน', { display: true, style: 'Medium', size: 15.5, lh: 145, color: '#7C4A03' }));
  cc.appendChild(txt('ผู้ซื้อเป็นนักเรียนอายุต่ำกว่า 15 ปี ระบบจึงขอให้ผู้ปกครองเป็นผู้กดยืนยันการชำระเงินทุกครั้ง',
    { size: 14.5, color: '#7C4A03', lh: 165 }));
  con.appendChild(cc); cc.layoutSizingHorizontal = 'FILL';

  // ---- summary
  var aside = card(16, { pad: 24, shadow: 'm' });
  split.appendChild(aside);
  railW(aside, 380);
  aside.appendChild(h3('สรุปคำสั่งซื้อ', { size: 19 }));

  var item = row(14, { align: 'MIN' });
  item.appendChild(iconTile('auto_awesome', 34, C.mystic50, C.mystic, 11));
  var ic2 = col(2);
  ic2.appendChild(txt('ดูดวงแนวทางการสอบ 1 ครั้ง', { display: true, style: 'Medium', size: 15.5, lh: 145 }));
  ic2.appendChild(txt('คำทำนาย 3 ด้าน + เลขนำโชค + ตารางอ่านหนังสือ', { size: 13.5, color: C.ink3, lh: 155 }));
  item.appendChild(ic2);
  aside.appendChild(item); item.layoutSizingHorizontal = 'FILL'; ic2.layoutSizingHorizontal = 'FILL';

  var up = row(13, { bg: C.mystic50, radius: 16, align: 'CENTER' });
  pad(up, [13, 15]);
  aside.appendChild(up); up.layoutSizingHorizontal = 'FILL';
  up.appendChild(icon('add_circle', 20, C.mystic));
  var uc = col(2);
  uc.appendChild(txt('เพิ่มเป็นแพ็ก 3 ครั้ง ฿249', { display: true, style: 'Medium', size: 14.5, lh: 142, color: C.mystic }));
  uc.appendChild(txt('ดูซ้ำได้ก่อนสอบ ประหยัดกว่า ฿48', { size: 13, color: C.ink2, lh: 155 }));
  up.appendChild(uc); uc.layoutSizingHorizontal = 'FILL';

  var sd = divider(200, C.border);
  aside.appendChild(sd); sd.layoutSizingHorizontal = 'FILL';

  var sums = [['ค่าดูดวง 1 ครั้ง', '฿99', C.ink], ['ส่วนลดสมาชิกคอร์ส', '−฿20', C.green]];
  var sumCol = col(2);
  aside.appendChild(sumCol); sumCol.layoutSizingHorizontal = 'FILL';
  for (var s2 = 0; s2 < sums.length; s2++) {
    var sr = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
    pad(sr, [9, 0]);
    var sl = txt(sums[s2][0], { size: 15 });
    sr.appendChild(sl);
    sr.appendChild(txt(sums[s2][1], { size: 15, color: sums[s2][2], nowrap: true }));
    sumCol.appendChild(sr); sr.layoutSizingHorizontal = 'FILL'; sl.layoutSizingHorizontal = 'FILL';
  }

  var sd2 = divider(200, C.border);
  aside.appendChild(sd2); sd2.layoutSizingHorizontal = 'FILL';
  var total = row(14, { justify: 'SPACE_BETWEEN', align: 'CENTER' });
  total.appendChild(txt('ยอดชำระทั้งหมด', { size: 17 }));
  total.appendChild(txt('฿79', { display: true, size: 26, lh: 120, color: C.mystic, nowrap: true }));
  aside.appendChild(total); total.layoutSizingHorizontal = 'FILL';

  var pb = btn('ยืนยันและชำระเงิน', 'primary', 'lock');
  aside.appendChild(pb); pb.layoutSizingHorizontal = 'FILL';

  var disc = row(11, { bg: C.page, radius: 16, align: 'MIN' });
  pad(disc, [13, 15]);
  aside.appendChild(disc); disc.layoutSizingHorizontal = 'FILL';
  disc.appendChild(icon('info', 19, C.ink3));
  var dt = txt('ดูดวงเป็นบริการเพื่อความบันเทิงและใช้จัดตารางอ่านหนังสือ ไม่ใช่การพยากรณ์ผลสอบ และไม่มีนโยบายคืนเงินหลังเปิดอ่านคำทำนายแล้ว',
    { size: 13, color: C.ink2, lh: 165 });
  disc.appendChild(dt); dt.layoutSizingHorizontal = 'FILL';

  slimFooter(f);
  return f;
}

// ---------------------------------------------------------------- runner

// Order here drives the canvas rows, the menu, and the manifest commands.
// `name` must match the frame name the function creates — smoke-test.js checks it.
var SCREENS = [
  { id: 's01', name: '01 หน้าแรก',              fn: screenLanding },
  { id: 's02', name: '02 รู้จักพี่ที',              fn: screenAbout },
  { id: 's03', name: '03 เข้าสู่ระบบ',            fn: screenLogin },
  { id: 's04', name: '04 เมนูหลัก',              fn: screenDashboard },
  { id: 's05', name: '05 คอร์ส & ข้อสอบ',        fn: screenCatalog },
  { id: 's06', name: '06 รายละเอียดคอร์ส',        fn: screenCourseDetail },
  { id: 's07', name: '07 ชำระเงิน',              fn: screenCheckout },
  { id: 's08', name: '08 ชำระเงินสำเร็จ',         fn: screenSuccess },
  { id: 's09', name: '09 ทำข้อสอบ',              fn: screenExam },
  { id: 's10', name: '10 สรุปคะแนน',             fn: screenScore },
  { id: 's11', name: '11 ดูดวง — กรอกข้อมูล',     fn: screenFortuneForm },
  { id: 's12', name: '12 ดูดวง — ชำระเงิน',       fn: screenFortunePay },
  { id: 's13', name: '13 ดูดวง — คำทำนาย',        fn: screenFortuneResult }
];

function findOrCreatePage(name) {
  for (var i = 0; i < figma.root.children.length; i++) {
    if (figma.root.children[i].name === name) return figma.root.children[i];
  }
  var p = figma.createPage();
  p.name = name;
  return p;
}

async function loadFonts() {
  var needed = [
    { family: DISPLAY, style: 'Regular' },
    { family: DISPLAY, style: 'Medium' },
    { family: DISPLAY, style: 'SemiBold' },
    { family: BODY, style: 'Regular' },
    { family: BODY, style: 'Medium' },
    { family: BODY, style: 'SemiBold' },
    { family: BODY, style: 'Bold' }
  ];
  for (var i = 0; i < needed.length; i++) {
    try {
      await figma.loadFontAsync(needed[i]);
    } catch (e) {
      throw new Error('โหลดฟอนต์ "' + needed[i].family + ' ' + needed[i].style +
        '" ไม่สำเร็จ — ติดตั้งฟอนต์ Mitr และ Anuphan ก่อน แล้วรันใหม่');
    }
  }
  try {
    await figma.loadFontAsync({ family: ICONS, style: ICON_STYLE });
  } catch (e) {
    HAS_ICON_FONT = false;
  }
}

// Night-mode contrast sweep.
//
// Two light colours can map to two dark ones that no longer contrast: white text
// on the orange button becomes near-white text on pastel orange. The screens are
// written once, for light, so rather than fork every call site this walks the
// finished frame, tracks the background each glyph actually sits on, and flips
// any label that came out unreadable. Only runs in night mode.
function relLum(c) {
  function f(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  var x = relLum(a), y = relLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

var NIGHT_INK_DARK = { r: 0.063, g: 0.063, b: 0.063 };
var NIGHT_INK_LIGHT = { r: 0.949, g: 0.961, b: 0.965 };

function fixContrast(node, bg) {
  var myBg = bg;
  var paints = node.fills;
  if (paints && paints.length && typeof paints !== 'symbol') {
    if (node.type === 'TEXT') {
      var t = null;
      for (var i = 0; i < paints.length; i++) {
        if (paints[i].type === 'SOLID' && paints[i].visible !== false) { t = paints[i]; break; }
      }
      if (t && contrast(t.color, bg) < 3) {
        var best = contrast(NIGHT_INK_DARK, bg) >= contrast(NIGHT_INK_LIGHT, bg)
          ? NIGHT_INK_DARK : NIGHT_INK_LIGHT;
        node.fills = [{ type: 'SOLID', color: best }];
      }
    } else {
      for (var j = 0; j < paints.length; j++) {
        var p = paints[j];
        if (p.type === 'SOLID' && p.visible !== false && (p.opacity === undefined || p.opacity > 0.85)) {
          myBg = p.color; break;
        }
        if (p.type && p.type.indexOf('GRADIENT') === 0 && p.gradientStops.length) {
          myBg = p.gradientStops[p.gradientStops.length - 1].color; break;
        }
      }
    }
  }
  if (node.children) {
    for (var k = 0; k < node.children.length; k++) fixContrast(node.children[k], myBg);
  }
}

function label(chars, size, color) {
  var t = txt(chars, { display: true, style: 'Medium', size: size, lh: 130, color: color, nowrap: true });
  t.name = PREFIX + 'label';
  return t;
}

var GAP_X = 120;      // between the three widths
var HEAD_H = 56;      // room for the column labels above the frames

// remove only what this plugin drew, from one page or from the whole file
function clearPage(page) {
  var removed = 0;
  var kids = page.children.slice();
  for (var i = 0; i < kids.length; i++) {
    var n = kids[i];
    if (n.name.indexOf(PREFIX) === 0) { n.remove(); removed++; }
    else if (DELETE_LEGACY_SCREENS && n.name.indexOf('Desktop / ') === 0) { n.remove(); removed++; }
  }
  return removed;
}

function clearFile() {
  var removed = 0;
  for (var i = 0; i < figma.root.children.length; i++) removed += clearPage(figma.root.children[i]);
  return removed;
}

// first free y below whatever is already on the page — the night row stacks under
// the light one instead of on top of it
function rowBelow(page) {
  var bottom = 0;
  for (var i = 0; i < page.children.length; i++) {
    var n = page.children[i];
    if (n.y + n.height > bottom) bottom = n.y + n.height;
  }
  return bottom ? bottom + 500 : 0;
}

// Walks every page and reports the three things that put elements on top of each
// other in this file: leftovers from an older build, a child hanging out of a
// fixed-size parent, and an auto-layout frame whose pinned height its content
// outgrew. Read-only — it draws a text report and changes nothing else.
function auditFile() {
  var legacy = [];
  var spill = [];
  var pinned = [];
  var strays = [];

  function frameLabel(n) {
    var top = n;
    while (top.parent && top.parent.type !== 'PAGE') top = top.parent;
    return (top.name || top.type) + ' › ' + (n.name || n.type);
  }

  function visit(n) {
    if (n.layoutMode === 'NONE' && n.children && n.children.length && n.width > 0 && n.height > 0) {
      for (var i = 0; i < n.children.length; i++) {
        var c = n.children[i];
        if (c.x + c.width > n.width + 1 || c.y + c.height > n.height + 1) {
          spill.push(frameLabel(c) + ' — ล้นออกนอก "' + (n.name || n.type) + '"');
        }
      }
    }
    if (n.layoutMode && n.layoutMode !== 'NONE' && n.children && n.children.length) {
      var vertical = n.layoutMode === 'VERTICAL';
      var isPinned = vertical ? n.primaryAxisSizingMode === 'FIXED' : n.counterAxisSizingMode === 'FIXED';
      if (isPinned) {
        var inner = 0;
        for (var j = 0; j < n.children.length; j++) {
          inner = vertical ? inner + n.children[j].height : Math.max(inner, n.children[j].height);
        }
        if (vertical) inner += (n.itemSpacing || 0) * (n.children.length - 1);
        var need = inner + (n.paddingTop || 0) + (n.paddingBottom || 0);
        if (need > n.height + 8) {
          pinned.push(frameLabel(n) + ' — สูง ' + Math.round(n.height) + ' แต่เนื้อหาต้องการ ' + Math.round(need));
        }
      }
    }
    if (n.children) for (var k = 0; k < n.children.length; k++) visit(n.children[k]);
  }

  for (var p = 0; p < figma.root.children.length; p++) {
    var page = figma.root.children[p];
    for (var q = 0; q < page.children.length; q++) {
      var top = page.children[q];
      var known = top.name.indexOf(LIGHT_PREFIX) === 0 || top.name.indexOf(DARK_PREFIX) === 0 ||
        top.name.indexOf('PT \u26A0') === 0;
      if (!known) {
        (top.name.indexOf('Desktop / ') === 0 || top.name.indexOf('Tablet / ') === 0 ||
          top.name.indexOf('Mobile / ') === 0 ? legacy : strays)
          .push(page.name + ' › ' + top.name);
      }
      visit(top);
    }
  }

  function block(title, list) {
    if (!list.length) return title + ': ไม่พบ\n';
    var out = title + ': ' + list.length + ' จุด\n';
    for (var i = 0; i < Math.min(list.length, 12); i++) out += '  • ' + list[i] + '\n';
    if (list.length > 12) out += '  • … อีก ' + (list.length - 12) + ' จุด\n';
    return out + '\n';
  }

  var text = 'รายงานตรวจเลย์เอาต์ — PIPOL TUTOR\n\n' +
    block('เฟรมรุ่นเก่าที่ปลั๊กอินไม่ได้ลบ (ตั้ง DELETE_LEGACY_SCREENS = true เพื่อลบ)', legacy) +
    block('ของอื่นที่ไม่ใช่ของปลั๊กอิน วางอยู่บนเพจเดียวกัน', strays) +
    block('ล้นออกนอกกรอบพ่อแม่', spill) +
    block('กรอบล็อกความสูงไว้ต่ำกว่าเนื้อหา (ข้อความโดนตัด)', pinned) +
    'ถ้าทุกหัวข้อขึ้นว่า "ไม่พบ" แปลว่าเฟรมชุดปัจจุบันไม่มีปัญหาแล้ว\n' +
    'สิ่งที่เห็นทับกันบนหน้าจอจะเป็นเฟรมชุดเก่าที่ยังไม่ได้ลบ\n\n' +
    'ลบรายงานนี้ทิ้งได้เลย';

  return { text: text, count: legacy.length + strays.length + spill.length + pinned.length };
}

// one page per screen, holding that screen at all three widths. In night mode the
// dark row lands on the same page, below the light one — a Figma Starter plan is
// capped at three pages, so a theme cannot have pages of its own.
function drawScreen(screen) {
  var page = findOrCreatePage(screen.name);
  clearPage(page);

  var made = [];
  var x = 0;
  var y0 = THEME === 'dark' ? rowBelow(page) : 0;
  for (var b = 0; b < BREAKPOINTS.length; b++) {
    var bp = BREAKPOINTS[b];

    var head = label(bp.label + ' ' + bp.w + (THEME === 'dark' ? DARK_SUFFIX : ''), 26, C.ink3);
    head.name = PREFIX + 'head ' + bp.label;
    page.appendChild(head);
    head.x = x;
    head.y = y0;
    made.push(head);

    setBreakpoint(bp);
    var frame = screen.fn();
    if (THEME === 'dark') fixContrast(frame, hex(themed(C.page, false)));
    frame.name = frame.name + ' \u00B7 ' + bp.label;
    page.appendChild(frame);
    frame.x = x;
    frame.y = y0 + HEAD_H;
    made.push(frame);

    x += bp.w + GAP_X;
  }
  return { page: page, made: made };
}

// put the screen pages in SCREENS order, ahead of any other page in the file
function orderPages() {
  var moved = 0;
  for (var i = 0; i < SCREENS.length; i++) {
    var pg = null;
    for (var j = 0; j < figma.root.children.length; j++) {
      if (figma.root.children[j].name === SCREENS[i].name) pg = figma.root.children[j];
    }
    if (!pg) continue;
    if (figma.root.children[moved] !== pg) figma.root.insertChild(moved, pg);
    moved++;
  }
  return moved;
}

// re-align the three frames already sitting on a page, without redrawing them
function realign(page) {
  var x = 0;
  var touched = 0;
  for (var b = 0; b < BREAKPOINTS.length; b++) {
    var bp = BREAKPOINTS[b];
    for (var i = 0; i < page.children.length; i++) {
      var n = page.children[i];
      if (n.name === PREFIX + 'head ' + bp.label) { n.x = x; n.y = 0; touched++; }
      else if (n.type === 'FRAME' && n.name.indexOf(PREFIX) === 0 &&
               n.name.indexOf(' \u00B7 ' + bp.label) === n.name.length - bp.label.length - 3) {
        n.x = x; n.y = HEAD_H; touched++;
      }
    }
    x += bp.w + GAP_X;
  }
  return touched;
}

async function main() {
  await loadFonts();

  var cmd = figma.command || 'all';

  // "dark-" in front of any command draws that command in night mode. The two
  // themes clear only their own frames, so redrawing one leaves the other alone.
  setTheme(cmd.indexOf('dark-') === 0 ? 'dark' : 'light');
  if (THEME === 'dark') cmd = cmd.slice(5);

  if (cmd === 'audit') {
    var report = auditFile();
    var rp = figma.currentPage;
    for (var ri = rp.children.length - 1; ri >= 0; ri--) {
      if (rp.children[ri].name.indexOf('PT \u26A0') === 0) rp.children[ri].remove();
    }
    var rt = txt(report.text, { size: 15, lh: 170, color: C.ink });
    rt.name = 'PT \u26A0 รายงานตรวจเลย์เอาต์';
    rt.resize(760, rt.height);
    rp.appendChild(rt);
    var far = 0;
    for (var rj = 0; rj < rp.children.length; rj++) {
      if (rp.children[rj] !== rt) far = Math.max(far, rp.children[rj].x + rp.children[rj].width);
    }
    rt.x = far + 160; rt.y = 0;
    figma.currentPage.selection = [rt];
    figma.viewport.scrollAndZoomIntoView([rt]);
    figma.notify('ตรวจแล้ว — พบ ' + report.count + ' จุด · อ่านรายงานที่เลือกไว้');
    figma.closePlugin();
    return;
  }

  if (cmd === 'tidy') {
    var pages = orderPages();
    var touched = 0;
    for (var i = 0; i < figma.root.children.length; i++) touched += realign(figma.root.children[i]);
    figma.notify('จัดหน้าแล้ว ' + pages + ' เพจ · ขยับ ' + touched + ' ชิ้น');
    figma.closePlugin();
    return;
  }

  var first = null;
  var made = [];
  var note = '';

  if (cmd === 'all') {
    var removed = clearFile();
    for (var k = 0; k < SCREENS.length; k++) {
      var res = drawScreen(SCREENS[k]);
      if (!first) first = res;
      made = made.concat(res.made);
    }
    orderPages();
    note = (THEME === 'dark' ? 'ธีมกลางคืน — ' : '') +
      'วาดครบ ' + SCREENS.length + ' เพจ x ' + BREAKPOINTS.length + ' ขนาด' +
      (removed ? ' — ลบของเดิม ' + removed + ' ชิ้น' : '');

  } else {
    var screen = null;
    for (var s = 0; s < SCREENS.length; s++) if (SCREENS[s].id === cmd) screen = SCREENS[s];
    if (!screen) {
      figma.notify('ไม่รู้จักคำสั่ง "' + cmd + '"', { error: true });
      figma.closePlugin();
      return;
    }
    first = drawScreen(screen);
    made = first.made;
    orderPages();
    note = (THEME === 'dark' ? 'ธีมกลางคืน — ' : '') +
      'วาด "' + screen.name + '" ครบ ' + BREAKPOINTS.length + ' ขนาดแล้ว';
  }

  if (first) {
    await figma.setCurrentPageAsync(first.page);
    var onPage = made.filter(function (n) { return n.parent === first.page; });
    figma.currentPage.selection = onPage;
    figma.viewport.scrollAndZoomIntoView(onPage);
  }
  figma.notify(note + (HAS_ICON_FONT ? '' : ' — ไม่พบฟอนต์ไอคอน Material Symbols Rounded ไอคอนจะเป็นจุดแทน'));
  figma.closePlugin();
}

main().catch(function (err) {
  figma.notify('เกิดข้อผิดพลาด: ' + err.message, { error: true, timeout: 8000 });
  figma.closePlugin();
});
