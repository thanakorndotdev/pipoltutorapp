// Fake Figma plugin API — runs code.js in node so mistakes surface before Figma does.
// Checks that every menu command executes, that all three widths are drawn, and that
// the names in SCREENS match the frame names the screen functions actually create.
// It does NOT verify layout — only that the drawing code runs end to end.
//
//   node smoke-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, 'code.js'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const problems = [];

function makeFigma(command) {
  let seq = 0;
  const base = (type) => ({
    type, name: '', children: [], parent: null,
    x: 0, y: 0, width: 100, height: 100, id: 'n' + (++seq), selection: null,
    resize(w, h) {
      if (!(w > 0) || !(h > 0)) problems.push(`resize(${w}, ${h}) on ${this.type} "${this.name}"`);
      this.width = w; this.height = h;
      // Figma pins BOTH axes when you resize an auto-layout frame — the single
      // easiest way to freeze a card at its empty height and clip its own text.
      if (this.layoutMode && this.layoutMode !== 'NONE') {
        this.primaryAxisSizingMode = 'FIXED';
        this.counterAxisSizingMode = 'FIXED';
      }
    },
    appendChild(c) {
      if (!c) { problems.push(`appendChild(undefined) on ${this.type} "${this.name}"`); return; }
      if (c.parent) c.parent.children = c.parent.children.filter(k => k !== c);
      c.parent = this; this.children.push(c);
    },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(k => k !== this); }
  });
  // Real Figma nodes are not extensible — writing a property the API does not define throws
  // "object is not extensible". Sealing the stubs the same way catches that here instead.
  const LAYOUT_PROPS = {
    layoutMode: 'NONE', itemSpacing: 0, layoutWrap: 'NO_WRAP', counterAxisSpacing: 0,
    paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
    primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO',
    primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN',
    layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', layoutGrow: 0,
    clipsContent: false, cornerRadius: 0, opacity: 1, visible: true,
    fills: [], strokes: [], strokeWeight: 1, effects: []
  };
  // preventExtensions fails silently in sloppy mode, so use a proxy that throws the way Figma does
  // Figma also rejects FILL/HUG on a node that is not yet a child of an auto-layout
  // frame — the single easiest ordering mistake to make, and invisible in a plain stub.
  // A sizing flag names an axis by its role in the current layoutMode, so flipping
  // layoutMode afterwards moves the flag to the other axis: a width set to FILL on a
  // row becomes a fixed height on a column, and the frame keeps its empty 100px while
  // its children spill over whatever follows. Build the frame in the mode it will keep.
  const sized = new WeakSet();
  const seal = (n) => new Proxy(n, {
    set(t, k, v) {
      if (!(k in t)) throw new TypeError('object is not extensible');
      if ((k === 'layoutSizingHorizontal' || k === 'layoutSizingVertical') && v !== 'FIXED') sized.add(t);
      if (k === 'layoutMode' && v !== 'NONE' && t.layoutMode !== 'NONE' && t.layoutMode !== v && sized.has(t)) {
        problems.push(`layoutMode ${t.layoutMode} -> ${v} after FILL/HUG was set (node "${t.name || t.type}")`);
      }
      if ((k === 'layoutSizingHorizontal' || k === 'layoutSizingVertical') && v !== 'FIXED') {
        const bad = !t.parent
          ? `in set_${k}: node must be an auto-layout frame or a child of an auto-layout frame`
          : (t.parent.type !== 'PAGE' && (!t.parent.layoutMode || t.parent.layoutMode === 'NONE')
              ? `in set_${k}: ${v} can only be set on children of auto-layout frames` : null);
        if (bad) {
          const err = new Error(bad);
          const at = (err.stack || '').split('\n').filter(l => l.indexOf('code.js') > -1)[0];
          problems.push(`${bad}\n      at ${(at || '?').trim()}  (node "${t.name || t.type}")`);
          throw err;
        }
      }
      t[k] = v;
      return true;
    }
  });
  const frame = () => seal(Object.assign(base('FRAME'), LAYOUT_PROPS));
  const text = () => {
    const n = Object.assign(base('TEXT'), LAYOUT_PROPS, {
      fontName: null, fontSize: 16, lineHeight: null, letterSpacing: null,
      textAutoResize: 'WIDTH_AND_HEIGHT', textAlignHorizontal: 'LEFT', _chars: ''
    });
    Object.defineProperty(n, 'characters', {
      get() { return this._chars; },
      set(v) {
        if (typeof v !== 'string') problems.push(`characters set to ${typeof v}`);
        this._chars = v;
        this.width = Math.max(8, v.length * this.fontSize * 0.55);
        this.height = this.fontSize * 1.6;
      }
    });
    return seal(n);
  };

  const root = {
    children: [],
    insertChild(i, node) {
      root.children = root.children.filter(p => p !== node);
      root.children.splice(i, 0, node);
    }
  };
  let current = null;
  const notices = [];

  return {
    notices, root,
    api: {
      root, command,
      get currentPage() { return current; },
      set currentPage(p) { problems.push('used the sync currentPage setter'); current = p; },
      setCurrentPageAsync: async (p) => { current = p; },
      createFrame: frame,
      createText: text,
      createEllipse: () => seal(Object.assign(base('ELLIPSE'), LAYOUT_PROPS, { arcData: null })),
      createPage: () => { const p = seal(base('PAGE')); root.children.push(p); return p; },
      loadFontAsync: async () => {},
      viewport: { scrollAndZoomIntoView: () => {} },
      notify: (msg, o) => { notices.push({ msg, error: !!(o && o.error) }); },
      closePlugin: () => {}
    }
  };
}

