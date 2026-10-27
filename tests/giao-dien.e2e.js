// Kiểm thử giao diện Admin và web công khai trên trình duyệt thật (Playwright).
// GitHub được giả lập: đọc và ghi thẳng vào một bản sao của web trong thư mục tạm,
// nên kiểm tra được cả việc nội dung lưu từ Admin hiện đúng trên web công khai.
// Chạy: node tests/giao-dien.e2e.js   (cần Playwright; ảnh chụp lưu ở thư mục in ra cuối)
import { createServer } from "node:http";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync } from "node:fs";
import { join, extname, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import(pathToFileURL(join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href)); }

const SITE = mkdtempSync(join(tmpdir(), "sona-web-"));
const SHOTS = process.env.SHOTS || mkdtempSync(join(tmpdir(), "sona-anh-"));
cpSync(ROOT, SITE, { recursive: true, filter: s => !/[\\/](\.git|node_modules)([\\/]|$)/.test(s) });

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".xml": "application/xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = join(SITE, p);
  if (!f.startsWith(SITE) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

/* ---------- GitHub giả lập ---------- */
const TOK_W = "github_pat_" + "W".repeat(40), TOK_R = "github_pat_" + "R".repeat(40);
const sha = buf => createHash("sha1").update(buf).digest("hex");
const commits = [];
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body ?? {}) });
async function github(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  const auth = (req.headers()["authorization"] || "").replace("Bearer ", "");
  const who = auth === TOK_W ? "w" : auth === TOK_R ? "r" : auth ? "bad" : "";
  if (who === "bad") return json(route, 401, { message: "Bad credentials" });
  const path = u.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "");
  if (u.pathname === "/user") return who ? json(route, 200, { login: "chu-web", name: "Chủ web", avatar_url: "" }) : json(route, 401, {});
  if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return json(route, 200, { private: false, permissions: { admin: who === "w", push: who === "w", pull: true } });
  if (path.startsWith("/contents/")) {
    const rel = decodeURIComponent(path.slice(10)), f = join(SITE, rel);
    if (m === "GET") { if (!existsSync(f)) return json(route, 404, {}); const b = readFileSync(f); return json(route, 200, { sha: sha(b), size: b.length, content: b.toString("base64") }); }
    if (who !== "w") return json(route, who ? 403 : 401, { message: "Resource not accessible" });
    const body = JSON.parse(req.postData() || "{}"), cur = existsSync(f) ? sha(readFileSync(f)) : null;
    if (cur && !body.sha) return json(route, 422, { message: "sha wasn't supplied" });
    if (body.sha && body.sha !== cur) return json(route, 409, { message: "conflict" });
    commits.unshift({ sha: String(commits.length), html_url: "https://github.com/x", author: { login: "chu-web" }, commit: { message: body.message, author: { name: "chu-web", date: new Date().toISOString() } } });
    if (m === "DELETE") { rmSync(f); return json(route, 200, { commit: commits[0] }); }
    const b = Buffer.from(body.content, "base64"); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, b);
    return json(route, 200, { content: { sha: sha(b) }, commit: commits[0] });
  }
  if (path.startsWith("/git/trees/")) {
    const out = []; const walk = d => readdirSync(d).forEach(n => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : out.push({ path: relative(SITE, p).split("\\").join("/"), type: "blob", size: statSync(p).size, sha: sha(readFileSync(p)) }); });
    walk(join(SITE, "img")); return json(route, 200, { tree: out });
  }
  if (path === "/commits") return json(route, 200, commits.slice(0, 8));
  if (path === "/pages/builds/latest") return json(route, 403, {});
  if (path === "/actions/runs") return json(route, 403, {});
  return json(route, 404, {});
}

/* ---------- chạy kiểm thử ---------- */
const results = []; let current = "";
async function step(name, fn) { current = name; try { await fn(); results.push(["ĐẠT", name]); } catch (e) { results.push(["LỖI", name + " → " + e.message.split("\n")[0]]); } }
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const readJ = f => JSON.parse(readFileSync(join(SITE, f), "utf8"));

