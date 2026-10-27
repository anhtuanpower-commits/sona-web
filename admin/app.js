/* Trang quản trị web SONA. Dữ liệu web nằm trong kho GitHub (site.json, products.json, posts.json, pages.json, img/).
   Mọi thay đổi được ghi thẳng vào kho qua GitHub API; GitHub Pages tự đăng lại web sau khoảng 1–2 phút. */
import * as G from "./gh.js";
import { upsert, removeBy } from "./noi-dung.js";
import { $, $$, esc, norm, fmtMoney, fmtSize, fmtDate, ago, I, toast, modal, confirmBox, field, toggle, mdEditor, imageField, setImgSrc,
  formData, showErrors, bindCounters, bindMd, loading, empty, chip } from "./ui.js";
import { prepareImage, usages, ACCEPT } from "./anh.js";
import { kiemTra, checkProduct, checkPost, checkPage, checkSite, slugify, isDraft, isHidden, SEO_TITLE_MAX, SEO_DESC_MAX } from "./kiem-tra.js";

const SS = "sona_admin_phien", LS = "sona_admin_nho", OLD_KEY = "sona_admin_token", PREVIEW_KEY = "sona_xem_truoc", REMEMBER_DAYS = 30;
const D = G.DATA;
let USER = null, CAN_WRITE = false, DIRTY = false, IMAGES = null, CODE = {};
const DEMO_BLOBS = {};
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const SAVED = "Đã lưu. Web thật cập nhật sau khoảng 1–2 phút.";
const imageSet = () => IMAGES ? new Set(IMAGES.map(x => x.path)) : null;

setImgSrc(p => !p ? "" : DEMO_BLOBS[p] || (/^https?:/.test(p) ? p : "../" + p));
// Ảnh vừa tải lên chưa có trên web (GitHub Pages chưa đăng lại): lấy tạm từ kho GitHub
document.addEventListener("error", e => {
  const im = e.target;
  if (im.tagName === "IMG" && im.dataset.raw && !im.dataset.tried) { im.dataset.tried = "1"; im.src = G.rawUrl(im.dataset.raw); }
}, true);

/* ================= phiên đăng nhập ================= */
function saveSession(token, remember) {
  try { sessionStorage.setItem(SS, token); } catch (e) { /* trình duyệt chặn lưu */ }
  try { if (remember) localStorage.setItem(LS, JSON.stringify({ t: token, exp: Date.now() + REMEMBER_DAYS * 864e5 })); else localStorage.removeItem(LS); } catch (e) { /* bỏ qua */ }
}
function readSession() {
  try { const s = sessionStorage.getItem(SS); if (s) return s; } catch (e) { /* bỏ qua */ }
  try {
    const o = JSON.parse(localStorage.getItem(LS) || "null");
    if (o && o.exp > Date.now()) return o.t;
    localStorage.removeItem(LS);
    const old = localStorage.getItem(OLD_KEY); // mã lưu từ bản Admin trước
    if (old) { localStorage.removeItem(OLD_KEY); saveSession(old, true); return old; }
  } catch (e) { /* bỏ qua */ }
  return "";
}
function clearSession() {
  try { sessionStorage.removeItem(SS); } catch (e) { /* bỏ qua */ }
  try { [LS, OLD_KEY, PREVIEW_KEY].forEach(k => localStorage.removeItem(k)); } catch (e) { /* bỏ qua */ }
}

async function startDemo() {
  G.setDemo(true); G.setToken(""); USER = { login: "dung-thu", name: "Khách dùng thử", role: "demo" };
  $("#root").innerHTML = `<div class="boot">${loading("Đang mở bản dùng thử…")}</div>`;
  await G.loadAll(); startApp();
}
async function boot() {
  if (/[?&]dung-thu(=|&|$)/.test(location.search)) return startDemo(); // link xem thử không cần đăng nhập
  const t = readSession();
  if (!t) return loginView();
  G.setToken(t);
  $("#root").innerHTML = `<div class="boot">${loading("Đang mở trang quản trị…")}</div>`;
  try { USER = await G.whoAmI(); await G.loadAll(); startApp(); }
  catch (e) { G.setToken(""); if ([401, 403, 404].includes(e.status)) clearSession(); loginView(e.message); }
}

function loginView(msg = "") {
  document.title = "Đăng nhập · Quản trị SONA";
  $("#root").innerHTML = `<div class="login"><div class="lcard">
    <div class="lbrand"><img src="../img/mark-192.png" alt="" width="44" height="44"><div><b>SONA</b><span>Quản trị website</span></div></div>
    <h1>Đăng nhập</h1><p class="muted">Dán mã truy cập GitHub của tài khoản quản lý web SONA.</p>
    ${msg ? `<div class="alert err" role="alert">${I.warn}<span>${esc(msg)}</span></div>` : ""}
    <form id="lf" novalidate>
      <div class="fld"><label for="tk">Mã truy cập GitHub</label><div class="pw"><input id="tk" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required><button type="button" class="iconbtn" id="tkShow" aria-label="Hiện mã">${I.eye}</button></div><p class="ferr" id="tkErr" hidden></p></div>
      ${toggle("rem", `Ghi nhớ trên máy này ${REMEMBER_DAYS} ngày`, false, "Chỉ bật trên máy riêng của anh chị. Máy dùng chung thì để tắt.")}
      <button class="btn wide" id="go" type="submit">${I.lock} Đăng nhập</button>
    </form>
    <details class="howto"><summary>Lần đầu dùng? Cách tạo mã truy cập (khoảng 3 phút)</summary>${tokenSteps()}</details>
    <div class="or"><span>hoặc</span></div>
    <button class="btn ghost wide" id="demo">Dùng thử với dữ liệu thật, không lưu lên web</button>
  </div></div>`;
  $("#tkShow").onclick = () => { const i = $("#tk"); i.type = i.type === "password" ? "text" : "password"; };
  $("#lf").onsubmit = async e => {
    e.preventDefault();
    const t = $("#tk").value.trim(), err = $("#tkErr");
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { err.hidden = false; err.textContent = "Mã chưa đúng dạng. Mã đúng bắt đầu bằng github_pat_ và dài khoảng 90 ký tự."; $("#tk").focus(); return; }
    const b = $("#go"); b.disabled = true; b.innerHTML = `<span class="spin"></span> Đang kiểm tra quyền…`;
    G.setToken(t);
    try { USER = await G.whoAmI(); await G.loadAll(); saveSession(t, $("#f_rem").checked); startApp(); }
    catch (ex) { G.setToken(""); loginView(ex.message); }
  };
  $("#demo").onclick = startDemo;
  setTimeout(() => $("#tk")?.focus(), 50);
}
const tokenSteps = () => `<ol class="steps">
  <li>Đăng nhập GitHub bằng tài khoản chủ web, mở <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">trang tạo mã mới</a>.</li>
  <li><b>Token name</b>: Quản trị SONA. <b>Expiration</b>: chọn 90 ngày (hết hạn thì tạo mã mới).</li>
  <li><b>Repository access</b>: chọn <b>Only select repositories</b>, chọn kho <b>${esc(G.REPO.repo)}</b>.</li>
  <li><b>Permissions → Repository permissions</b>: <b>Contents</b> chọn <b>Read and write</b>. Nên thêm <b>Actions</b> và <b>Pages</b> chọn <b>Read-only</b> để xem tình trạng xuất bản.</li>
  <li>Bấm <b>Generate token</b>, chép mã bắt đầu bằng <code>github_pat_</code> và dán vào ô đăng nhập.</li></ol>
  <p class="hint">Mã này như chìa khóa nhà: không gửi cho ai, không dán vào nơi khác. Lỡ lộ mã thì vào GitHub, mục Settings → Developer settings → Personal access tokens, bấm Delete để vô hiệu ngay.</p>`;

async function logout() {
  if (DIRTY && !await confirmBox("Có thay đổi chưa lưu. Vẫn đăng xuất?", { yes: "Đăng xuất", danger: true })) return;
  DIRTY = false; clearSession(); G.setToken("");
  if (G.DEMO && /dung-thu/.test(location.search)) { location.href = location.pathname; return; }
  location.hash = ""; location.reload();
}