function run(command, state) {
  const env = state || makeFigma(command);
  if (state) env.api.command = command;
  const ctx = vm.createContext({ figma: env.api, console, Math, JSON, Object, Array, String, Number, parseInt });
  ctx.globalThis = ctx;
  return new Promise((resolve, reject) => {
    env.api.closePlugin = () => resolve(env);
    const onReject = (e) => reject(e);
    process.once('unhandledRejection', onReject);
    const done = (v) => { process.removeListener('unhandledRejection', onReject); return v; };
    try {
      vm.runInContext(SRC, ctx, { filename: 'code.js' });
      const inner = resolve;
      env.api.closePlugin = () => inner(done(env));
    } catch (e) { done(); reject(e); }
  });
}

function ownFrames(env) {
  return env.root.children.reduce(
    (acc, p) => acc.concat(p.children.filter(n => n.type === 'FRAME' && n.name.indexOf('PT · ') === 0)),
    []);
}
// the manifest menu nests the night-mode entries one level down
function flatMenu(menu) {
  return menu.reduce((acc, m) => acc.concat(m.menu ? flatMenu(m.menu) : [m]), []);
}
function screenCommands(menu) {
  return flatMenu(menu).filter(m => /^s\d\d$/.test(m.command || ''));
}
function darkCommands(menu) {
  return flatMenu(menu).filter(m => /^dark-s\d\d$/.test(m.command || ''));
}
function screenPages(env) {
  return env.root.children.filter(p => p.children.some(n => n.name.indexOf('PT · ') === 0));
}

// An auto-layout frame whose height was pinned (by a resize) and whose children then
// grew past it clips its own content — the card that cuts off its last line of text.
function pinnedTooShort(env) {
  const bad = [];
  const visit = (n) => {
    const vertical = n.layoutMode === 'VERTICAL';
    const pinned = vertical ? n.primaryAxisSizingMode === 'FIXED' : n.counterAxisSizingMode === 'FIXED';
    if (n.layoutMode && n.layoutMode !== 'NONE' && pinned && n.children.length) {
      const gaps = vertical ? (n.itemSpacing || 0) * (n.children.length - 1) : 0;
      const inner = vertical
        ? n.children.reduce((a, c) => a + c.height, 0) + gaps
        : n.children.reduce((a, c) => Math.max(a, c.height), 0);
      const need = inner + (n.paddingTop || 0) + (n.paddingBottom || 0);
      if (need > n.height + 8) {
        bad.push(`"${n.name || n.type}" pins its height at ${Math.round(n.height)} but its content needs ${Math.round(need)}`);
      }
    }
    (n.children || []).forEach(visit);
  };
  env.root.children.forEach(p => p.children.forEach(visit));
  return bad;
}

// Absolutely-positioned children that hang out of a fixed-size parent are the
// "elements sitting on top of each other" class of bug — the parent stops at its
// declared height and whatever comes next in the page flow gets overlapped.
function spills(env) {
  const bad = [];
  const visit = (n) => {
    if (n.children && n.children.length && n.layoutMode === 'NONE' && n.width > 0 && n.height > 0) {
      for (const c of n.children) {
        const right = c.x + c.width, bottom = c.y + c.height;
        if (right > n.width + 1 || bottom > n.height + 1) {
          bad.push(`"${c.name || c.type}" spills out of "${n.name || n.type}" `
            + `(needs ${Math.round(right)}x${Math.round(bottom)}, parent is ${Math.round(n.width)}x${Math.round(n.height)})`);
        }
      }
    }
    (n.children || []).forEach(visit);
  };
  env.root.children.forEach(p => p.children.forEach(visit));
  return bad;
}