let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" }); }
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.route("https://api.github.com/**", github);
await ctx.route("https://raw.githubusercontent.com/**", r => { const p = new URL(r.request().url()).pathname.split("/").slice(4).join("/"); const f = join(SITE, decodeURIComponent(p)); return existsSync(f) ? r.fulfill({ body: readFileSync(f) }) : r.fulfill({ status: 404 }); });
await ctx.route(/fonts\.(googleapis|gstatic)\.com|img\.vietqr\.io/, r => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(current + ": " + e.message));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(current + ": " + m.text()); });
const toastText = () => page.locator(".toast").last().innerText({ timeout: 8000 });
const waitToastGone = () => page.waitForSelector(".toast", { state: "detached", timeout: 10000 }).catch(() => {});
const shot = async (name, w = 1280) => { await page.setViewportSize({ width: w, height: w < 600 ? 844 : 860 }); await page.waitForTimeout(250); await page.screenshot({ path: join(SHOTS, name + ".png"), fullPage: false }); };
const noOverflow = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "trang bị tràn ngang");
async function publicView(hash) { const p = await ctx.newPage(); await p.goto(`${BASE}/index.html${hash}`); await p.waitForSelector("#app > *"); await p.waitForTimeout(150); return p; }
async function login(tok = TOK_W) {
  await page.goto(`${BASE}/admin/`); await page.waitForSelector("#tk");
  await page.fill("#tk", tok); await page.click("#go"); await page.waitForSelector(".shell");
}