/* ================= khung giao diện ================= */
function startApp() {
  CAN_WRITE = G.DEMO || USER.role === "quan-tri" || USER.role === "bien-tap";
  const roleName = G.ROLE_NAME[USER.role] || "";
  $("#root").innerHTML = `<div class="shell">
  <aside class="side" id="side" aria-label="Menu quản trị">
    <a class="sbrand" href="#/"><img src="../img/mark-192.png" alt="" width="34" height="34"><span><b>SONA</b><small>Quản trị</small></span></a>
    <nav class="snav">
      <a data-nav="" href="#/">${I.dash}<span>Tổng quan</span></a>
      <p class="sgrp">Nội dung</p>
      <a data-nav="trang-chu" href="#/trang-chu">${I.home}<span>Trang chủ</span></a>
      <a data-nav="trang" href="#/trang">${I.page}<span>Trang</span></a>
      <a data-nav="san-pham" href="#/san-pham">${I.box}<span>Sản phẩm</span></a>
      <a data-nav="bai-viet" href="#/bai-viet">${I.pen}<span>Bài viết</span></a>
      <a data-nav="anh" href="#/anh">${I.img}<span>Thư viện ảnh</span></a>
      <p class="sgrp">Thiết lập</p>
      <a data-nav="cau-hinh" href="#/cau-hinh">${I.gear}<span>Cấu hình web</span></a>
      <a data-nav="seo" href="#/seo">${I.globe}<span>SEO</span></a>
      <a data-nav="huong-dan" href="#/huong-dan">${I.help}<span>Hướng dẫn</span></a>
    </nav>
    <a class="sview" href="../" target="_blank" rel="noopener">${I.ext}<span>Mở web SONA</span></a>
  </aside>
  <div class="scrim" id="scrim" hidden></div>
  <div class="mainw">
    <header class="top">
      <button class="iconbtn only-m" id="menuBtn" aria-label="Mở menu" aria-controls="side" aria-expanded="false">${I.menu}</button>
      <nav class="crumbs" id="crumbs" aria-label="Vị trí"></nav>
      <div class="gsearch" id="gs" role="search"><span class="gi">${I.search}</span><input id="gq" type="search" autocomplete="off" placeholder="Tìm sản phẩm, bài viết, trang…" aria-label="Tìm trong quản trị"><div class="gres" id="gres" hidden></div></div>
      <button class="iconbtn only-s" id="gsBtn" aria-label="Tìm">${I.search}</button>
      <div class="user"><button class="ubtn" id="ubtn" aria-haspopup="menu" aria-expanded="false">${USER.avatar ? `<img src="${esc(USER.avatar)}" alt="" width="30" height="30">` : `<span class="av">${esc((USER.name || "?")[0])}</span>`}<span class="uname">${esc(USER.name)}</span></button>
        <div class="umenu" id="umenu" role="menu" hidden><div class="uinfo"><b>${esc(USER.name)}</b><small>${G.DEMO ? "Không đăng nhập" : "@" + esc(USER.login)} · ${esc(roleName)}</small></div>
        <a role="menuitem" href="../" target="_blank" rel="noopener">${I.ext} Mở web</a><button role="menuitem" id="logout">${I.logout} ${G.DEMO ? "Thoát dùng thử" : "Đăng xuất"}</button></div></div>
    </header>
    ${G.DEMO ? `<div class="banner demo">${I.eye}<span><b>Bản dùng thử.</b> Thay đổi chỉ nằm trên màn hình này, web thật không đổi.</span><button class="btn sm" id="bLogin">Đăng nhập để sửa thật</button></div>`
    : !CAN_WRITE ? `<div class="banner ro">${I.lock}<span>Tài khoản <b>@${esc(USER.login)}</b> chỉ có quyền xem. Muốn sửa, chủ kho cần cấp quyền Write trên GitHub.</span></div>` : ""}
    <main id="view" tabindex="-1"></main>
  </div></div>`;
  document.body.classList.toggle("readonly", !CAN_WRITE);
  $("#logout").onclick = logout; if ($("#bLogin")) $("#bLogin").onclick = logout;
  const side = $("#side"), scrim = $("#scrim");
  $("#menuBtn").onclick = () => { side.classList.add("open"); scrim.hidden = false; $("#menuBtn").setAttribute("aria-expanded", "true"); };
  scrim.onclick = closeSide;
  const ub = $("#ubtn"), um = $("#umenu");
  ub.onclick = e => { e.stopPropagation(); um.hidden = !um.hidden; ub.setAttribute("aria-expanded", String(!um.hidden)); };
  document.addEventListener("click", e => { if (!um.hidden && !e.target.closest(".user")) { um.hidden = true; ub.setAttribute("aria-expanded", "false"); } });
  bindGlobalSearch();
  refreshImages();
  for (const [k, f] of [["index.html", "../index.html"], ["app Lịch Đăng Spa", "../app/lds-1f8436bb/index.html"]])
    fetch(f, { cache: "no-cache" }).then(r => r.ok ? r.text() : "").then(t => { CODE[k] = t; }).catch(() => {});
  route();
}
function closeSide() { $("#side")?.classList.remove("open"); const s = $("#scrim"); if (s) s.hidden = true; $("#menuBtn")?.setAttribute("aria-expanded", "false"); }

async function refreshImages() {
  try { IMAGES = await G.listImages(); }
  catch (e) {
    // Không đọc được danh sách ảnh từ GitHub: dùng tạm các ảnh đang được dữ liệu web nhắc tới
    const found = new Set(); JSON.stringify(D).replace(/img\/[\w./-]+\.(?:jpe?g|png|webp)/gi, m => found.add(m));
    IMAGES = IMAGES || [...found].map(path => ({ path, size: 0, sha: "" }));
  }
  Object.keys(DEMO_BLOBS).forEach(p => { if (!IMAGES.some(x => x.path === p)) IMAGES.push({ path: p, size: Math.round(DEMO_BLOBS[p].length * 0.75), sha: "" }); });
  document.dispatchEvent(new Event("images"));
}

function bindGlobalSearch() {
  const q = $("#gq"), box = $("#gres");
  const items = () => [
    ...D.products.map(p => ({ t: p.ten || p.slug, s: "Sản phẩm", h: "#/san-pham/" + p.slug })),
    ...D.posts.map(a => ({ t: a.tieu_de || a.slug, s: "Bài viết" + (isDraft(a) ? " · nháp" : ""), h: "#/bai-viet/" + a.slug })),
    ...D.pages.map(a => ({ t: a.tieu_de || a.slug, s: "Trang", h: "#/trang/" + a.slug })),
  ];
  const draw = () => {
    const w = norm(q.value).split(/\s+/).filter(Boolean);
    if (!w.length) { box.hidden = true; return; }
    const r = items().filter(x => w.every(k => norm(x.t).includes(k))).slice(0, 8);
    box.innerHTML = r.length ? r.map(x => `<a href="${esc(x.h)}"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></a>`).join("") : `<p>Không thấy kết quả.</p>`;
    box.hidden = false;
  };
  q.oninput = draw; q.onfocus = draw;
  q.onkeydown = e => { if (e.key === "Enter") { const a = $("a", box); if (a) { location.hash = a.getAttribute("href"); q.value = ""; box.hidden = true; } } if (e.key === "Escape") { q.value = ""; box.hidden = true; } };
  box.onclick = () => { q.value = ""; box.hidden = true; $("#gs").classList.remove("open"); };
  document.addEventListener("click", e => { if (!e.target.closest("#gs") && !e.target.closest("#gsBtn")) { box.hidden = true; $("#gs")?.classList.remove("open"); } });
  $("#gsBtn").onclick = () => { $("#gs").classList.toggle("open"); q.focus(); };
}

/* ================= điều hướng ================= */
const ROUTES = [
  [/^\/?$/, viewDashboard], [/^\/trang-chu$/, viewHome], [/^\/trang$/, viewPages], [/^\/trang\/thong-tin$/, viewInfoPage],
  [/^\/trang\/(.+)$/, s => viewContent("pages", s)], [/^\/san-pham$/, viewProducts], [/^\/san-pham\/(.+)$/, viewProductForm],
  [/^\/bai-viet$/, viewPosts], [/^\/bai-viet\/(.+)$/, s => viewContent("posts", s)], [/^\/anh$/, viewImages],
  [/^\/cau-hinh$/, viewSettings], [/^\/seo$/, viewSeo], [/^\/huong-dan$/, viewGuide],
];
let lastHash = location.hash, skipGuard = false;
addEventListener("hashchange", async () => {
  if (!USER) return;
  if (skipGuard) { skipGuard = false; return; }
  if (DIRTY) {
    const target = location.hash; skipGuard = true; location.hash = lastHash;
    if (!await confirmBox("Có thay đổi chưa lưu. Rời trang này và bỏ thay đổi?", { yes: "Bỏ thay đổi", no: "Ở lại", danger: true })) return;
    DIRTY = false; location.hash = target; return;
  }
  route();
});
addEventListener("beforeunload", e => { if (DIRTY) { e.preventDefault(); e.returnValue = ""; } });
function go(hash) { DIRTY = false; if (location.hash === hash) route(); else location.hash = hash; }
function route() {
  lastHash = location.hash; DIRTY = false;
  $$(".modal").forEach(m => m.close?.());
  const path = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      $$(".snav a").forEach(a => a.classList.toggle("on", a.dataset.nav === (path.split("/")[1] || "")));
      closeSide(); fn(...m.slice(1)); $("#view").focus({ preventScroll: true }); scrollTo(0, 0); return;
    }
  }
  go("#/");
}
function crumbs(list) {
  $("#crumbs").innerHTML = [["Quản trị", "#/"], ...list].map(([t, h], i, a) => i < a.length - 1 && h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join(`<i>›</i>`);
  document.title = list[list.length - 1][0] + " · Quản trị SONA";
}
const head = (title, sub = "", actions = "") => `<div class="phead"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div>${actions ? `<div class="row">${actions}</div>` : ""}</div>`;
const view = html => { $("#view").innerHTML = html; };
function watchDirty(root) { root.addEventListener("input", () => { DIRTY = true; }); root.addEventListener("change", () => { DIRTY = true; }); }

async function doSave(btn, fn, okMsg = SAVED) {
  if (!CAN_WRITE) { toast("Tài khoản này chỉ có quyền xem, chưa lưu được.", "err"); return false; }
  const old = btn.innerHTML; $$(".act button").forEach(b => { b.disabled = true; });
  btn.innerHTML = `<span class="spin"></span> Đang lưu…`;
  try {
    await fn(); DIRTY = false;
    toast(G.DEMO ? "Bản dùng thử: đã lưu tạm trên màn hình, web thật không đổi." : okMsg);
    return true;
  } catch (e) {
    toast(e.message || "Lưu không được.", "err");
    if (e.status === 401) { clearSession(); setTimeout(() => location.reload(), 2500); }
    return false;
  } finally { if (btn.isConnected) btn.innerHTML = old; $$(".act button").forEach(b => { b.disabled = false; }); }
}

/* ================= xem trước ================= */
function preview(hash, patch) {
  const snap = structuredClone({ site: D.site, products: D.products, posts: D.posts, pages: D.pages });
  patch?.(snap);
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ t: Date.now(), ...snap })); }
  catch (e) { toast("Trình duyệt chặn lưu tạm nên chưa xem trước được.", "err"); return; }
  const url = "../index.html?preview=1" + hash;
  const m = modal(`<div class="pvbar"><b>Xem trước</b><div class="seg" role="group" aria-label="Khung xem"><button class="on" data-w="390">${I.phone} Điện thoại</button><button data-w="1200">${I.desk} Máy tính</button></div>
    <a class="btn ghost sm" href="${url}" target="_blank" rel="noopener">${I.ext} Mở tab mới</a><button class="iconbtn" data-close aria-label="Đóng">${I.x}</button></div>
    <div class="pvwrap"><iframe id="pvf" title="Xem trước trang web" src="${url}" style="width:390px"></iframe></div>
    <p class="hint center">Đây là bản xem trước trên máy anh chị, khách chưa thấy. Bấm Lưu hoặc Xuất bản để đưa lên web.</p>`, { wide: true });
  $$("[data-w]", m.el).forEach(b => b.onclick = () => { $$("[data-w]", m.el).forEach(x => x.classList.toggle("on", x === b)); $("#pvf", m.el).style.width = b.dataset.w === "1200" ? "100%" : "390px"; });
}

