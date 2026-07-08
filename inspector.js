// ============================================================
//  APEX Inspector v1.0 — floating dev panel for Oracle APEX
//  Injected into page context. Toggles on repeated clicks.
//  Uses only documented apex.* APIs: apex.item, apex.region, apex.env
// ============================================================
(function () {
  "use strict";

  var PANEL_ID = "apxi-panel";

  // ---- Toggle: if already open, close and stop ----
  var existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); return; }

  // ---- Guard: is this an APEX page? ----
  if (!window.apex || !window.apex.item) {
    alert("APEX Inspector: this doesn't look like a running Oracle APEX page (window.apex not found).");
    return;
  }

  var $ = window.apex.jQuery || window.jQuery;

  // ============ discovery ============

  function envInfo() {
    var e = window.apex.env || {};
    function fv(name, itm) {
      return e[name] || (window.apex.item(itm) && window.apex.item(itm).getValue()) || "?";
    }
    return {
      app:     fv("APP_ID", "pFlowId"),
      page:    fv("APP_PAGE_ID", "pFlowStepId"),
      session: fv("APP_SESSION", "pInstance")
    };
  }

  function findItems() {
    // Standard APEX page/application item naming: P<page>_NAME or G_/AI_ globals.
    // APEX renders helper elements sharing the item's id prefix
    // (P1_X_CONTAINER, P1_X_LABEL, radio options P1_X_0 ...) — filter them out.
    var HELPER_SUFFIX = /_(CONTAINER|LABEL|LABEL_TEXT|inline|error|error_placeholder|BODY|CHZN|display|input|HOLDER)$/i;
    var FORM_TAGS = { INPUT: 1, SELECT: 1, TEXTAREA: 1 };

    var seen = {}, out = [];
    var nodes = document.querySelectorAll("[id]");

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], id = node.id;
      if (!/^[A-Z][A-Z0-9]*_[A-Z0-9_$#]+$/.test(id)) continue;    // item-ish name
      if (!/^P\d+_/.test(id) && !/^(G|AI|F|LAST|APP)_/.test(id)) continue;
      if (HELPER_SUFFIX.test(id)) continue;                        // wrapper/label/etc.
      if (seen[id]) continue;

      // Must be a real form control, or an APEX item group (radio/checkbox fieldset)
      var isControl = FORM_TAGS[node.tagName] === 1;
      var isGroup   = /(^|\s)apex-item-group/.test(node.className || "");
      if (!isControl && !isGroup) continue;

      // Skip individual radio/checkbox option inputs (P1_STATUS_0, _1, ...)
      // when the parent group item exists on the page.
      var optMatch = id.match(/^(.*)_(\d+)$/);
      if (isControl && optMatch &&
          (node.type === "radio" || node.type === "checkbox") &&
          document.getElementById(optMatch[1])) {
        continue;
      }

      var it;
      try { it = window.apex.item(id); } catch (err) { continue; }
      if (!it || !it.node) continue;

      seen[id] = 1;
      var val;
      try { val = it.getValue(); } catch (err2) { val = "(error)"; }
      out.push({ id: id, value: val, hidden: node.type === "hidden", node: node });
    }
    out.sort(function (a, b) { return a.id.localeCompare(b.id); });
    return out;
  }

  // A "real" region: carries an APEX region template class, or apex.region()
  // reports a specific widget type. On recent APEX versions apex.region()
  // returns a *generic* interface for almost any element id, so a truthy
  // check alone matches items, toolbars, and IG internals — hence this test.
  function realRegion(el) {
    if (!el || !el.id) return null;
    var cls = el.className || "";
    var hasRegionClass = /(^|\s)(t-Region|t-IRR-region|t-ContentBlock)(\s|$|-)/.test(cls);
    var reg = null;
    try { reg = window.apex.region(el.id); } catch (e) { reg = null; }
    if (!reg) return null;
    var type = reg.type || "generic";
    if (!hasRegionClass && (type === "generic" || !type)) return null;
    // skip internal auto-generated sub-elements like R146..._ig_toolbar
    if (/^R\d{8,}_/.test(el.id)) return null;
    var titleEl = el.querySelector(".t-Region-title, .t-IRR-region-name, h2");
    return {
      id: el.id,
      type: type,
      title: titleEl ? titleEl.textContent.trim() : el.id,
      isStatic: !/^R\d{8,}$/.test(el.id)
    };
  }

  // Walk up from an item's node to find its enclosing real region.
  var regionCache = {};
  function regionOf(node) {
    var el = node.parentElement;              // start ABOVE the item itself
    while (el && el !== document.body) {
      if (el.id) {
        if (regionCache[el.id] === undefined) {
          regionCache[el.id] = realRegion(el);
        }
        if (regionCache[el.id]) return regionCache[el.id];
      }
      el = el.parentElement;
    }
    return { id: null, title: "Page (no region)", isStatic: false };
  }

  function findRegions() {
    var out = [], seen = {};
    var nodes = document.querySelectorAll("[id]");
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].id;
      if (seen[id]) continue;
      var r = realRegion(nodes[i]);
      if (r) { seen[id] = 1; out.push({ id: r.id, type: r.type }); }
    }
    out.sort(function (a, b) { return a.id.localeCompare(b.id); });
    return out;
  }

  // ============ styles ============

  var css = [
    "#apxi-panel{position:fixed;top:16px;right:16px;width:360px;max-height:82vh;z-index:2147483000;",
    " background:#141a26;color:#e6ebf5;border:1px solid #33405c;border-radius:12px;",
    " font:12px/1.45 Consolas,Menlo,monospace;box-shadow:0 12px 40px rgba(0,0,0,.5);display:flex;flex-direction:column}",
    "#apxi-panel *{box-sizing:border-box}",
    ".apxi-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;",
    " border-bottom:1px solid #33405c;user-select:none}",
    ".apxi-title{font-weight:700;color:#7fc4ff;flex:1}",
    ".apxi-env{padding:6px 12px;color:#8fa0c0;border-bottom:1px solid #33405c;font-size:11px}",
    ".apxi-tabs{display:flex;border-bottom:1px solid #33405c}",
    ".apxi-tab{flex:1;padding:8px;text-align:center;cursor:pointer;color:#8fa0c0;background:none;border:none;",
    " font:inherit;border-bottom:2px solid transparent}",
    ".apxi-tab.on{color:#e6ebf5;border-bottom-color:#7fc4ff}",
    ".apxi-search{margin:8px 10px;padding:7px 10px;width:calc(100% - 20px);background:#0c1018;",
    " border:1px solid #33405c;border-radius:7px;color:#e6ebf5;font:inherit;outline:none}",
    ".apxi-body{overflow-y:auto;padding:0 10px 10px;flex:1}",
    ".apxi-row{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:7px;margin-bottom:3px;background:#1a2233}",
    ".apxi-row:hover{background:#22304a}",
    ".apxi-group{display:flex;align-items:center;gap:6px;margin:10px 0 5px;padding:4px 4px 4px 0;",
    " color:#7fc4ff;font-weight:700;cursor:pointer;border-bottom:1px solid #33405c}",
    ".apxi-group:hover{color:#b3dcff}",
    ".apxi-group .apxi-gid{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".apxi-group .apxi-gnote{color:#5b6880;font-weight:400;font-size:10px;flex-shrink:0}",
    ".apxi-name{color:#ffd479;cursor:pointer;flex-shrink:0}",
    ".apxi-name:hover{text-decoration:underline}",
    ".apxi-val{color:#b8e6c8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}",
    ".apxi-val.apxi-empty{color:#5b6880;font-style:italic}",
    ".apxi-type{color:#8fa0c0;font-size:10px;flex-shrink:0}",
    ".apxi-btns{display:flex;gap:6px;padding:8px 10px;border-top:1px solid #33405c}",
    ".apxi-btn{flex:1;padding:7px;background:#22304a;color:#e6ebf5;border:1px solid #33405c;border-radius:7px;",
    " cursor:pointer;font:inherit}",
    ".apxi-btn:hover{border-color:#7fc4ff}",
    ".apxi-x{background:none;border:none;color:#8fa0c0;cursor:pointer;font-size:15px;line-height:1}",
    ".apxi-x:hover{color:#ff8f7a}",
    ".apxi-flash{outline:3px solid #ffd479 !important;outline-offset:2px;transition:outline .1s}",
    ".apxi-count{color:#5b6880;font-size:10px;padding:0 12px 6px}",
    ".apxi-toast{position:fixed;bottom:20px;right:20px;background:#2c7a4b;color:#fff;padding:8px 14px;",
    " border-radius:8px;z-index:2147483001;font:12px Consolas,monospace}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ============ panel skeleton ============

  var env = envInfo();
  var panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML =
    '<div class="apxi-head"><span class="apxi-title">⚡ APEX Inspector</span>' +
    '<button class="apxi-x" title="Close">✕</button></div>' +
    '<div class="apxi-env">App <b>' + env.app + '</b> · Page <b>' + env.page + '</b> · Session <b>' + env.session + '</b></div>' +
    '<div class="apxi-tabs">' +
    '<button class="apxi-tab on" data-t="items">Items</button>' +
    '<button class="apxi-tab" data-t="regions">Regions</button></div>' +
    '<input class="apxi-search" placeholder="filter…">' +
    '<div class="apxi-count"></div>' +
    '<div class="apxi-body"></div>' +
    '<div class="apxi-btns">' +
    '<button class="apxi-btn" data-a="refresh">↻ Refresh</button>' +
    '<button class="apxi-btn" data-a="copyall">Copy all as JSON</button></div>';
  document.body.appendChild(panel);

  var body    = panel.querySelector(".apxi-body");
  var search  = panel.querySelector(".apxi-search");
  var countEl = panel.querySelector(".apxi-count");
  var mode    = "items";

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "apxi-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1400);
  }

  function copy(text, label) {
    navigator.clipboard.writeText(text).then(function () { toast(label || "Copied"); });
  }

  // ============ render ============

  function render() {
    var q = search.value.trim().toUpperCase();
    body.innerHTML = "";
    var n = 0;

    if (mode === "items") {
      // Group items by their enclosing region
      var groups = [], gmap = {};
      findItems().forEach(function (it) {
        if (q && it.id.indexOf(q) === -1) return;
        var reg = regionOf(it.node);
        var key = reg.id || "__page__";
        if (!gmap[key]) {
          gmap[key] = { reg: reg, items: [] };
          groups.push(gmap[key]);
        }
        gmap[key].items.push(it);
      });

      groups.forEach(function (g) {
        // ---- region header ----
        var head = document.createElement("div");
        head.className = "apxi-group";
        var label = g.reg.isStatic ? g.reg.id : g.reg.title;
        var note  = g.reg.id
          ? (g.reg.isStatic ? "region · click to copy" : "no static ID")
          : "";
        head.innerHTML = '<span class="apxi-gid"></span>' +
                         (note ? '<span class="apxi-gnote">' + note + '</span>' : "");
        head.querySelector(".apxi-gid").textContent = "▸ " + label;
        head.title = g.reg.isStatic
          ? "Click to copy Static ID: " + g.reg.id
          : (g.reg.id ? "Internal id " + g.reg.id + " — assign a Static ID in Page Designer → Advanced" : "");
        if (g.reg.id) {
          head.onclick = function () {
            copy(g.reg.id, g.reg.isStatic ? "Copied " + g.reg.id : "Copied internal id " + g.reg.id);
          };
          head.onmouseenter = function () {
            var el = document.getElementById(g.reg.id);
            if (el) el.classList.add("apxi-flash");
          };
          head.onmouseleave = function () {
            var el = document.getElementById(g.reg.id);
            if (el) el.classList.remove("apxi-flash");
          };
        }
        body.appendChild(head);

        // ---- items in this region ----
        g.items.forEach(function (it) {
          n++;
          var row = document.createElement("div");
          row.className = "apxi-row";
          var isEmpty = it.value === null || it.value === "" ||
                        (Array.isArray(it.value) && !it.value.length);
          row.innerHTML =
            '<span class="apxi-name" title="Click to copy name"></span>' +
            '<span class="apxi-val' + (isEmpty ? " apxi-empty" : "") + '" title="Click to edit value"></span>' +
            (it.hidden ? '<span class="apxi-type">hidden</span>' : "");
          row.querySelector(".apxi-name").textContent = it.id;
          row.querySelector(".apxi-val").textContent =
            isEmpty ? "(empty)" : (Array.isArray(it.value) ? it.value.join(":") : String(it.value));

          row.querySelector(".apxi-name").onclick = function () { copy(it.id, "Copied " + it.id); };
          row.querySelector(".apxi-val").onclick = function () {
            var cur = Array.isArray(it.value) ? it.value.join(":") : (it.value == null ? "" : String(it.value));
            var nv = prompt("Set value for " + it.id + "\n(fires change event → your Dynamic Actions will run)", cur);
            if (nv !== null) {
              window.apex.item(it.id).setValue(nv, null, false); // false = do NOT suppress change event
              toast(it.id + " updated");
              render();
            }
          };
          body.appendChild(row);
        });
      });
    } else {
      findRegions().forEach(function (r) {
        if (q && r.id.toUpperCase().indexOf(q) === -1) return;
        n++;
        var row = document.createElement("div");
        row.className = "apxi-row";
        row.innerHTML =
          '<span class="apxi-name" title="Click to copy Static ID"></span>' +
          '<span class="apxi-type"></span>';
        row.querySelector(".apxi-name").textContent = r.id;
        row.querySelector(".apxi-type").textContent = r.type;
        row.querySelector(".apxi-name").onclick = function () { copy(r.id, "Copied " + r.id); };
        row.onmouseenter = function () {
          var el = document.getElementById(r.id);
          if (el) el.classList.add("apxi-flash");
        };
        row.onmouseleave = function () {
          var el = document.getElementById(r.id);
          if (el) el.classList.remove("apxi-flash");
        };
        body.appendChild(row);
      });
    }
    countEl.textContent = n + " " + mode + (q ? " (filtered)" : "");
  }

  // ============ wiring ============

  panel.querySelector(".apxi-x").onclick = function () { panel.remove(); };
  search.oninput = render;

  panel.querySelectorAll(".apxi-tab").forEach(function (t) {
    t.onclick = function () {
      mode = t.dataset.t;
      panel.querySelectorAll(".apxi-tab").forEach(function (x) {
        x.classList.toggle("on", x === t);
      });
      render();
    };
  });

  panel.querySelector('[data-a="refresh"]').onclick = render;

  panel.querySelector('[data-a="copyall"]').onclick = function () {
    if (mode === "items") {
      var obj = {};
      findItems().forEach(function (it) { obj[it.id] = it.value; });
      copy(JSON.stringify(obj, null, 2), "Items copied as JSON");
    } else {
      copy(findRegions().map(function (r) { return r.id; }).join("\n"), "Region IDs copied");
    }
  };

  // ---- drag to move ----
  (function () {
    var head = panel.querySelector(".apxi-head"), sx, sy, ox, oy, dragging = false;
    head.addEventListener("mousedown", function (e) {
      if (e.target.classList.contains("apxi-x")) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      panel.style.left = (ox + e.clientX - sx) + "px";
      panel.style.top  = (oy + e.clientY - sy) + "px";
      panel.style.right = "auto";
    });
    document.addEventListener("mouseup", function () { dragging = false; });
  })();

  render();
})();