await step("1. Vào Admin khi chưa đăng nhập chỉ thấy màn hình đăng nhập", async () => {
  await page.goto(`${BASE}/admin/#/san-pham`); await page.waitForSelector("#tk");
  ok(!(await page.locator(".shell").count()), "lộ giao diện quản trị");
  await shot("01-dang-nhap-desktop"); await shot("01-dang-nhap-mobile", 390); await noOverflow(); await page.setViewportSize({ width: 1280, height: 860 });
});
await step("2. Mã sai dạng và mã không đúng bị từ chối", async () => {
  await page.fill("#tk", "abc"); await page.click("#go");
  ok(await page.locator("#tkErr").isVisible(), "không báo mã sai dạng");
  await page.fill("#tk", "github_pat_" + "X".repeat(40)); await page.click("#go"); await page.waitForSelector(".alert.err");
  ok(/hết hạn|không đúng/.test(await page.locator(".alert.err").innerText()), "không báo mã không đúng");
});
await step("3. Tài khoản chỉ có quyền xem không lưu được; gọi API ghi trực tiếp bị từ chối 403", async () => {
  await login(TOK_R);
  ok(await page.locator(".banner.ro").isVisible(), "không thấy thông báo chỉ xem");
  await page.goto(`${BASE}/admin/#/cau-hinh`); await page.waitForSelector("#sv");
  await page.click("#sv"); ok(/chỉ có quyền xem/.test(await toastText()), "vẫn cho lưu");
  const status = await page.evaluate(async t => (await fetch("https://api.github.com/repos/a/b/contents/site.json", { method: "PUT", headers: { Authorization: "Bearer " + t }, body: "{}" })).status, TOK_R);
  ok(status === 403, "API ghi trả về " + status);
  const anon = await page.evaluate(async () => (await fetch("https://api.github.com/repos/a/b/contents/site.json", { method: "PUT", body: "{}" })).status);
  ok(anon === 401, "API ghi không mã trả về " + anon);
  await page.click("#ubtn"); await page.click("#logout"); await page.waitForSelector("#tk"); await waitToastGone();
});
await step("4. Đăng nhập, Dashboard đếm đúng số liệu, đăng xuất xóa phiên", async () => {
  await login();
  const st = await page.locator(".stat b").allInnerTexts();
  const prods = readJ("products.json"), posts = readJ("posts.json");
  ok(+st[0] === prods.length, `sản phẩm ${st[0]} ≠ ${prods.length}`);
  ok(+st[1] === posts.filter(a => a.trang_thai !== "nhap").length, `bài ${st[1]}`);
  ok(await page.evaluate(() => !!sessionStorage.getItem("sona_admin_phien")), "không có phiên");
  ok(await page.evaluate(() => !localStorage.getItem("sona_admin_nho")), "nhớ mã khi chưa chọn ghi nhớ");
  await page.waitForTimeout(400); await shot("02-tong-quan-desktop"); await noOverflow(); await shot("02-tong-quan-mobile", 390); await noOverflow(); await page.setViewportSize({ width: 1280, height: 860 });
  await page.click("#ubtn"); await page.click("#logout"); await page.waitForSelector("#tk");
  ok(await page.evaluate(() => !sessionStorage.getItem("sona_admin_phien")), "phiên chưa bị xóa");
  await page.goto(`${BASE}/admin/#/san-pham`); await page.waitForSelector("#tk");
  await login();
});
await step("5. Tạo trang mới, xuất bản, hiện trên web công khai; sửa lại được", async () => {
  await page.goto(`${BASE}/admin/#/trang/moi`); await page.waitForSelector("#f_tieu_de");
  await page.fill("#f_tieu_de", "Chính sách đổi trả");
  await page.fill("#f_noi_dung", "## Đổi trong 7 ngày\nLiên hệ Zalo để được hỗ trợ.\n- Giữ hóa đơn\n[Học AI](#hoc)");
  await page.check("#f_hien_chan_trang", { force: true });
  await page.click("#pub"); await page.waitForURL(/#\/trang\/chinh-sach-doi-tra$/);
  const pg = readJ("pages.json").find(x => x.slug === "chinh-sach-doi-tra");
  ok(pg && pg.trang_thai === "xuat_ban" && pg.hien_chan_trang, "pages.json chưa đúng");
  let p = await publicView("#trang/chinh-sach-doi-tra");
  ok((await p.locator(".art h1").innerText()) === "Chính sách đổi trả", "web chưa hiện trang");
  ok(await p.locator('#flinks a[href="#trang/chinh-sach-doi-tra"]').count() === 1, "chân trang chưa có link");
  ok(await p.locator('.art .body a[href="#hoc"]').count() === 1, "link trong nội dung chưa hiện");
  await p.close();
  await page.fill("#f_tieu_de", "Chính sách đổi trả hàng"); await page.click("#pub"); await page.waitForTimeout(600);
  ok(readJ("pages.json").find(x => x.slug === "chinh-sach-doi-tra").tieu_de === "Chính sách đổi trả hàng", "sửa trang chưa lưu");
});
await step("6. Bài viết nháp không hiện trên web, xuất bản thì hiện", async () => {
  await page.goto(`${BASE}/admin/#/bai-viet/moi`); await page.waitForSelector("#f_tieu_de");
  await page.fill("#f_tieu_de", "Bài thử nghiệm nháp"); await page.fill("#f_tom_tat", "Tóm tắt thử"); await page.fill("#f_noi_dung", "Nội dung thử");
  await page.click("#dr"); await page.waitForURL(/#\/bai-viet\/bai-thu-nghiem-nhap$/);
  ok(readJ("posts.json").find(x => x.slug === "bai-thu-nghiem-nhap")?.trang_thai === "nhap", "chưa lưu nháp");
  let p = await publicView("#bai/bai-thu-nghiem-nhap"); ok(!(await p.locator(".art h1").count()), "bản nháp lộ trên web"); await p.close();
  await page.click("#pub"); await page.waitForTimeout(700);
  p = await publicView("#bai/bai-thu-nghiem-nhap"); ok((await p.locator(".art h1").innerText()) === "Bài thử nghiệm nháp", "bài đã xuất bản chưa hiện"); await p.close();
});
await step("7. Kiểm tra dữ liệu: sản phẩm thiếu giá bị chặn, file không đổi", async () => {
  const before = readFileSync(join(SITE, "products.json"), "utf8");
  await page.goto(`${BASE}/admin/#/san-pham/moi`); await page.waitForSelector("#f_ten");
  await page.fill("#f_ten", "Sản phẩm thử");
  await page.click("#sv"); await page.waitForTimeout(300);
  ok(await page.locator(".subrow .fld.bad").count() >= 1, "không đánh dấu ô giá");
  ok(readFileSync(join(SITE, "products.json"), "utf8") === before, "vẫn ghi file");
  await page.fill('[data-rows="goi"] [data-row] input[data-k="ten"]', "Gói cơ bản");
  await page.fill('[data-rows="goi"] [data-row] input[data-k="so_tien"]', "250000");
  await page.fill('[data-rows="goi"] [data-row] input[data-k="gia_niem_yet"]', "100000");
  await page.click("#sv"); await page.waitForTimeout(300);
  ok(/giá gốc/.test(await page.locator(".subrow .fld.bad .ferr").first().innerText()), "không chặn giá gốc thấp hơn giá bán");
  await page.fill('[data-rows="goi"] [data-row] input[data-k="gia_niem_yet"]', "");
});
await step("8. Tạo sản phẩm ẩn, bật hiện thì có trên web; sửa giá", async () => {
  await page.fill("#f_phu_de", "Mô tả ngắn thử");
  await page.click("#sv"); await page.waitForURL(/#\/san-pham\/san-pham-thu$/);
  let x = readJ("products.json").find(p => p.slug === "san-pham-thu");
  ok(x && x.an === true && x.goi[0].so_tien === 250000 && x.goi[0].gia === "250.000đ", "sản phẩm lưu sai");
  let p = await publicView("#sp/san-pham-thu"); ok(!(await p.locator(".pd-top h1").count()), "sản phẩm ẩn vẫn hiện"); await p.close();
  await page.check("#f_hien", { force: true });
  await page.fill('[data-rows="goi"] [data-row] input[data-k="so_tien"]', "290000");
  await page.click("#sv"); await page.waitForTimeout(700);
  x = readJ("products.json").find(p => p.slug === "san-pham-thu"); ok(!x.an && x.goi[0].so_tien === 290000, "chưa bật hiện hoặc chưa sửa giá");
  p = await publicView("#sp/san-pham-thu"); ok((await p.locator("#bigPrice").innerText()).includes("290.000đ"), "giá trên web chưa đổi"); await p.close();
  await shot("03-san-pham-desktop"); await noOverflow(); await shot("03-san-pham-mobile", 390); await noOverflow(); await page.setViewportSize({ width: 1280, height: 860 });
});
await step("9. Tải ảnh lên, chặn file giả ảnh, dùng ảnh làm banner trang chủ", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkZGRgYGAAuBgP/2Eo3swAAAABJRU5ErkJggg==", "base64");
  await page.goto(`${BASE}/admin/#/anh`); await page.waitForSelector(".igrid");
  await page.setInputFiles("#up", { name: "Ảnh Thử Banner.png", mimeType: "image/png", buffer: png });
  await page.waitForSelector('.icard[data-p="img/anh/anh-thu-banner.png"]');
  ok(existsSync(join(SITE, "img/anh/anh-thu-banner.png")), "ảnh chưa ghi vào kho");
  await waitToastGone();
  await page.setInputFiles("#up", { name: "virus.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  ok(/không phải ảnh/.test(await toastText()), "không chặn file giả");
  ok(!existsSync(join(SITE, "img/anh/virus.png")), "file giả vẫn được ghi");
  await shot("04-thu-vien-anh-desktop"); await noOverflow(); await shot("04-thu-vien-anh-mobile", 390); await noOverflow(); await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`${BASE}/admin/#/trang-chu`); await page.waitForSelector('[data-pick="trang_chu.anh_banner"]');
  await page.click('[data-pick="trang_chu.anh_banner"]'); await page.click('.pk[data-p="img/anh/anh-thu-banner.png"]');
  await page.fill("#f_khau_hieu", "Công cụ AI cho tiệm nhỏ");
  await page.uncheck("#f__trang_chu_an_loc_loai", { force: true });
  await page.click("#sv"); await page.waitForTimeout(700);
  const s = readJ("site.json"); ok(s.trang_chu?.anh_banner === "img/anh/anh-thu-banner.png" && s.trang_chu.an_loc_loai === true && s.khau_hieu === "Công cụ AI cho tiệm nhỏ", "site.json chưa đúng");
  const p = await publicView("");
  ok(await p.locator('img.banner[src="img/anh/anh-thu-banner.png"]').count() === 1, "web chưa có banner");
  ok(!(await p.locator("#cats").isVisible()), "bộ lọc loại vẫn hiện"); ok((await p.locator(".hero h1").innerText()).includes("tiệm nhỏ"), "tiêu đề chưa đổi");
  await p.close();
  await page.goto(`${BASE}/admin/#/anh`); await page.waitForSelector('.icard[data-p="img/anh/anh-thu-banner.png"]');
  await page.click('.icard[data-p="img/anh/anh-thu-banner.png"]'); await page.waitForSelector("#rm");
  ok(await page.locator("#rm").isDisabled(), "cho xóa ảnh đang dùng"); await page.keyboard.press("Escape");
});
await step("10. Cấu hình: email sai bị chặn, hotline hiện ở chân trang", async () => {
  await page.goto(`${BASE}/admin/#/cau-hinh`); await page.waitForSelector("#f_email");
  await page.fill("#f_email", "sai-email"); await page.click("#sv"); await page.waitForTimeout(300);
  ok(await page.locator('.fld.bad[data-f="email"]').count() === 1, "không chặn email sai");
  await page.fill("#f_email", "lienhe@sona.vn"); await page.fill("#f_hotline", "0965 292 875"); await page.click("#sv"); await page.waitForTimeout(700);
  const p = await publicView(""); ok((await p.locator("#fsoc").innerText()).includes("0965 292 875"), "hotline chưa hiện"); await p.close();
});
await step("11. Không ghi đè bài học tự động vừa thêm trong lúc đang sửa", async () => {
  await page.goto(`${BASE}/admin/#/bai-viet/bai-thu-nghiem-nhap`); await page.waitForSelector("#f_tieu_de");
  const posts = readJ("posts.json"); posts.push({ slug: "bai-tu-dong-moi", tieu_de: "Bài tự động", tom_tat: "t", chu_de: "Bắt đầu", ngay: "2026-10-28", noi_dung: "x" });
  writeFileSync(join(SITE, "posts.json"), JSON.stringify(posts, null, 2));
  await page.fill("#f_tom_tat", "Tóm tắt đã sửa"); await page.click("#pub"); await page.waitForTimeout(800);
  const now = readJ("posts.json");
  ok(now.some(a => a.slug === "bai-tu-dong-moi"), "mất bài tự động"); ok(now.find(a => a.slug === "bai-thu-nghiem-nhap").tom_tat === "Tóm tắt đã sửa", "chưa lưu bài sửa");
});
await step("12. Xem trước hiện nội dung chưa lưu trong khung điện thoại", async () => {
  await page.goto(`${BASE}/admin/#/san-pham/san-pham-thu`); await page.waitForSelector("#f_ten");
  await page.fill("#f_ten", "Tên chưa lưu"); await page.click("#pv");
  const fr = page.frameLocator("#pvf"); await fr.locator(".pd-top h1").waitFor();
  ok((await fr.locator(".pd-top h1").innerText()) === "Tên chưa lưu", "xem trước sai");
  ok(await fr.locator(".pv-bar").count() === 1, "thiếu thanh báo xem trước");
  await page.screenshot({ path: join(SHOTS, "05-xem-truoc.png") });
  ok(readJ("products.json").find(p => p.slug === "san-pham-thu").ten === "Sản phẩm thử", "xem trước đã ghi file");
  await page.click(".pvbar [data-close]");
  page.once("dialog", d => d.accept());
  await page.goto(`${BASE}/admin/?lai=1#/`); await page.waitForSelector(".shell");
});
await step("13. Xóa có xác nhận, xóa xong mất khỏi dữ liệu", async () => {
  await page.goto(`${BASE}/admin/#/trang/chinh-sach-doi-tra`); await page.waitForSelector("#del");
  await page.click("#del"); await page.waitForSelector("#cfYes"); await page.click(".dialog [data-close]");
  ok(readJ("pages.json").length === 1, "hủy mà vẫn xóa");
  await page.click("#del"); await page.click("#cfYes"); await page.waitForURL(/#\/trang$/);
  ok(readJ("pages.json").length === 0, "chưa xóa");
});
await step("14. Dữ liệu sau khi sửa vẫn hợp lệ, tạo được trang SEO và trang SEO mở đúng sản phẩm", async () => {
  execSync("node scripts/kiem-tra-du-lieu.js", { cwd: SITE });
  execSync("node scripts/tao-trang-seo.js", { cwd: SITE });
  ok(existsSync(join(SITE, "sp/san-pham-thu/index.html")) && existsSync(join(SITE, "sitemap.xml")), "chưa tạo trang SEO");
  const p = await ctx.newPage(); await p.goto(`${BASE}/sp/san-pham-thu/`); await p.waitForSelector(".pd-top h1");
  ok((await p.locator(".pd-top h1").innerText()) === "Sản phẩm thử", "trang SEO không mở đúng sản phẩm");
  ok((await p.title()).startsWith("Sản phẩm thử"), "tiêu đề trang SEO sai");
  await p.close();
});
await step("15. Web công khai hiển thị tốt trên điện thoại", async () => {
  const p = await ctx.newPage(); await p.setViewportSize({ width: 390, height: 844 }); await p.goto(`${BASE}/`); await p.waitForSelector(".card");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "web công khai tràn ngang");
  await p.screenshot({ path: join(SHOTS, "06-web-cong-khai-mobile.png") }); await p.close();
});

ok(true); current = "";
await browser.close(); server.close();
console.log(results.map(r => r.join("  ")).join("\n"));
if (errors.length) console.log("\nLỗi JavaScript:\n" + [...new Set(errors)].join("\n"));
console.log(`\n${results.filter(r => r[0] === "ĐẠT").length}/${results.length} đạt. Ảnh chụp: ${SHOTS}`);
rmSync(SITE, { recursive: true, force: true });
process.exit(results.every(r => r[0] === "ĐẠT") && !errors.length ? 0 : 1);