/* ================= chọn và tải ảnh ================= */
async function uploadFile(file, folder, { replace = null } = {}) {
  const forceExt = replace ? (replace.path.match(/\.(\w+)$/)[1].toLowerCase().replace("jpeg", "jpg")) : "";
  const img = await prepareImage(file, { forceExt });
  let path = replace?.path;
  if (!path) {
    const base = slugify(file.name.replace(/\.\w+$/, "")) || "anh";
    path = `${folder}/${base}.${img.ext}`;
    for (let n = 2; IMAGES?.some(x => x.path === path); n++) path = `${folder}/${base}-${n}.${img.ext}`;
  }
  if (G.DEMO) DEMO_BLOBS[path] = `data:image/${img.ext === "jpg" ? "jpeg" : img.ext};base64,${img.base64}`;
  const r = await G.putBinary(path, img.base64, (replace ? "Thay ảnh: " : "Tải ảnh: ") + path, replace?.sha || undefined);
  const rec = { path, size: img.bytes, sha: r?.content?.sha || "" };
  IMAGES = (IMAGES || []).filter(x => x.path !== path).concat(rec);
  return { ...rec, resized: img.resized, width: img.width, height: img.height };
}
const thumb = p => `<img src="${esc(G.DEMO && DEMO_BLOBS[p] ? DEMO_BLOBS[p] : "../" + p)}" data-raw="${esc(p)}" alt="" loading="lazy">`;
function pickImage(folder = "img/anh") {
  return new Promise(res => {
    let chosen = null;
    const m = modal(`<div class="dhead"><h2>Chọn ảnh</h2><button class="iconbtn" data-close aria-label="Đóng">${I.x}</button></div>
      <div class="row"><label class="btn sm">${I.upload} Tải ảnh mới<input type="file" accept="${ACCEPT}" hidden id="pkUp"></label><input type="search" id="pkQ" placeholder="Tìm theo tên file…" aria-label="Tìm ảnh" class="grow"></div>
      <p class="hint">JPG, PNG hoặc WEBP. Ảnh lớn hơn 1600 điểm ảnh hoặc nặng hơn 1,5 MB sẽ tự thu nhỏ.</p>
      <div class="pkgrid" id="pkG">${loading()}</div>`, { wide: true, onClose: () => res(chosen) });
    const draw = () => {
      const w = norm($("#pkQ", m.el).value);
      const list = (IMAGES || []).filter(x => /\.(jpe?g|png|webp)$/i.test(x.path) && norm(x.path).includes(w)).sort((a, b) => a.path.localeCompare(b.path));
      $("#pkG", m.el).innerHTML = list.length ? list.map(x => `<button type="button" class="pk" data-p="${esc(x.path)}">${thumb(x.path)}<span>${esc(x.path.split("/").pop())}</span></button>`).join("") : empty("Chưa có ảnh nào", "Bấm Tải ảnh mới để thêm.");
      $$(".pk", m.el).forEach(b => b.onclick = () => { chosen = b.dataset.p; m.close(); });
    };
    if (IMAGES) draw(); else document.addEventListener("images", draw, { once: true });
    $("#pkQ", m.el).oninput = draw;
    $("#pkUp", m.el).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!CAN_WRITE) { toast("Tài khoản này chỉ có quyền xem.", "err"); return; }
      $("#pkG", m.el).innerHTML = loading("Đang tải ảnh lên…");
      try { const r = await uploadFile(f, folder); toast(r.resized ? `Đã tải ảnh (tự thu nhỏ còn ${fmtSize(r.size)}).` : "Đã tải ảnh lên."); chosen = r.path; m.close(); }
      catch (ex) { toast(ex.message, "err"); draw(); }
    };
  });
}
function bindImageFields(root, folder) {
  root.addEventListener("click", async e => {
    const pick = e.target.closest("[data-pick]"), un = e.target.closest("[data-unpick]");
    if (!pick && !un) return;
    const name = (pick || un).dataset.pick || un.dataset.unpick;
    const p = pick ? await pickImage(folder) : "";
    if (pick && !p) return;
    const fld = $(`.fld[data-f="${CSS.escape(name)}"]`, root);
    fld.outerHTML = imageField(name, $("label", fld).textContent, p, $(".hint", fld)?.innerHTML || "");
    DIRTY = true; root.dispatchEvent(new Event("input"));
  });
}

/* ================= tổng quan ================= */
function viewDashboard() {
  crumbs([["Tổng quan"]]);
  const pub = D.posts.filter(a => !isDraft(a)), hid = D.products.filter(isHidden);
  const issues = kiemTra(D, imageSet()).sort((a, b) => b.loi - a.loi);
  const link = i => i.file === "products" ? "#/san-pham/" + i.slug : i.file === "posts" ? "#/bai-viet/" + i.slug : i.file === "pages" ? "#/trang/" + i.slug
    : /^seo/.test(i.truong) ? "#/seo" : /^trang_chu|^khau_hieu|^slogan/.test(i.truong) ? "#/trang-chu" : "#/cau-hinh";
  const stat = (t, n, sub, h, ic) => `<a class="stat" href="${h}"><span class="sic">${ic}</span><span><small>${t}</small><b>${n}</b><em>${sub}</em></span></a>`;
  const imgStat = () => IMAGES ? [IMAGES.length, fmtSize(IMAGES.reduce((s, x) => s + x.size, 0)) + " tổng"] : ["…", "đang đếm"];
  const [ni, si] = imgStat();
  view(`${head("Tổng quan", `Xin chào ${esc(USER.name)}. Số liệu dưới đây đọc trực tiếp từ dữ liệu web.`)}
  <div class="stats">
    ${stat("Sản phẩm", D.products.length, hid.length ? hid.length + " đang ẩn" : "tất cả đang hiện", "#/san-pham", I.box)}
    ${stat("Bài viết", pub.length, (D.posts.length - pub.length) + " bản nháp", "#/bai-viet", I.pen)}
    ${stat("Trang riêng", D.pages.length, D.pages.filter(isDraft).length + " bản nháp", "#/trang", I.page)}
    <a class="stat" href="#/anh" id="imgStat"><span class="sic">${I.img}</span><span><small>Ảnh</small><b>${ni}</b><em>${si}</em></span></a>
  </div>
  <div class="cols">
    <section class="panel"><h2>Cần xử lý ${issues.length ? chip(issues.length, issues.some(i => i.loi) ? "err" : "warn") : ""}</h2>
      ${issues.length ? `<ul class="issues">${issues.slice(0, 8).map(i => `<li class="${i.loi ? "err" : "warn"}">${i.loi ? I.warn : I.clock}<a href="${link(i)}"><b>${esc(i.ten || "Cấu hình web")}</b><span>${esc(i.msg)}</span></a></li>`).join("")}</ul>${issues.length > 8 ? `<p class="hint">Còn ${issues.length - 8} mục khác, xem trong từng mục.</p>` : ""}`
      : `<p class="okline">${I.check} Không có lỗi hay cảnh báo nào trong dữ liệu web.</p>`}
    </section>
    <section class="panel"><h2>Thao tác nhanh</h2><div class="quick">
      <a href="#/san-pham/moi">${I.plus} Thêm sản phẩm</a><a href="#/bai-viet/moi">${I.pen} Viết bài mới</a><a href="#/trang-chu">${I.home} Sửa trang chủ</a>
      <a href="#/anh">${I.upload} Tải ảnh lên</a><a href="#/cau-hinh">${I.gear} Đổi thông tin liên hệ</a><a href="../" target="_blank" rel="noopener">${I.ext} Mở web</a></div></section>
  </div>
  <div class="cols">
    <section class="panel"><h2>Cập nhật gần đây</h2><div id="commits">${loading()}</div></section>
    <section class="panel"><h2>Tình trạng xuất bản</h2><div id="pub">${loading()}</div></section>
  </div>`);
  document.addEventListener("images", () => { const s = $("#imgStat"); if (s) { const [a, b] = imgStat(); $("b", s).textContent = a; $("em", s).textContent = b; } }, { once: true });
  G.recentCommits().then(list => {
    const el = $("#commits"); if (!el) return;
    el.innerHTML = list.length ? `<ul class="feed">${list.map(c => `<li><a href="${esc(c.html_url)}" target="_blank" rel="noopener"><b>${esc(c.commit.message.split("\n")[0])}</b><small>${esc(c.author?.login || c.commit.author?.name || "")} · ${ago(c.commit.author?.date)}</small></a></li>`).join("")}</ul>` : `<p class="muted">Chưa có cập nhật.</p>`;
  }).catch(e => { const el = $("#commits"); if (el) el.innerHTML = `<p class="muted">Chưa đọc được lịch sử cập nhật: ${esc(e.message)}</p>`; });
  Promise.allSettled([G.pagesBuild(), G.lastRun()]).then(([b, r]) => {
    const el = $("#pub"); if (!el) return; const rows = [];
    if (b.status === "fulfilled") {
      const s = b.value.status, map = { built: ["ok", "Web đã đăng bản mới nhất"], building: ["warn", "Web đang đăng bản mới"], errored: ["err", "Lần đăng web gần nhất bị lỗi"] };
      const [k, t] = map[s] || ["warn", "Trạng thái: " + s];
      rows.push(`<li class="${k}">${k === "ok" ? I.check : I.clock}<span><b>${t}</b><small>GitHub Pages · ${ago(b.value.updated_at || b.value.created_at)}</small></span></li>`);
    }
    if (r.status === "fulfilled" && r.value.workflow_runs?.[0]) {
      const w = r.value.workflow_runs[0], k = w.status !== "completed" ? "warn" : w.conclusion === "success" ? "ok" : "err";
      const t = w.status !== "completed" ? "Đang kiểm tra dữ liệu và tạo trang SEO" : w.conclusion === "success" ? "Kiểm tra dữ liệu: đạt" : "Kiểm tra dữ liệu: có lỗi, bấm để xem";
      rows.push(`<li class="${k}">${k === "ok" ? I.check : k === "err" ? I.warn : I.clock}<a href="${esc(w.html_url)}" target="_blank" rel="noopener"><b>${t}</b><small>${esc(w.name)} · ${ago(w.updated_at)}</small></a></li>`);
    }
    el.innerHTML = rows.length ? `<ul class="issues">${rows.join("")}</ul>` : `<p class="muted">Chưa xem được trạng thái đăng web. Muốn xem ở đây, thêm quyền <b>Pages</b> và <b>Actions</b> (Read-only) cho mã truy cập. Việc này không ảnh hưởng đến sửa web.</p>`;
  });
}

