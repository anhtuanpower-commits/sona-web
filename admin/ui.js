/* Thành phần giao diện dùng chung của trang Admin. */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
export const fmtMoney = n => Number(n || 0).toLocaleString("vi-VN") + "đ";
export const fmtSize = b => b < 1024 ? b + " B" : b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1).replace(".", ",") + " MB";
export const fmtDate = d => { const m = String(d || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "vừa xong"; if (s < 3600) return Math.floor(s / 60) + " phút trước";
  if (s < 86400) return Math.floor(s / 3600) + " giờ trước"; if (s < 86400 * 30) return Math.floor(s / 86400) + " ngày trước";
  return new Date(iso).toLocaleDateString("vi-VN");
}

const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  home: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  dash: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  page: P('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  box: P('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'),
  pen: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  img: P('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  help: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  menu: P('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  x: P('<path d="M18 6L6 18M6 6l12 12"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  ext: P('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  up: P('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  down: P('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  trash: P('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  check: P('<path d="M5 12l5 5L20 7"/>'),
  warn: P('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
  upload: P('<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  logout: P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  phone: P('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/>'),
  desk: P('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  lock: P('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
};

/* ---------- thông báo ---------- */
export function toast(msg, type = "ok") {
  const box = $("#toasts"); const el = document.createElement("div");
  el.className = "toast " + type; el.setAttribute("role", type === "err" ? "alert" : "status");
  el.innerHTML = (type === "err" ? I.warn : I.check) + `<span>${esc(msg)}</span>`;
  box.append(el); while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.classList.add("out"), type === "err" ? 6000 : 3200); setTimeout(() => el.remove(), type === "err" ? 6400 : 3600);
}

/* ---------- hộp thoại ---------- */
export function modal(html, { wide = false, onClose } = {}) {
  const wrap = document.createElement("div"); wrap.className = "modal";
  wrap.innerHTML = `<div class="dialog${wide ? " wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(wrap); document.body.classList.add("locked");
  const prev = document.activeElement;
  let closed = false;
  const onKey = e => { if (e.key === "Escape" && wrap === [...document.querySelectorAll(".modal")].pop()) { e.stopPropagation(); close(); } };
  const close = () => { if (closed) return; closed = true; wrap.remove(); document.removeEventListener("keydown", onKey, true); if (!$(".modal")) document.body.classList.remove("locked"); prev?.focus?.(); onClose?.(); };
  wrap.close = close;
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey, true);
  setTimeout(() => ($("[autofocus]", wrap) || $("button,input,select,textarea", wrap))?.focus(), 30);
  return { el: wrap, close };
}
export function confirmBox(msg, { yes = "Đồng ý", no = "Hủy", danger = false, title = "" } = {}) {
  return new Promise(res => {
    let v = false;
    const m = modal(`${title ? `<h2>${esc(title)}</h2>` : ""}<p class="dlg-msg">${esc(msg)}</p><div class="row end"><button class="btn ghost" data-close>${esc(no)}</button><button class="btn ${danger ? "danger-solid" : ""}" id="cfYes" autofocus>${esc(yes)}</button></div>`, { onClose: () => res(v) });
    $("#cfYes", m.el).onclick = () => { v = true; m.close(); };
  });
}

/* ---------- ô nhập ---------- */
const attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== false && v !== null).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(" ");
export function field(name, label, value, o = {}) {
  const id = "f_" + name.replace(/[^\w]/g, "_");
  const common = { id, name, placeholder: o.ph, maxlength: o.max, required: o.req, disabled: o.disabled, inputmode: o.inputmode, autocomplete: "off" };
  let ctl;
  if (o.area) ctl = `<textarea ${attrs({ ...common, rows: o.rows || 4, class: o.mono ? "mono" : undefined })}>${esc(value)}</textarea>`;
  else if (o.options) ctl = `<select ${attrs(common)}>${o.options.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
  else ctl = `<input ${attrs({ ...common, type: o.type || "text", value: value ?? "", list: o.list, min: o.min, step: o.step })}>`;
  const counter = o.max || o.count ? `<span class="count" data-count="${id}" data-max="${o.count || o.max}"></span>` : "";
  return `<div class="fld${o.cls ? " " + o.cls : ""}" data-f="${esc(name)}"><label for="${id}">${esc(label)}${o.req ? ' <i class="req">*</i>' : ""}${counter}</label>${ctl}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<p class="ferr" hidden></p></div>`;
}
export function toggle(name, label, on, hint = "") {
  return `<div class="fld tg" data-f="${esc(name)}"><label class="switch"><input type="checkbox" name="${esc(name)}" id="f_${name.replace(/[^\w]/g, "_")}"${on ? " checked" : ""}><span class="knob"></span><span class="tl">${esc(label)}</span></label>${hint ? `<p class="hint">${hint}</p>` : ""}</div>`;
}
export function mdEditor(name, label, value, hint = "") {
  return `<div class="fld md" data-f="${esc(name)}"><label for="f_${name}">${esc(label)}</label>
  <div class="mdbar" role="toolbar" aria-label="Định dạng">
    <button type="button" data-md="b" title="Chữ đậm"><b>B</b></button><button type="button" data-md="h">Tiêu đề nhỏ</button><button type="button" data-md="ul">• Danh sách</button><button type="button" data-md="q">Câu mẫu</button><button type="button" data-md="a">Link</button><button type="button" data-md="img">Ảnh</button>
  </div><textarea id="f_${name}" name="${esc(name)}" rows="14" class="mono">${esc(value)}</textarea>
  <p class="hint">${hint || "Mỗi đoạn cách nhau một dòng trống. Dòng bắt đầu bằng <b>## </b> là tiêu đề nhỏ, <b>- </b> là danh sách, <b>&gt; </b> là câu mẫu có nút Chép."}</p><p class="ferr" hidden></p></div>`;
}
export function imageField(name, label, path, hint = "") {
  return `<div class="fld imgf" data-f="${esc(name)}"><label>${esc(label)}</label><div class="imgbox">
    <div class="thumbw" data-thumb="${esc(name)}">${path ? `<img src="${esc(imgSrc(path))}" alt="" data-raw="${esc(path)}">` : `<span>${I.img}</span>`}</div>
    <div class="imgact"><input type="hidden" name="${esc(name)}" id="f_${esc(name)}" value="${esc(path || "")}">
      <code class="ipath" data-ipath="${esc(name)}">${esc(path || "Chưa có ảnh")}</code>
      <div class="row"><button type="button" class="btn ghost sm" data-pick="${esc(name)}">${I.img} Chọn ảnh</button>${path ? `<button type="button" class="btn ghost sm" data-unpick="${esc(name)}">Bỏ ảnh</button>` : ""}</div></div>
  </div>${hint ? `<p class="hint">${hint}</p>` : ""}<p class="ferr" hidden></p></div>`;
}
export let imgSrc = p => !p ? "" : /^https?:/.test(p) ? p : "../" + p;
export const setImgSrc = fn => { imgSrc = fn; };

export function formData(root) {
  const o = {};
  $$("[name]", root).forEach(e => { o[e.name] = e.type === "checkbox" ? e.checked : e.value.trim(); });
  return o;
}
export function showErrors(root, issues) {
  $$(".fld.bad", root).forEach(f => { f.classList.remove("bad"); const p = $(".ferr", f); if (p) p.hidden = true; });
  let first = null;
  for (const i of issues) {
    const key = i.truong.split(".")[0];
    const f = $(`.fld[data-f="${CSS.escape(i.truong)}"]`, root) || $(`.fld[data-f="${CSS.escape(key)}"]`, root);
    if (!f) continue;
    f.classList.add("bad"); const p = $(".ferr", f); if (p && p.hidden) { p.hidden = false; p.textContent = i.msg; }
    first = first || f;
  }
  first?.scrollIntoView({ behavior: "smooth", block: "center" });
  ($("input,textarea,select", first || root))?.focus({ preventScroll: true });
}
export function bindCounters(root) {
  $$("[data-count]", root).forEach(c => {
    const inp = $("#" + c.dataset.count, root), max = +c.dataset.max;
    const upd = () => { const n = inp.value.length; c.textContent = `${n}/${max}`; c.classList.toggle("over", n > max); };
    inp.addEventListener("input", upd); upd();
  });
}
export function bindMd(root) {
  $$(".fld.md", root).forEach(f => {
    const ta = $("textarea", f);
    $$("[data-md]", f).forEach(b => b.onclick = () => {
      const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
      const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
      const k = b.dataset.md; let ins, from = s, to = e;
      if (k === "b") ins = `**${sel || "chữ đậm"}**`;
      else if (k === "a") ins = `[${sel || "chữ hiện ra"}](https://)`;
      else if (k === "img") ins = `\n![${sel || "mô tả ảnh"}](img/anh/ten-anh.jpg)\n`;
      else { const pre = { h: "## ", ul: "- ", q: "> " }[k]; from = lineStart; to = lineStart; ins = pre; }
      ta.setRangeText(ins, from, to, "end"); ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}
export const loading = (t = "Đang tải…") => `<div class="loading" role="status"><span class="spin"></span>${esc(t)}</div>`;
export const empty = (title, text = "", action = "") => `<div class="emptyst"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
export const chip = (t, kind = "") => `<span class="chip ${kind}">${esc(t)}</span>`;
