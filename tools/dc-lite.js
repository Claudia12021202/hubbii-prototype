/* dc-lite：讓原型的元件在一般瀏覽器執行的小型執行環境。
 * 支援 {{路徑}}、<sc-if>、<sc-for>、<dc-import>、onClick/onChange 事件、
 * class Component extends DCLogic（state、setState、componentDidMount、componentDidUpdate）。 */
(function () {
  'use strict';
  var REG = {};
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BOOL_PROPS = { checked: 'checked', disabled: 'disabled', selected: 'selected', hidden: 'hidden', readonly: 'readOnly', required: 'required', multiple: 'multiple' };
  var TEXT_INPUTS = { '': 1, text: 1, search: 1, email: 1, password: 1, number: 1, tel: 1, url: 1 };
  var helmetsDone = {};

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state, this.props);
    this.state = Object.assign({}, this.state, patch);
    schedule(this);
  };
  DCLogic.prototype.forceUpdate = function () { schedule(this); };

  /* ---------- 模板取值 ---------- */
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var v = scope, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(s, scope) {
    return s.replace(/\{\{([^}]*)\}\}/g, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  function attrVal(s, scope) {
    var m = s.trim().match(/^\{\{([^}]*)\}\}$/);
    if (m) return lookup(m[1], scope);
    return s.indexOf('{{') < 0 ? s : interp(s, scope);
  }
  function camel(k) { return k.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function fixHref(s) {
    return s.replace(/([A-Za-z0-9_]+)\.dc\.html/g, '$1.html').replace(/(^|\/)Main\.html/, '$1index.html');
  }
  function evName(lk, tag, attrs) {
    var e = lk.slice(2);
    if (e === 'change') {
      var type = (attrs.type || '').toLowerCase();
      if (tag === 'textarea' || (tag === 'input' && TEXT_INPUTS[type])) return 'input';
    }
    return e;
  }

  /* ---------- 模板 → 虛擬節點 ---------- */
  function build(node, scope, out) {
    if (typeof node === 'string') { out.push({ text: node.indexOf('{{') < 0 ? node : interp(node, scope) }); return; }
    var tag = node[0], attrs = node[1], kids = node[2], i;
    if (tag === 'sc-if') {
      if (attrVal(attrs.value || '', scope)) for (i = 0; i < kids.length; i++) build(kids[i], scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var list = attrVal(attrs.list || '', scope) || [], as = attrs.as || 'item';
      list.forEach(function (it, idx) {
        var sc = Object.create(scope); sc[as] = it; sc.$index = idx;
        for (var j = 0; j < kids.length; j++) build(kids[j], sc, out);
      });
      return;
    }
    if (tag === 'dc-import') {
      var props = {};
      Object.keys(attrs).forEach(function (k) {
        if (k === 'name' || k.indexOf('hint-') === 0) return;
        props[camel(k)] = attrVal(attrs[k], scope);
      });
      out.push({ comp: attrs.name, props: props });
      return;
    }
    var v = { tag: tag, attrs: {}, ev: {}, dp: {}, kids: [] };
    Object.keys(attrs).forEach(function (k) {
      if (k.indexOf('hint-') === 0) return;
      var raw = attrs[k], lk = k.toLowerCase(), dyn = raw.indexOf('{{') >= 0, val = attrVal(raw, scope);
      if (lk.length > 2 && lk.indexOf('on') === 0) { if (typeof val === 'function') v.ev[evName(lk, tag, attrs)] = val; return; }
      if (lk === 'value' && dyn) { v.dp.value = val == null ? '' : String(val); return; }
      if (BOOL_PROPS[lk]) { if (dyn) v.dp[BOOL_PROPS[lk]] = !!val; else v.attrs[k] = raw; return; }
      if (val === true) { v.attrs[k] = lk.indexOf('aria-') === 0 ? 'true' : ''; return; }
      if (val === false || val == null) { if (lk.indexOf('aria-') === 0 && val === false) v.attrs[k] = 'false'; return; }
      var s = String(val);
      if (lk === 'href') s = fixHref(s);
      v.attrs[k] = s;
    });
    for (i = 0; i < kids.length; i++) build(kids[i], scope, v.kids);
    out.push(v);
  }

  /* ---------- 虛擬節點 → DOM ---------- */
  function addEv(el, e, f) {
    el._h[e] = f;
    el._l = el._l || {};
    if (!el._l[e]) {
      el._l[e] = true;
      el.addEventListener(e, function (ev) { var fn = el._h[e]; if (fn) fn(ev); });
    }
  }
  function applyDp(el, dp) {
    Object.keys(dp).forEach(function (k) {
      if (k === 'value') { if (el.value !== dp.value) el.value = dp.value; }
      else if (el[k] !== dp[k]) el[k] = dp[k];
    });
  }
  function createDom(v, ns, inst) {
    if (v.text !== undefined) return document.createTextNode(v.text);
    if (v.comp) {
      var box = document.createElement('dc-c');
      box.style.display = 'contents';
      mount(v.comp, v.props, box);
      return box;
    }
    var myNs = (v.tag === 'svg' || ns === SVG_NS) ? SVG_NS : null;
    var el = myNs ? document.createElementNS(myNs, v.tag) : document.createElement(v.tag);
    el._ns = myNs; el._h = {};
    Object.keys(v.attrs).forEach(function (k) { el.setAttribute(k, v.attrs[k]); });
    Object.keys(v.ev).forEach(function (e) { addEv(el, e, v.ev[e]); });
    v.kids.forEach(function (c) { el.appendChild(createDom(c, myNs, inst)); });
    applyDp(el, v.dp);
    return el;
  }
  function same(a, b) {
    if (a.text !== undefined || b.text !== undefined) return a.text !== undefined && b.text !== undefined;
    if (a.comp || b.comp) return a.comp === b.comp;
    return a.tag === b.tag;
  }
  function kill(dom) {
    if (dom.nodeType !== 1) return;
    if (dom._inst) dom._inst.__dead = true;
    var inner = dom.querySelectorAll ? dom.querySelectorAll('dc-c') : [];
    for (var i = 0; i < inner.length; i++) if (inner[i]._inst) inner[i]._inst.__dead = true;
  }
  function patch(parent, dom, o, n, ns, inst) {
    if (!same(o, n)) {
      var nd = createDom(n, ns, inst);
      parent.replaceChild(nd, dom);
      kill(dom);
      return;
    }
    if (n.text !== undefined) { if (o.text !== n.text) dom.nodeValue = n.text; return; }
    if (n.comp) { dom._inst.__setProps(n.props); return; }
    Object.keys(o.attrs).forEach(function (k) { if (!(k in n.attrs)) dom.removeAttribute(k); });
    Object.keys(n.attrs).forEach(function (k) { if (o.attrs[k] !== n.attrs[k]) dom.setAttribute(k, n.attrs[k]); });
    dom._h = {};
    Object.keys(n.ev).forEach(function (e) { addEv(dom, e, n.ev[e]); });
    patchKids(dom, o.kids, n.kids, dom._ns, inst);
    applyDp(dom, n.dp);
  }
  function patchKids(parent, oldK, newK, ns, inst) {
    var nodes = Array.prototype.slice.call(parent.childNodes), i;
    var m = Math.min(oldK.length, newK.length);
    for (i = 0; i < m; i++) patch(parent, nodes[i], oldK[i], newK[i], ns, inst);
    for (i = m; i < newK.length; i++) parent.appendChild(createDom(newK[i], ns, inst));
    for (i = m; i < oldK.length; i++) { kill(nodes[i]); parent.removeChild(nodes[i]); }
  }

  /* ---------- 元件 ---------- */
  var queue = [], pending = false, didMount = [];
  function schedule(inst) {
    if (!inst.__box) return;
    if (queue.indexOf(inst) < 0) queue.push(inst);
    if (!pending) { pending = true; Promise.resolve().then(flush); }
  }
  function flush() {
    pending = false;
    var list = queue; queue = [];
    list.forEach(function (inst) { if (!inst.__dead) render(inst, inst.props); });
  }
  function runDidMount() {
    var list = didMount; didMount = [];
    list.forEach(function (inst) { if (!inst.__dead && inst.componentDidMount) inst.componentDidMount(); });
  }
  function injectHelmet(name) {
    if (helmetsDone[name]) return;
    helmetsDone[name] = true;
    var h = REG[name].helmet;
    if (h) document.head.insertAdjacentHTML('beforeend', h);
  }
  function render(inst, prevProps) {
    var vals = inst.renderVals() || {}, out = [];
    inst.__def.tpl.forEach(function (n) { build(n, vals, out); });
    var prevState = inst.__rs;
    patchKids(inst.__box, inst.__vk, out, null, inst);
    inst.__vk = out; inst.__rs = inst.state;
    if (inst.componentDidUpdate) inst.componentDidUpdate(prevProps, prevState);
  }
  function mount(name, props, box) {
    var def = REG[name];
    if (!def) { box.textContent = '[找不到元件 ' + name + ']'; return; }
    injectHelmet(name);
    if (!def.cls) def.cls = def.factory(DCLogic);
    var inst = new def.cls(props || {});
    inst.props = props || {};
    if (!inst.state) inst.state = {};
    inst.__def = def; inst.__box = box; box._inst = inst;
    inst.__setProps = function (p) { var prev = inst.props; inst.props = p; render(inst, prev); };
    var vals = inst.renderVals() || {}, out = [];
    def.tpl.forEach(function (n) { build(n, vals, out); });
    out.forEach(function (v) { box.appendChild(createDom(v, null, inst)); });
    inst.__vk = out; inst.__rs = inst.state;
    didMount.push(inst);
    Promise.resolve().then(runDidMount);
  }

  window.DC = {
    reg: function (name, tpl, helmet, factory) { REG[name] = { tpl: tpl, helmet: helmet, factory: factory }; },
    mount: function (name, el) { helmetsDone[name] = true; mount(name, {}, el); }
  };
})();