/* ================= các form cấu hình (site.json) ================= */
function setPath(o, p, v) {
  const ks = p.split("."), last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}), o);
  if (v === "" || v === undefined || v === false || (Array.isArray(v) && !v.length)) delete t[last]; else t[last] = v;
}
function applySiteForm(site, root) {
  const fd = formData(root);
  for (const [k, v] of Object.entries(fd)) {
    if (k.startsWith("!")) setPath(site, k.slice(1), !v);
    else if (k.endsWith("[]")) setPath(site, k.slice(0, -2), v.split("\n").map(s => s.trim()).filter(Boolean));
    else setPath(site, k, v);
  }
  if (site.thanh_toan) {
    if (site.thanh_toan.so_tai_khoan) site.thanh_toan.so_tai_khoan = site.thanh_toan.so_tai_khoan.replace(/\s/g, "");
    if (site.thanh_toan.ten_tai_khoan) site.thanh_toan.ten_tai_khoan = site.thanh_toan.ten_tai_khoan.toUpperCase();
  }
  ["trang_chu", "thong_tin", "seo", "mang_xa_hoi"].forEach(k => { if (site[k] && !Object.keys(site[k]).length) delete site[k]; });
  return site;
}
function siteEditor({ title, sub, cr, sections, pv = "", message, after }) {
  crumbs(cr);
  view(`${head(title, sub)}<form class="stack" id="sf" novalidate>${sections.map(s => `<section class="panel"><h2>${s.t}</h2>${s.d ? `<p class="muted">${s.d}</p>` : ""}<div class="fgrid">${s.h}</div></section>`).join("")}
    <div class="act sticky">${pv !== null ? `<button type="button" class="btn ghost" id="pv">${I.eye} Xem trước</button>` : ""}<button type="submit" class="btn" id="sv">Lưu thay đổi</button></div></form>`);
  const root = $("#sf"); watchDirty(root); bindCounters(root); bindImageFields(root, "img/anh"); after?.(root);
  const errs = () => { const s = applySiteForm(structuredClone(D.site), root); const iss = checkSite(s, imageSet()).filter(i => i.loi); showErrors(root, iss); return iss; };
  if ($("#pv")) $("#pv").onclick = () => preview(pv, snap => applySiteForm(snap.site, root));
  root.onsubmit = async e => {
    e.preventDefault();
    if (errs().length) return toast("Còn chỗ cần sửa, xem chữ đỏ bên dưới.", "err");
    if (await doSave($("#sv"), () => G.commit("site", s => applySiteForm(s, root), message))) route();
  };
}
const ph = t => esc(t);

function viewHome() {
  const s = D.site, tc = s.trang_chu || {};
  siteEditor({
    title: "Trang chủ", sub: "Sửa phần đầu trang chủ và các khối đang có. Để trống ô nào thì web giữ chữ mặc định.", cr: [["Trang chủ"]], pv: "#", message: "Sửa trang chủ",
    sections: [
      { t: "Khu đầu trang", h: field("slogan", "Dòng nhỏ trên cùng", s.slogan, { ph: "Công nghệ tiện ích cho mọi người" })
        + field("khau_hieu", "Tiêu đề lớn", s.khau_hieu, { ph: "Công cụ AI đơn giản cho người kinh doanh bận rộn", hint: "Chữ <b>AI</b> trong tiêu đề tự tô màu vàng." })
        + field("trang_chu.mo_ta", "Mô tả dưới tiêu đề (không bắt buộc)", tc.mo_ta, { area: true, rows: 2 })
        + imageField("trang_chu.anh_banner", "Ảnh banner (không bắt buộc)", tc.anh_banner, "Ảnh ngang tỉ lệ khoảng 16:7, hiện phía trên tiêu đề.") },
      { t: "Nút kêu gọi hành động", d: "Nút vàng dưới ô tìm kiếm. Điền đủ hai ô thì nút mới hiện.", h: field("trang_chu.nut_chu", "Chữ trên nút", tc.nut_chu, { ph: "Nhắn Zalo tư vấn" })
        + field("trang_chu.nut_link", "Nút dẫn tới", tc.nut_link, { ph: "#hoc", hint: "Trang trong web: <b>#hoc</b>, <b>#thong-tin</b>, <b>#sp/duong-dan-san-pham</b>. Trang ngoài: bắt đầu bằng <b>https://</b>" }) },
      { t: "Ô tìm kiếm", h: toggle("!trang_chu.an_o_tim", "Hiện ô tìm kiếm", !tc.an_o_tim) + field("trang_chu.o_tim", "Chữ gợi ý trong ô", tc.o_tim, { ph: "Anh chị đang cần gì?" }) },
      { t: "Khối gợi ý sản phẩm", d: `Thứ tự, ẩn hay hiện từng sản phẩm sửa ở mục <a href="#/san-pham">Sản phẩm</a>.`, h: field("trang_chu.tieu_de_goi_y", "Tiêu đề khối", tc.tieu_de_goi_y, { ph: "Gợi ý cho anh chị" })
        + toggle("!trang_chu.an_loc_loai", "Hiện bộ lọc loại sản phẩm (Tài liệu, App, Dịch vụ)", !tc.an_loc_loai) },
    ],
  });
}
function viewInfoPage() {
  const t = D.site.thong_tin || {};
  siteEditor({
    title: "Thông tin SONA", sub: "Trang hệ thống, không xóa được. Thông tin liên hệ và tài khoản nhận tiền sửa ở Cấu hình web.", cr: [["Trang", "#/trang"], ["Thông tin SONA"]], pv: "#thong-tin", message: "Sửa trang Thông tin",
    sections: [
      { t: "SONA làm gì", h: field("thong_tin.lam_gi", "Đoạn giới thiệu", t.lam_gi, { area: true, rows: 4, ph: "SONA làm công cụ AI đơn giản cho người kinh doanh nhỏ ở Việt Nam…" }) },
      { t: "Mua như thế nào", d: "Các bước này hiện ở trang Thông tin và ở mọi trang sản phẩm.", h: field("thong_tin.cach_mua[]", "Mỗi dòng một bước", (t.cach_mua || []).join("\n"), { area: true, rows: 4, ph: "Chọn sản phẩm, bấm Sử dụng ngay, quét mã QR bằng app ngân hàng.\nNhắn Zalo SONA mã đơn hiện trên màn hình.\nSONA gửi sản phẩm qua Zalo trong giờ làm việc 8h–20h." }) },
    ],
  });
}
function viewSettings() {
  const s = D.site, m = s.mang_xa_hoi || {}, t = s.thanh_toan || {};
  siteEditor({
    title: "Cấu hình web", sub: "Tên, logo, liên hệ, mạng xã hội, chân trang và tài khoản nhận tiền.", cr: [["Cấu hình web"]], pv: "#thong-tin", message: "Sửa cấu hình web",
    sections: [
      { t: "Thương hiệu", h: field("ten_web", "Tên web", s.ten_web, { req: true }) + imageField("logo", "Logo (ảnh vuông)", s.logo, "Hiện ở góc trên và trang Thông tin. Nên dùng ảnh PNG vuông 192×192.") + imageField("favicon", "Biểu tượng tab trình duyệt (favicon)", s.favicon, "Ảnh PNG vuông nhỏ, 48×48 đến 192×192.") },
      { t: "Liên hệ", d: "Web chưa có biểu mẫu liên hệ. Khách liên hệ qua Zalo, hotline, email dưới đây; các nút này hiện ở đầu trang, chân trang và trang Thông tin.", h:
        field("zalo", "Số Zalo", s.zalo, { inputmode: "tel" }) + field("hotline", "Hotline", s.hotline, { inputmode: "tel" }) + field("email", "Email", s.email, { type: "email" }) + field("dia_chi", "Địa chỉ (không bắt buộc)", s.dia_chi) },
      { t: "Mạng xã hội", h: field("mang_xa_hoi.facebook", "Facebook", m.facebook, { ph: "https://facebook.com/…" }) + field("mang_xa_hoi.tiktok", "TikTok", m.tiktok, { ph: "https://tiktok.com/@…" }) + field("mang_xa_hoi.youtube", "YouTube", m.youtube, { ph: "https://youtube.com/@…" }) },
      { t: "Chân trang", h: field("chan_trang", "Dòng chữ cuối trang", s.chan_trang, { ph: ph("© " + (s.ten_web || "SONA") + " · " + (s.slogan || "") + (s.email ? " · " + s.email : "")), hint: "Để trống thì web tự ghi tên, khẩu hiệu và email." }) },
      { t: "Tài khoản nhận tiền (mã QR)", d: `<span class="warnline">${I.warn} Chỉ ghi thông tin NHẬN tiền công khai. Không bao giờ ghi mật khẩu hay mã OTP.</span>`, h:
        field("thanh_toan.ten_ngan_hang", "Tên ngân hàng", t.ten_ngan_hang) + field("thanh_toan.ngan_hang", "Mã ngân hàng (6 số)", t.ngan_hang, { inputmode: "numeric", hint: "VietinBank 970415 · Vietcombank 970436 · MB 970422 · Techcombank 970407 · BIDV 970418 · ACB 970416 · Agribank 970405" })
        + field("thanh_toan.so_tai_khoan", "Số tài khoản", t.so_tai_khoan, { inputmode: "numeric" }) + field("thanh_toan.ten_tai_khoan", "Tên chủ tài khoản (không dấu)", t.ten_tai_khoan) },
    ],
  });
}
function viewSeo() {
  const s = D.site, seo = s.seo || {};
  const issues = kiemTra(D, imageSet()).filter(i => /seo|tom_tat|phu_de|slug/.test(i.truong) && i.file !== "site");
  const link = i => (i.file === "products" ? "#/san-pham/" : i.file === "posts" ? "#/bai-viet/" : "#/trang/") + i.slug;
  siteEditor({
    title: "SEO", sub: "Cách web hiện trên Google và khi chia sẻ link lên Facebook, Zalo.", cr: [["SEO"]], pv: null, message: "Sửa SEO mặc định",
    sections: [
      { t: "Mặc định cho trang chủ", h: field("seo.tieu_de", "Tiêu đề trên Google", seo.tieu_de, { count: SEO_TITLE_MAX, ph: (s.ten_web || "SONA") + " · " + (s.khau_hieu || "") })
        + field("seo.mo_ta", "Mô tả trên Google", seo.mo_ta, { area: true, rows: 3, count: SEO_DESC_MAX, ph: "Công cụ AI đơn giản cho người kinh doanh bận rộn: tài liệu, app và dịch vụ dùng được ngay." })
        + imageField("seo.anh", "Ảnh khi chia sẻ link", seo.anh, "Ảnh ngang 1200×630. Để trống thì dùng logo SONA.")
        + field("seo.dia_chi_web", "Địa chỉ web chính thức", seo.dia_chi_web, { ph: "https://" + G.REPO.owner.toLowerCase() + ".github.io/" + G.REPO.repo + "/", hint: "Khi gắn tên miền riêng, đổi thành <b>https://tenmien.vn/</b> (có dấu / ở cuối)." })
        + `<div class="snip" id="snip"></div>` },
      { t: "Kiểm tra SEO toàn web", h: issues.length ? `<ul class="issues">${issues.map(i => `<li class="${i.loi ? "err" : "warn"}">${I.warn}<a href="${link(i)}"><b>${esc(i.ten)}</b><span>${esc(i.msg)}</span></a></li>`).join("")}</ul>` : `<p class="okline">${I.check} Mọi sản phẩm, bài viết, trang đều có tiêu đề và mô tả hợp lệ.</p>` },
      { t: "Sơ đồ trang và robots.txt", h: `<p class="muted">Mỗi lần dữ liệu thay đổi, GitHub tự tạo trang riêng cho từng sản phẩm, bài viết, trang (để Google và Facebook đọc đúng tiêu đề, ảnh) cùng <a href="../sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a> và <a href="../robots.txt" target="_blank" rel="noopener">robots.txt</a>. Anh chị không cần làm gì thêm.</p>
        <p class="hint">Link chia sẻ đẹp cho sản phẩm có dạng <code>…/sp/duong-dan/</code>, cho bài viết <code>…/bai/duong-dan/</code>. Link cũ dạng <code>#sp/…</code> vẫn mở được.</p>` },
    ],
    after: root => {
      const draw = () => {
        const f = formData(root), base = f["seo.dia_chi_web"] || `https://${G.REPO.owner.toLowerCase()}.github.io/${G.REPO.repo}/`;
        const t = f["seo.tieu_de"] || (s.ten_web || "SONA") + (s.khau_hieu ? " · " + s.khau_hieu : ""), d = f["seo.mo_ta"] || "Công cụ AI đơn giản cho người kinh doanh bận rộn: tài liệu, app và dịch vụ dùng được ngay.";
        const im = f["seo.anh"] || "img/logo-full.jpg";
        $("#snip", root).innerHTML = `<p class="hint">Xem thử trên Google</p><div class="gsnip"><small>${esc(base)}</small><b>${esc(t.slice(0, SEO_TITLE_MAX))}</b><span>${esc(d.slice(0, SEO_DESC_MAX))}</span></div>
          <p class="hint">Xem thử khi chia sẻ lên Facebook, Zalo</p><div class="share"><img src="${esc(DEMO_BLOBS[im] || "../" + im)}" data-raw="${esc(im)}" alt=""><div><small>${esc(base.replace(/^https:\/\//, "").split("/")[0].toUpperCase())}</small><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`;
      };
      root.addEventListener("input", draw); draw();
    },
  });
}