(async () => {
  // 1. full draw
  const all = await run('all');
  const frames = ownFrames(all);
  const perWidth = {};
  frames.forEach(f => { perWidth[f.width] = (perWidth[f.width] || 0) + 1; });
  const pages = screenPages(all);
  console.log(`all:  ${pages.length} pages, ${frames.length} frames  ${JSON.stringify(perWidth)}`);
  if (pages.length !== 13) problems.push(`expected 13 pages, got ${pages.length}`);
  pages.forEach(p => {
    const f = p.children.filter(n => n.type === 'FRAME');
    if (f.length !== 3) problems.push(`page "${p.name}" holds ${f.length} frames, expected 3`);
  });
  // pages must be ordered the way SCREENS lists them
  const order = pages.map(p => p.name).join(' | ');
  const want = screenCommands(MANIFEST.menu).map(m => m.name).join(' | ');
  if (order !== want) problems.push(`page order is\n      ${order}\n      expected\n      ${want}`);
  console.log(`      ${all.notices.map(n => n.msg).join(' | ')}`);
  if (frames.length !== 39) problems.push(`expected 39 frames, drew ${frames.length}`);
  const allErr = all.notices.find(n => n.error);
  if (allErr) problems.push(`all: ${allErr.msg}`);
  // A frame missing its breakpoint suffix means the screen function threw before returning
  const unsuffixed = frames.filter(f => !/ · (Desktop|Tablet|Mobile)$/.test(f.name));
  unsuffixed.forEach(f => problems.push(`"${f.name}" has no breakpoint suffix — its screen function threw`));

  // 2. registry names must match the frames the screen functions create
  const commands = screenCommands(MANIFEST.menu);
  const drawn = new Set(frames.map(f => f.name.replace(/^PT · /, '').replace(/ · (Desktop|Tablet|Mobile)$/, '')));
  for (const m of commands) {
    if (!drawn.has(m.name)) problems.push(`manifest menu "${m.name}" (${m.command}) matches no frame name`);
  }
  if (commands.length !== 13) problems.push(`expected 13 screen commands in the manifest, found ${commands.length}`);
  console.log(`menu: ${commands.length} screen commands, all matched`);

  // 3. every single-screen command, on a clean file each time
  for (const m of commands) {
    const one = await run(m.command);
    const got = ownFrames(one);
    if (got.length !== 3) problems.push(`${m.command} drew ${got.length} frames, expected 3`);
    const pg = screenPages(one);
    if (pg.length !== 1 || pg[0].name !== m.name) {
      problems.push(`${m.command} drew onto ${pg.map(p => `"${p.name}"`).join(', ') || 'nothing'}, expected page "${m.name}"`);
    }
    if (one.notices.some(n => n.error)) problems.push(`${m.command}: ${one.notices.find(n => n.error).msg}`);
  }
  console.log(`each: ${commands.length} commands drew 3 frames apiece`);

  // 3b. night mode: dark frames carry their own prefix and land under the light row
  const darkCmds = darkCommands(MANIFEST.menu);
  if (darkCmds.length !== commands.length) {
    problems.push(`expected ${commands.length} night-mode commands, found ${darkCmds.length}`);
  }
  const night = await run('dark-all');
  const darkFrames = night.root.children.reduce(
    (acc, p) => acc.concat(p.children.filter(n => n.type === 'FRAME' && n.name.indexOf('PT \u263E ') === 0)), []);
  if (darkFrames.length !== 39) problems.push(`dark-all drew ${darkFrames.length} frames, expected 39`);
  if (night.notices.some(n => n.error)) problems.push(`dark-all: ${night.notices.find(n => n.error).msg}`);
  console.log(`dark: ${darkFrames.length} frames  ${night.notices.map(n => n.msg).join(' | ')}`);
  // a dark run on a file that already holds the light row must not clear it
  const both = await run('all');
  await run('dark-s09', both);
  const kept = ownFrames(both).length;
  if (kept !== 39) problems.push(`a night run cleared light frames: ${kept} left of 39`);

  // 3c. nothing may hang out of a fixed-size parent
  const spilled = spills(all).concat(pinnedTooShort(all));
  spilled.forEach(x => problems.push(x));
  console.log(`fit:  ${spilled.length ? spilled.length + ' overflows' : 'nothing spills out of or overflows its parent'}`);

  // 3d. the audit command must run and leave a report behind
  const audited = await run('audit', both);
  const reports = audited.root.children.reduce(
    (acc, p) => acc.concat(p.children.filter(n => n.name.indexOf('PT \u26A0') === 0)), []);
  if (reports.length !== 1) problems.push(`audit left ${reports.length} reports, expected 1`);
  if (audited.notices.some(n => n.error)) problems.push(`audit: ${audited.notices.find(n => n.error).msg}`);
  console.log(`audit: ${audited.notices.map(n => n.msg).join(' | ')}`);

  // 4. an unknown command must fail loudly, not silently draw nothing
  const bad = await run('nope');
  if (!bad.notices.some(n => n.error)) problems.push('unknown command did not report an error');

  // 5. tidy on an empty page must not throw
  const tidied = await run('tidy');
  console.log(`tidy: ${tidied.notices.map(n => n.msg).join(' | ')}`);

  if (problems.length) {
    console.log(`\nPROBLEMS (${problems.length}):`);
    problems.slice(0, 25).forEach(p => console.log('  - ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nno problems');
  }
})().catch(e => { console.log('FAILED:', (e && e.stack) || e); process.exitCode = 1; });