/* ================= trang ================= */
function viewPages() {
  crumbs([["Trang"]]);
  const sys = [["Trang chủ", "Khu đầu trang, nút, ô tìm kiếm, khối gợi ý", "#/trang-chu", "Sửa"], ["Sản phẩm", "Danh sách và trang chi tiết sản phẩm", "#/san-pham", "Quản lý"],
    ["Học AI", "Thư mục và bài học", "#/bai-viet", "Quản lý"], ["Thông tin SONA", "Giới thiệu, cách mua, liên hệ", "#/trang/thong-tin", "Sửa"]];
  view(`${head("Trang", "Trang hệ thống của web và các trang riêng anh chị tự tạo (giới thiệu, chính sách, hướng dẫn…).", `<a class="btn" href="#/trang/moi">${I.plus} Tạo trang mới</a>`)}
  <section class="panel"><h2>Trang hệ thống</h2><div class="rows">${sys.map(([t, d, h, a]) => `<a class="rowi" href="${h}"><span class="ri">${I.lock}</span><span class="rt"><b>${t}</b><small>${d}</small></span>${chip("Hệ thống")}<span class="rgo">${a} ›</span></a>`).join("")}</div></section>
  <section class="panel"><h2>Trang riêng</h2>${D.pages.length ? `<div class="rows">${D.pages.map(p => `<a class="rowi" href="#/trang/${esc(p.slug)}"><span class="ri">${I.page}</span><span class="rt"><b>${esc(p.tieu_de || "(chưa có tiêu đề)")}</b><small>/trang/${esc(p.slug)}/${p.cap_nhat ? " · sửa " + fmtDate(p.cap_nhat) : ""}</small></span>${isDraft(p) ? chip("Nháp", "warn") : chip("Đã xuất bản", "ok")}<span class="rgo">Sửa ›</span></a>`).join("")}</div>`
    : empty("Chưa có trang riêng nào", "Ví dụ: Chính sách đổi trả, Hướng dẫn thanh toán, Giới thiệu đội ngũ.", `<a class="btn ghost" href="#/trang/moi">${I.plus} Tạo trang đầu tiên</a>`)}</section>`);
}

/* ================= bài viết & trang riêng (cùng một trình soạn) ================= */
const KIND = {
  posts: { one: "bài viết", list: "#/bai-viet", crumb: "Bài viết", path: "bai", hash: s => "#bai/" + s, check: checkPost, folder: "img/anh" },
  pages: { one: "trang", list: "#/trang", crumb: "Trang", path: "trang", hash: s => "#trang/" + s, check: checkPage, folder: "img/anh" },
};
function viewContent(key, slug) {
  const K = KIND[key], isNew = slug === "moi";
  const orig = isNew ? null : D[key].find(x => x.slug === slug);
  if (!isNew && !orig) { crumbs([[K.crumb, K.list], ["Không tìm thấy"]]); view(empty(`Không tìm thấy ${K.one} này`, "Có thể đã bị xóa hoặc đổi đường dẫn.", `<a class="btn ghost" href="${K.list}">‹ Về danh sách</a>`)); return; }
  const a = isNew ? (key === "posts" ? { slug: "", tieu_de: "", tom_tat: "", chu_de: "Bắt đầu", ngay: today(), phut: 3, viec: "", noi_dung: "", trang_thai: "nhap" } : { slug: "", tieu_de: "", noi_dung: "", trang_thai: "nhap" }) : structuredClone(orig);
  const draft = isDraft(a);
  crumbs([[K.crumb, K.list], [isNew ? (key === "posts" ? "Bài mới" : "Trang mới") : a.tieu_de || a.slug]]);
  const topics = [...new Set(["Bắt đầu", "Viết nội dung", "Chăm khách", "Bán hàng", "Quản lý tiệm", ...D.posts.map(x => x.chu_de).filter(Boolean)])];
  const mainF = key === "posts"
    ? field("tieu_de", "Tiêu đề", a.tieu_de, { req: true }) + `<div class="fgrid two">${field("chu_de", "Thư mục", a.chu_de, { list: "topics" })}<datalist id="topics">${topics.map(t => `<option value="${esc(t)}">`).join("")}</datalist>${field("ngay", "Ngày đăng", a.ngay, { type: "date", req: true })}</div>`
      + field("tom_tat", "Tóm tắt (hiện ở danh sách bài)", a.tom_tat, { area: true, rows: 2 }) + field("viec", "Làm ngay 1 việc (khung vàng đầu bài)", a.viec)
      + mdEditor("noi_dung", "Nội dung", a.noi_dung) + imageField("anh", "Ảnh đại diện (không bắt buộc)", a.anh, "Ảnh ngang 16:10, hiện đầu bài và khi chia sẻ link.")
      + `<div class="fgrid two">${field("phut", "Số phút đọc", a.phut || 3, { type: "number", min: 1 })}${field("sp", "Gợi ý sản phẩm cuối bài", a.sp || "", { options: [["", "Không gợi ý"], ...D.products.map(p => [p.slug, p.ten])] })}</div>`
    : field("tieu_de", "Tiêu đề trang", a.tieu_de, { req: true }) + mdEditor("noi_dung", "Nội dung", a.noi_dung) + imageField("anh", "Ảnh đầu trang (không bắt buộc)", a.anh);
  view(`<form id="cf" class="edit" novalidate>
    <div class="phead"><div><h1>${esc(isNew ? (key === "posts" ? "Viết bài mới" : "Tạo trang mới") : a.tieu_de)}</h1><p class="muted">${draft ? chip("Bản nháp", "warn") + " Khách chưa thấy." : chip("Đã xuất bản", "ok") + ` <a href="../${K.hash(a.slug)}" target="_blank" rel="noopener">Xem trên web ↗</a>`}</p></div></div>
    <div class="ecols"><div class="emain stack"><section class="panel fgrid">${mainF}</section></div>
    <aside class="eside stack">
      <section class="panel"><h2>Xuất bản</h2><div class="act col">
        <button type="button" class="btn" id="pub">${draft ? "Xuất bản" : "Cập nhật"}</button>
        <button type="button" class="btn ghost" id="pv">${I.eye} Xem trước</button>
        <button type="button" class="btn ghost" id="dr">${draft ? "Lưu nháp" : "Chuyển về nháp"}</button></div>
        <p class="hint">${draft ? "Lưu nháp để viết tiếp sau. Xuất bản thì khách mới thấy." : "Chuyển về nháp sẽ gỡ khỏi web nhưng không xóa."}</p></section>
      <section class="panel"><h2>Đường dẫn</h2>${field("slug", "Đường dẫn", a.slug, { ph: "tu-dong-theo-tieu-de", hint: `Link: <code id="slugUrl"></code>` })}
        ${key === "pages" ? toggle("hien_chan_trang", "Hiện link ở chân trang web", !!a.hien_chan_trang) : ""}</section>
      <section class="panel"><h2>SEO</h2>${field("seo_tieu_de", "Tiêu đề trên Google", a.seo_tieu_de, { count: SEO_TITLE_MAX, ph: a.tieu_de || "Để trống thì dùng tiêu đề" })}
        ${field("seo_mo_ta", "Mô tả trên Google", a.seo_mo_ta, { area: true, rows: 3, count: SEO_DESC_MAX, ph: key === "posts" ? "Để trống thì dùng tóm tắt" : "Mô tả ngắn nội dung trang" })}</section>
      ${isNew ? "" : `<section class="panel"><button type="button" class="btn danger wide" id="del">${I.trash} Xóa ${K.one}</button></section>`}
    </aside></div></form>`);
  const root = $("#cf"); watchDirty(root); bindCounters(root); bindMd(root); bindImageFields(root, K.folder);
  let slugTouched = !isNew && !!a.slug;
  const slugUrl = () => { $("#slugUrl").textContent = `…/${K.path}/${$("#f_slug").value || slugify($("#f_tieu_de").value) || "duong-dan"}/`; };
  $("#f_slug").addEventListener("input", () => { slugTouched = true; slugUrl(); });
  $("#f_tieu_de").addEventListener("input", () => { if (!slugTouched) $("#f_slug").value = slugify($("#f_tieu_de").value); slugUrl(); });
  slugUrl();
  const collect = status => {
    const f = formData(root), x = structuredClone(a);
    x.tieu_de = f.tieu_de; x.slug = slugify(f.slug || f.tieu_de); x.noi_dung = $("#f_noi_dung").value.trim();
    for (const k of ["anh", "seo_tieu_de", "seo_mo_ta"]) { if (f[k]) x[k] = f[k]; else delete x[k]; }
    if (key === "posts") {
      Object.assign(x, { chu_de: f.chu_de, ngay: f.ngay, tom_tat: f.tom_tat, viec: f.viec, phut: Math.max(1, +f.phut || 3) });
      if (f.sp) x.sp = f.sp; else delete x.sp;
    } else { if (f.hien_chan_trang) x.hien_chan_trang = true; else delete x.hien_chan_trang; x.cap_nhat = today(); }
    x.trang_thai = status;
    return x;
  };
  const valid = x => { const list = D[key].filter(y => y.slug !== a.slug || isNew).concat(x); const iss = K.check(x, { ...D, [key]: list }, imageSet()).filter(i => i.loi); showErrors(root, iss); if (iss.length) toast(`Còn ${iss.length} chỗ cần sửa, xem chữ đỏ.`, "err"); return !iss.length; };
  const save = async (btn, status) => {
    const x = collect(status); if (!valid(x)) return;
    if (!isNew && x.slug !== a.slug && !isDraft(a) && !await confirmBox(`Đổi đường dẫn thì link cũ đã chia sẻ (…/${a.slug}) sẽ không mở được nữa. Vẫn đổi?`, { yes: "Đổi đường dẫn" })) return;
    const verb = status === "nhap" ? (isDraft(a) || isNew ? "Lưu nháp" : "Gỡ về nháp") : isNew || isDraft(a) ? "Xuất bản" : "Sửa";
    const ok = await doSave(btn, () => G.commit(key, upsert(orig, x), `${verb} ${K.one}: ${x.tieu_de}`), status === "nhap" ? "Đã lưu nháp. Khách chưa thấy nội dung này." : SAVED);
    if (ok) go(`${K.list}/${x.slug}`);
  };
  $("#pub").onclick = () => save($("#pub"), "xuat_ban");
  $("#dr").onclick = () => save($("#dr"), "nhap");
  $("#pv").onclick = () => { const x = collect("xuat_ban"); x.slug = x.slug || "xem-truoc"; preview(K.hash(x.slug), snap => { snap[key] = snap[key].filter(y => y.slug !== a.slug).concat(x); }); };
  if ($("#del")) $("#del").onclick = async () => {
    if (!await confirmBox(`Xóa hẳn ${K.one} "${a.tieu_de}"? Không khôi phục được trong Admin (vẫn còn trong lịch sử GitHub).`, { yes: "Xóa", danger: true, title: "Xóa " + K.one })) return;
    if (await doSave($("#del"), () => G.commit(key, removeBy(orig), `Xóa ${K.one}: ${a.tieu_de}`), `Đã xóa ${K.one}.`)) go(K.list);
  };
  if (!CAN_WRITE) $$("#pub,#dr,#del").forEach(b => { b.disabled = true; });
}

function viewPosts() {
  crumbs([["Bài viết"]]);
  const st = { q: "", f: "", c: "", n: 20 };
  const topics = [...new Set(D.posts.map(a => a.chu_de).filter(Boolean))];
  view(`${head("Bài viết", `${D.posts.length} bài. Bài học tự động hằng ngày cũng hiện ở đây.`, `<a class="btn" href="#/bai-viet/moi">${I.plus} Viết bài mới</a>`)}
    <div class="toolbar"><input type="search" id="pq" placeholder="Tìm tiêu đề, nội dung…" aria-label="Tìm bài viết" class="grow">
      <select id="pf" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="pub">Đã xuất bản</option><option value="nhap">Bản nháp</option></select>
      <select id="pc" aria-label="Thư mục"><option value="">Mọi thư mục</option>${topics.map(t => `<option>${esc(t)}</option>`).join("")}</select></div>
    <section class="panel flush" id="pl"></section>`);
  const draw = () => {
    const w = norm(st.q).split(/\s+/).filter(Boolean);
    const list = D.posts.filter(a => (!st.f || (st.f === "nhap") === isDraft(a)) && (!st.c || a.chu_de === st.c) && w.every(k => norm([a.tieu_de, a.tom_tat, a.noi_dung].join(" ")).includes(k)))
      .sort((x, y) => String(y.ngay).localeCompare(String(x.ngay)));
    $("#pl").innerHTML = list.length ? `<div class="rows">${list.slice(0, st.n).map(a => `<a class="rowi" href="#/bai-viet/${esc(a.slug)}"><span class="rt"><b>${esc(a.tieu_de || "(chưa có tiêu đề)")}</b><small>${esc(a.chu_de || "")} · ${fmtDate(a.ngay)}</small></span>${isDraft(a) ? chip("Nháp", "warn") : chip("Đã xuất bản", "ok")}<span class="rgo">›</span></a>`).join("")}</div>
      ${list.length > st.n ? `<div class="more"><button class="btn ghost" id="more">Xem thêm ${Math.min(20, list.length - st.n)} bài</button></div>` : ""}` : empty("Không có bài phù hợp", w.length ? "Thử từ khóa khác." : "");
    if ($("#more")) $("#more").onclick = () => { st.n += 20; draw(); };
  };
  $("#pq").oninput = e => { st.q = e.target.value; st.n = 20; draw(); };
  $("#pf").onchange = e => { st.f = e.target.value; draw(); };
  $("#pc").onchange = e => { st.c = e.target.value; draw(); };
  draw();
}

/* ================= sản phẩm ================= */
const catOf = p => /app/i.test(p.loai || "") ? "App" : /dịch vụ|dich vu/i.test(p.loai || "") ? "Dịch vụ" : "Tài liệu";
const priceOf = p => p.goi?.[0]?.so_tien ? fmtMoney(p.goi[0].so_tien) : (p.goi?.[0]?.gia || "");
function viewProducts() {
  crumbs([["Sản phẩm"]]);
  const st = { q: "", t: "" };
  view(`${head("Sản phẩm", "Thứ tự ở đây là thứ tự ưu tiên trên web. Dùng mũi tên để đổi thứ tự.", `<a class="btn" href="#/san-pham/moi">${I.plus} Thêm sản phẩm</a>`)}
    <div class="toolbar"><input type="search" id="sq" placeholder="Tìm sản phẩm…" aria-label="Tìm sản phẩm" class="grow">
      <select id="st" aria-label="Loại"><option value="">Mọi loại</option><option>Tài liệu</option><option>App</option><option>Dịch vụ</option></select></div>
    <section class="panel flush" id="sl"></section>`);
  const draw = () => {
    const w = norm(st.q).split(/\s+/).filter(Boolean), filtered = !!(w.length || st.t);
    const list = D.products.map((p, i) => ({ p, i })).filter(({ p }) => (!st.t || catOf(p) === st.t) && w.every(k => norm([p.ten, p.phu_de].join(" ")).includes(k)));
    $("#sl").innerHTML = list.length ? `<div class="rows">${list.map(({ p, i }) => `<div class="rowi prod">
      <a class="pth" href="#/san-pham/${esc(p.slug)}">${p.anh_bia ? thumb(p.anh_bia) : `<span class="ri">${I.box}</span>`}</a>
      <a class="rt" href="#/san-pham/${esc(p.slug)}"><b>${esc(p.ten || "(chưa có tên)")}</b><small>${esc(catOf(p))} · ${esc(priceOf(p))}${p.goi?.length > 1 ? ` · ${p.goi.length} gói` : ""}</small></a>
      ${isHidden(p) ? chip("Đang ẩn", "warn") : chip("Đang hiện", "ok")}
      ${filtered ? "" : `<span class="ord"><button class="iconbtn" data-mv="-1" data-s="${esc(p.slug)}" aria-label="Đưa lên" ${i === 0 ? "disabled" : ""}>${I.up}</button><button class="iconbtn" data-mv="1" data-s="${esc(p.slug)}" aria-label="Đưa xuống" ${i === D.products.length - 1 ? "disabled" : ""}>${I.down}</button></span>`}
    </div>`).join("")}</div>` : empty(D.products.length ? "Không có sản phẩm phù hợp" : "Chưa có sản phẩm", "", D.products.length ? "" : `<a class="btn ghost" href="#/san-pham/moi">${I.plus} Thêm sản phẩm đầu tiên</a>`);
    $$("[data-mv]").forEach(b => b.onclick = async () => {
      if (!CAN_WRITE) return toast("Tài khoản này chỉ có quyền xem.", "err");
      const s = b.dataset.s, d = +b.dataset.mv; $$("[data-mv]").forEach(x => { x.disabled = true; });
      try {
        await G.commit("products", list => { const i = list.findIndex(x => x.slug === s), j = i + d; if (i < 0 || j < 0 || j >= list.length) return list; [list[i], list[j]] = [list[j], list[i]]; return list; }, "Đổi thứ tự sản phẩm");
        toast(G.DEMO ? "Bản dùng thử: đã đổi thứ tự trên màn hình." : "Đã đổi thứ tự. Web cập nhật sau khoảng 1–2 phút.");
      } catch (e) { toast(e.message, "err"); }
      draw();
    });
  };
  $("#sq").oninput = e => { st.q = e.target.value; draw(); };
  $("#st").onchange = e => { st.t = e.target.value; draw(); };
  draw();
}
const rowF = (k, label, v, o = {}) => `<div class="fld" data-k="${k}"><label>${esc(label)}</label>${o.area ? `<textarea data-k="${k}" rows="${o.rows || 2}">${esc(v)}</textarea>` : `<input data-k="${k}" type="${o.type || "text"}" value="${esc(v ?? "")}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.type === "number" ? 'min="0" step="1000" inputmode="numeric"' : ""}>`}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<p class="ferr" hidden></p></div>`;
const goiRow = g => `<div class="subrow" data-row><div class="fgrid two">${rowF("ten", "Tên gói", g.ten)}${rowF("so_tien", "Giá bán (đồng)", g.so_tien || "", { type: "number", ph: "390000" })}</div>
  <div class="fgrid two">${rowF("gia_niem_yet", "Giá gốc (chỉ điền khi thật sự giảm giá)", g.gia_niem_yet || "", { type: "number" })}${rowF("mo_ta", "Mô tả gói", g.mo_ta)}</div><button type="button" class="btn danger sm" data-rm>Xóa gói</button></div>`;
const qaRow = q => `<div class="subrow" data-row>${rowF("hoi", "Câu hỏi", q.hoi)}${rowF("dap", "Trả lời", q.dap, { area: true })}<button type="button" class="btn danger sm" data-rm>Xóa câu hỏi</button></div>`;
const galRow = p => `<div class="galit" data-row data-path="${esc(p)}">${thumb(p)}<button type="button" class="iconbtn" data-rm aria-label="Bỏ ảnh">${I.x}</button></div>`;

function viewProductForm(slug) {
  const isNew = slug === "moi";
  const orig = isNew ? null : D.products.find(x => x.slug === slug);
  if (!isNew && !orig) { crumbs([["Sản phẩm", "#/san-pham"], ["Không tìm thấy"]]); view(empty("Không tìm thấy sản phẩm này", "Có thể đã bị xóa hoặc đổi đường dẫn.", `<a class="btn ghost" href="#/san-pham">‹ Về danh sách</a>`)); return; }
  const n = D.products.length + 1;
  const p = isNew ? { slug: "", ma: "SP" + String(n).padStart(2, "0"), loai: "Tài liệu", ten: "", phu_de: "", cho_ai: "", loi_ich: [], goi: [{ ten: "", gia: "", mo_ta: "", so_tien: 0 }], cach_nhan: "", cau_hoi: [], an: true } : structuredClone(orig);
  crumbs([["Sản phẩm", "#/san-pham"], [isNew ? "Sản phẩm mới" : p.ten || p.slug]]);
  view(`<form id="pf" class="edit" novalidate>
    <div class="phead"><div><h1>${esc(isNew ? "Thêm sản phẩm" : p.ten)}</h1><p class="muted">${isHidden(p) ? chip("Đang ẩn", "warn") + " Khách chưa thấy." : chip("Đang hiện", "ok") + ` <a href="../#sp/${esc(p.slug)}" target="_blank" rel="noopener">Xem trên web ↗</a>`}</p></div></div>
    <div class="ecols"><div class="emain stack">
      <section class="panel"><h2>Thông tin chính</h2><div class="fgrid">${field("ten", "Tên sản phẩm", p.ten, { req: true, ph: "Lịch Đăng Spa: Hết Lo Nghĩ Bài Mỗi Tuần" })}
        ${field("loai", "Loại", catOf(p), { options: ["Tài liệu", "App", "Dịch vụ"] })}
        ${field("phu_de", "Mô tả ngắn (hiện trên thẻ sản phẩm)", p.phu_de, { area: true, rows: 3 })}${field("cho_ai", "Dành cho ai", p.cho_ai)}</div></section>
      <section class="panel"><h2>Hình ảnh</h2><div class="fgrid">${imageField("anh_bia", "Ảnh bìa", p.anh_bia, "Ảnh ngang tỉ lệ 16:10, hiện trên thẻ sản phẩm và đầu trang chi tiết.")}
        <div class="fld" data-f="anh_minh_hoa"><label>Ảnh minh họa thêm (không bắt buộc)</label><div class="gal" data-rows="anh_minh_hoa">${(p.anh_minh_hoa || []).map(galRow).join("")}</div><div><button type="button" class="btn ghost sm" id="addGal">${I.plus} Thêm ảnh</button></div></div></div></section>
      <section class="panel"><h2>Lợi ích</h2>${field("loi_ich", "Mỗi dòng một lợi ích", (p.loi_ich || []).join("\n"), { area: true, rows: 5 })}</section>
      <section class="panel"><h2>Nội dung chi tiết</h2>${mdEditor("noi_dung", "Phần chi tiết (không bắt buộc, hiện dưới mục lợi ích)", p.noi_dung || "")}</section>
      <section class="panel"><h2>Gói và giá</h2><p class="hint">Chỉ nhập giá đã chốt. Giá gốc chỉ điền khi thật sự đang giảm giá, web sẽ hiện gạch ngang và phần trăm giảm.</p>
        <div class="fld" data-f="goi"><div class="subrows" data-rows="goi">${(p.goi || []).map(goiRow).join("")}</div><p class="ferr" hidden></p></div><div><button type="button" class="btn ghost sm" id="addGoi">${I.plus} Thêm gói</button></div></section>
      <section class="panel"><h2>Câu hỏi thường gặp</h2><div class="subrows" data-rows="cau_hoi">${(p.cau_hoi || []).map(qaRow).join("")}</div><div><button type="button" class="btn ghost sm" id="addQa">${I.plus} Thêm câu hỏi</button></div></section>
      <section class="panel"><h2>Cách nhận và cam kết</h2><div class="fgrid">${field("cach_nhan", "Cách nhận sản phẩm", p.cach_nhan, { area: true, rows: 3 })}${field("cam_ket", "Cam kết", p.cam_ket, { area: true, rows: 2 })}</div></section>
    </div>
    <aside class="eside stack">
      <section class="panel"><h2>Lưu</h2>${toggle("hien", "Hiện trên web", !isHidden(p), isNew ? "Sản phẩm mới để ẩn, xem trước xong mới bật." : "")}
        <div class="act col"><button type="submit" class="btn" id="sv">Lưu sản phẩm</button><button type="button" class="btn ghost" id="pv">${I.eye} Xem trước</button></div></section>
      <section class="panel"><h2>Đường dẫn</h2>${field("slug", "Đường dẫn", p.slug, { ph: "tu-dong-theo-ten", hint: `Link: <code id="slugUrl"></code>` })}</section>
      <section class="panel"><h2>SEO</h2>${field("seo_tieu_de", "Tiêu đề trên Google", p.seo_tieu_de, { count: SEO_TITLE_MAX, ph: "Để trống thì dùng tên sản phẩm" })}${field("seo_mo_ta", "Mô tả trên Google", p.seo_mo_ta, { area: true, rows: 3, count: SEO_DESC_MAX, ph: "Để trống thì dùng mô tả ngắn" })}</section>
      ${isNew ? "" : `<section class="panel"><button type="button" class="btn danger wide" id="del">${I.trash} Xóa sản phẩm</button></section>`}
    </aside></div></form>`);
  const root = $("#pf"); watchDirty(root); bindCounters(root); bindMd(root); bindImageFields(root, "img/covers");
  let slugTouched = !isNew;
  const slugUrl = () => { $("#slugUrl").textContent = `…/sp/${$("#f_slug").value || slugify($("#f_ten").value) || "duong-dan"}/`; };
  $("#f_slug").addEventListener("input", () => { slugTouched = true; slugUrl(); });
  $("#f_ten").addEventListener("input", () => { if (!slugTouched) $("#f_slug").value = slugify($("#f_ten").value); slugUrl(); });
  slugUrl();
  const addRow = (sel, html) => { $(`[data-rows="${sel}"]`, root).insertAdjacentHTML("beforeend", html); DIRTY = true; };
  $("#addGoi").onclick = () => addRow("goi", goiRow({}));
  $("#addQa").onclick = () => { addRow("cau_hoi", qaRow({})); $$('[data-rows="cau_hoi"] [data-row]', root).pop().querySelector("input").focus(); };
  $("#addGal").onclick = async () => { const im = await pickImage("img/anh"); if (im) addRow("anh_minh_hoa", galRow(im)); };
  root.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { b.closest("[data-row]").remove(); DIRTY = true; } });
  const collect = () => {
    const f = formData(root), x = structuredClone(p);
    Object.assign(x, { ten: f.ten, slug: slugify(f.slug || f.ten), loai: f.loai, phu_de: f.phu_de, cho_ai: f.cho_ai, cach_nhan: f.cach_nhan, loi_ich: f.loi_ich.split("\n").map(s => s.trim()).filter(Boolean) });
    for (const k of ["cam_ket", "anh_bia", "seo_tieu_de", "seo_mo_ta"]) { if (f[k]) x[k] = f[k]; else delete x[k]; }
    const nd = $("#f_noi_dung").value.trim(); if (nd) x.noi_dung = nd; else delete x.noi_dung;
    const rows = k => $$(`[data-rows="${k}"] > [data-row]`, root).map(r => Object.fromEntries($$("[data-k]:is(input,textarea)", r).map(i => [i.dataset.k, i.value.trim()])));
    x.goi = rows("goi").map(g => { const t = Math.round(+g.so_tien || 0), ny = Math.round(+g.gia_niem_yet || 0); const o = { ten: g.ten, gia: t ? fmtMoney(t) : "", mo_ta: g.mo_ta, so_tien: t }; if (ny) o.gia_niem_yet = ny; return o; });
    x.cau_hoi = rows("cau_hoi").filter(q => q.hoi).map(q => ({ hoi: q.hoi, dap: q.dap }));
    const gal = $$('[data-rows="anh_minh_hoa"] > [data-row]', root).map(r => r.dataset.path); if (gal.length) x.anh_minh_hoa = gal; else delete x.anh_minh_hoa;
    if (f.hien) delete x.an; else x.an = true;
    return x;
  };
  const valid = x => {
    const list = D.products.filter(y => y.slug !== p.slug || isNew).concat(x);
    const iss = checkProduct(x, { ...D, products: list }, imageSet()).filter(i => i.loi);
    showErrors(root, iss.filter(i => !/^goi\.\d/.test(i.truong)));
    // lỗi trong từng gói: đánh dấu đúng ô của gói đó
    iss.forEach(i => { const m = i.truong.match(/^goi\.(\d+)\.(\w+)$/); if (!m) return; const r = $$('[data-rows="goi"] > [data-row]', root)[+m[1]]; const f = r && $(`.fld[data-k="${m[2]}"]`, r); if (f) { f.classList.add("bad"); const e = $(".ferr", f); e.hidden = false; e.textContent = i.msg; } });
    if (iss.some(i => /^goi\.\d/.test(i.truong)) && !iss.some(i => !/^goi\.\d/.test(i.truong))) $(".subrow .fld.bad", root)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (iss.length) toast(`Còn ${iss.length} chỗ cần sửa, xem chữ đỏ.`, "err");
    return !iss.length;
  };
  root.onsubmit = async e => {
    e.preventDefault();
    const x = collect(); if (!valid(x)) return;
    if (!isNew && x.slug !== p.slug && !await confirmBox(`Đổi đường dẫn thì link cũ đã chia sẻ (…/sp/${p.slug}) sẽ không mở được nữa. Vẫn đổi?`, { yes: "Đổi đường dẫn" })) return;
    if (await doSave($("#sv"), () => G.commit("products", upsert(orig, x), (isNew ? "Thêm sản phẩm: " : "Sửa sản phẩm: ") + x.ten))) go("#/san-pham/" + x.slug);
  };
  $("#pv").onclick = () => { const x = collect(); x.slug = x.slug || "xem-truoc"; delete x.an; preview("#sp/" + x.slug, snap => { snap.products = snap.products.filter(y => y.slug !== p.slug).concat(x); }); };
  if ($("#del")) $("#del").onclick = async () => {
    if (!await confirmBox(`Xóa hẳn "${p.ten}" khỏi web? Bài viết đang gợi ý sản phẩm này sẽ không hiện gợi ý nữa.`, { yes: "Xóa", danger: true, title: "Xóa sản phẩm" })) return;
    if (await doSave($("#del"), () => G.commit("products", removeBy(orig), "Xóa sản phẩm: " + p.ten), "Đã xóa sản phẩm.")) go("#/san-pham");
  };
  if (!CAN_WRITE) $$("#sv,#del").forEach(b => { b.disabled = true; });
}

/* ================= thư viện ảnh ================= */
function viewImages() {
  crumbs([["Thư viện ảnh"]]);
  const st = { q: "", d: "" };
  view(`${head("Thư viện ảnh", "Mọi ảnh trong thư mục img/ của web.", `<label class="btn${CAN_WRITE ? "" : " disabled"}">${I.upload} Tải ảnh lên<input type="file" id="up" accept="${ACCEPT}" multiple hidden ${CAN_WRITE ? "" : "disabled"}></label>`)}
    <div class="toolbar"><input type="search" id="iq" placeholder="Tìm theo tên file…" aria-label="Tìm ảnh" class="grow"><select id="id" aria-label="Thư mục"><option value="">Mọi thư mục</option></select></div>
    <p class="hint">Nhận JPG, PNG, WEBP. Ảnh lớn hơn 1600 điểm ảnh hoặc nặng hơn 1,5 MB sẽ tự thu nhỏ. Không nhận file khác để giữ an toàn cho web.</p>
    <section id="ig">${loading("Đang đọc danh sách ảnh…")}</section>`);
  const draw = () => {
    if (!$("#ig")) return;
    const dirs = [...new Set(IMAGES.map(x => x.path.split("/").slice(0, -1).join("/")))].sort();
    const sel = $("#id"); if (sel.options.length !== dirs.length + 1) sel.innerHTML = `<option value="">Mọi thư mục</option>` + dirs.map(d => `<option${d === st.d ? " selected" : ""}>${esc(d)}</option>`).join("");
    const w = norm(st.q);
    const list = IMAGES.filter(x => (!st.d || x.path.startsWith(st.d + "/")) && norm(x.path).includes(w)).sort((a, b) => a.path.localeCompare(b.path));
    $("#ig").innerHTML = list.length ? `<div class="igrid">${list.map(x => { const used = usages(x.path, D, CODE).length; return `<button type="button" class="icard" data-p="${esc(x.path)}"><span class="iim">${thumb(x.path)}</span><span class="imeta"><b>${esc(x.path.split("/").pop())}</b><small>${esc(x.path.split(".").pop().toUpperCase())} · ${x.size ? fmtSize(x.size) : "?"}</small>${used ? chip("Đang dùng " + used, "ok") : chip("Chưa dùng")}</span></button>`; }).join("")}</div>` : empty("Không có ảnh phù hợp");
    $$(".icard").forEach(b => b.onclick = () => imageDetail(IMAGES.find(x => x.path === b.dataset.p), draw));
  };
  if (IMAGES) draw(); else document.addEventListener("images", draw, { once: true });
  $("#iq").oninput = e => { st.q = e.target.value; draw(); };
  $("#id").onchange = e => { st.d = e.target.value; draw(); };
  $("#up").onchange = async e => {
    const files = [...e.target.files]; e.target.value = "";
    for (const f of files) {
      $("#ig").insertAdjacentHTML("afterbegin", `<div class="uploading">${loading("Đang tải " + f.name + "…")}</div>`);
      try { const r = await uploadFile(f, "img/anh"); toast(`Đã tải ${r.path.split("/").pop()}${r.resized ? ` (tự thu nhỏ còn ${fmtSize(r.size)})` : ""}.`); }
      catch (ex) { toast(`${f.name}: ${ex.message}`, "err"); }
      draw();
    }
  };
}
function imageDetail(x, redraw) {
  const used = usages(x.path, D, CODE), ext = x.path.split(".").pop().toLowerCase(), editable = /^(jpe?g|png|webp)$/.test(ext);
  const m = modal(`<div class="dhead"><h2>${esc(x.path.split("/").pop())}</h2><button class="iconbtn" data-close aria-label="Đóng">${I.x}</button></div>
    <div class="idet"><div class="ibig">${thumb(x.path)}</div><div class="stack">
      <dl class="kv"><dt>Thư mục</dt><dd>${esc(x.path.split("/").slice(0, -1).join("/"))}</dd><dt>Loại</dt><dd>${esc(ext.toUpperCase())}</dd><dt>Dung lượng</dt><dd>${x.size ? fmtSize(x.size) : "?"}</dd><dt>Kích thước</dt><dd id="dim">…</dd>
      <dt>Đường dẫn</dt><dd><code>${esc(x.path)}</code> <button class="iconbtn" id="cpy" aria-label="Chép đường dẫn">${I.copy}</button></dd></dl>
      <div><b>Đang dùng ở</b>${used.length ? `<ul class="used">${used.map(u => `<li>${u.link ? `<a href="${u.link}" data-close>${esc(u.ten)}</a>` : esc(u.ten)}</li>`).join("")}</ul>` : `<p class="muted">Chưa nội dung nào dùng ảnh này.</p>`}</div>
      <div class="row">${editable ? `<label class="btn ghost sm${CAN_WRITE ? "" : " disabled"}">${I.upload} Thay ảnh<input type="file" id="rep" accept="${ACCEPT}" hidden ${CAN_WRITE ? "" : "disabled"}></label>` : ""}
        <button class="btn danger sm" id="rm" ${used.length || !CAN_WRITE ? "disabled" : ""}>${I.trash} Xóa ảnh</button></div>
      ${used.length ? `<p class="hint">Ảnh đang được dùng nên chưa xóa được. Bỏ ảnh khỏi các nội dung trên trước. Muốn đổi ảnh mà giữ nguyên chỗ dùng, bấm Thay ảnh.</p>` : ""}
    </div></div>`, { wide: true });
  const im = $(".ibig img", m.el); const dim = () => { $("#dim", m.el).textContent = im.naturalWidth ? `${im.naturalWidth} × ${im.naturalHeight}` : "?"; };
  im.complete ? dim() : im.addEventListener("load", dim);
  $("#cpy", m.el).onclick = async () => { try { await navigator.clipboard.writeText(x.path); toast("Đã chép đường dẫn ảnh."); } catch (e) { toast("Trình duyệt chặn chép, anh chị bôi đen để chép.", "err"); } };
  if ($("#rep", m.el)) $("#rep", m.el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!await confirmBox(`Thay "${x.path.split("/").pop()}" bằng ảnh mới? Mọi chỗ đang dùng ảnh này sẽ đổi theo.`, { yes: "Thay ảnh" })) return;
    try {
      const sha = G.DEMO ? "" : (await G.fileSha(x.path));
      await uploadFile(f, "", { replace: { path: x.path, sha } }); toast("Đã thay ảnh. Web cập nhật sau khoảng 1–2 phút."); m.close(); redraw();
    } catch (ex) { toast(ex.message, "err"); }
  };
  $("#rm", m.el).onclick = async () => {
    if (!await confirmBox(`Xóa hẳn ảnh "${x.path}"?`, { yes: "Xóa ảnh", danger: true })) return;
    if (usages(x.path, D, CODE).length) return toast("Ảnh vừa được dùng ở nội dung khác, chưa xóa.", "err");
    try {
      const sha = G.DEMO ? "" : (await G.fileSha(x.path));
      if (!G.DEMO && !sha) throw new G.ApiError("Ảnh này không còn trên GitHub.", 404);
      await G.deleteFile(x.path, sha, "Xóa ảnh: " + x.path); IMAGES = IMAGES.filter(y => y.path !== x.path); delete DEMO_BLOBS[x.path];
      toast(G.DEMO ? "Bản dùng thử: đã xóa trên màn hình." : "Đã xóa ảnh."); m.close(); redraw();
    } catch (ex) { toast(ex.message, "err"); }
  };
}

/* ================= hướng dẫn ================= */
function viewGuide() {
  crumbs([["Hướng dẫn"]]);
  const doc = `https://github.com/${G.REPO.owner}/${G.REPO.repo}/blob/${G.BRANCH}/ADMIN_USER_GUIDE.md`;
  view(`${head("Hướng dẫn", `Bản đầy đủ: <a href="${doc}" target="_blank" rel="noopener">Hướng dẫn sử dụng Admin ↗</a>`)}
  <div class="cols">
    <section class="panel"><h2>Sửa web hằng ngày</h2><ol class="steps"><li>Chọn mục ở menu bên trái: Trang chủ, Sản phẩm, Bài viết…</li><li>Sửa nội dung. Bấm <b>Xem trước</b> để xem trên khung điện thoại.</li><li>Bấm <b>Lưu</b> hoặc <b>Xuất bản</b>. Sau khoảng 1–2 phút mở web, kéo xuống để tải lại là thấy.</li></ol></section>
    <section class="panel"><h2>Nháp và xuất bản</h2><ol class="steps"><li><b>Bản nháp</b>: khách không thấy trên web.</li><li><b>Xuất bản</b>: khách thấy ngay sau khi web cập nhật.</li><li>Sản phẩm dùng nút <b>Hiện trên web</b> thay cho nháp.</li></ol>
      <p class="hint">Kho web đang để công khai trên GitHub, nên bản nháp vẫn nằm trong file dữ liệu. Không ghi thông tin bí mật vào bản nháp.</p></section>
    <section class="panel"><h2>Tạo mã truy cập</h2>${tokenSteps()}</section>
    <section class="panel"><h2>Thêm người quản trị</h2><ol class="steps"><li>Người đó tạo tài khoản GitHub.</li><li>Chủ kho vào GitHub, kho <b>${esc(G.REPO.repo)}</b> → Settings → Collaborators → Add people.</li><li>Người đó tự tạo mã truy cập của mình theo các bước bên cạnh rồi đăng nhập.</li></ol>
      <p class="hint">Gỡ quyền: vào Collaborators bấm Remove, người đó mất quyền sửa ngay.</p></section>
    <section class="panel"><h2>Lỡ sửa sai?</h2><p class="muted">Mọi lần lưu đều nằm trong lịch sử GitHub. Mở <a href="https://github.com/${G.REPO.owner}/${G.REPO.repo}/commits/${G.BRANCH}" target="_blank" rel="noopener">lịch sử thay đổi ↗</a> để xem ai sửa gì, lúc nào. Cần khôi phục bản cũ thì nhờ người dựng web.</p></section>
  </div>`);
}

boot();
