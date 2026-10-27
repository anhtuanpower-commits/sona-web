// Tạo trang riêng cho từng sản phẩm, bài viết, trang (sp/<slug>/, bai/<slug>/, trang/<slug>/)
// để Google, Facebook, Zalo đọc được tiêu đề, mô tả, ảnh riêng. Tạo thêm sitemap.xml và robots.txt.
// Mỗi trang là bản sao index.html, chỉ thay khối <!--seo:dau--> ... <!--seo:cuoi-->, nên giao diện giữ nguyên.
// Chạy: node scripts/tao-trang-seo.js   (GitHub Actions tự chạy sau mỗi lần dữ liệu thay đổi)
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDraft, isHidden } from "../admin/kiem-tra.js";

export const GENERATED_DIRS = ["sp", "bai", "trang"];
const MARK = /<!--seo:dau-->[\s\S]*?<!--seo:cuoi-->/;
const DEFAULT_DESC = "Công cụ AI đơn giản cho người kinh doanh bận rộn: tài liệu, app và dịch vụ dùng được ngay.";
const escA = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };

export function baseUrl(site, env = {}) {
  const set = site?.seo?.dia_chi_web;
  if (set) return set.endsWith("/") ? set : set + "/";
  const [owner, repo] = String(env.GITHUB_REPOSITORY || "nguyenanhtuansonnam-coder/sona-web").split("/");
  return repo.toLowerCase() === owner.toLowerCase() + ".github.io" ? `https://${repo}/` : `https://${owner.toLowerCase()}.github.io/${repo}/`;
}
const abs = (base, u) => !u ? "" : /^https?:\/\//.test(u) ? u : base + String(u).replace(/^\.?\//, "");

export function headBlock({ base, path, title, desc, image, type = "website", siteName, favicon, route }) {
  const depth = path ? path.split("/").filter(Boolean).length : 0;
  const url = base + path;
  return "<!--seo:dau-->" + (depth ? `<base href="${"../".repeat(depth)}">` : "") +
    `<title>${escA(title)}</title>
<meta name="description" content="${escA(clip(desc, 300))}">
<link rel="canonical" href="${escA(url)}">
<link rel="icon" href="${escA(favicon)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${escA(siteName)}">
<meta property="og:title" content="${escA(title)}">
<meta property="og:description" content="${escA(clip(desc, 300))}">
<meta property="og:url" content="${escA(url)}">
<meta property="og:image" content="${escA(abs(base, image))}">
<meta name="twitter:card" content="summary_large_image">` +
    (route ? `\n<script>window.SONA_ROUTE=${JSON.stringify(route).replace(/</g, "\\u003c")}</script>` : "") + "<!--seo:cuoi-->";
}

/** Trả về {đường dẫn file: nội dung} cần ghi. Không đụng tới file khác. */
export function build({ site = {}, products = [], posts = [], pages = [], indexHtml, env = {} }) {
  if (!MARK.test(indexHtml)) throw new Error("index.html thiếu khối <!--seo:dau--> ... <!--seo:cuoi-->");
  const base = baseUrl(site, env), seo = site.seo || {};
  const siteName = site.ten_web || "SONA";
  const favicon = site.favicon || "img/favicon.png";
  const defImg = seo.anh || "img/logo-full.jpg";
  const files = {}, urls = [{ loc: base }];
  const page = (path, o) => indexHtml.replace(MARK, () => headBlock({ base, path, siteName, favicon, ...o }));

  files["index.html"] = page("", {
    title: seo.tieu_de || siteName + (site.khau_hieu ? " · " + site.khau_hieu : ""),
    desc: seo.mo_ta || DEFAULT_DESC, image: defImg,
  });
  for (const p of products.filter(p => p.slug && !isHidden(p))) {
    const path = `sp/${p.slug}/`;
    files[path + "index.html"] = page(path, { title: (p.seo_tieu_de || p.ten) + " · " + siteName, desc: p.seo_mo_ta || p.phu_de || seo.mo_ta || DEFAULT_DESC, image: p.anh_bia || defImg, type: "product", route: "sp/" + p.slug });
    urls.push({ loc: base + path });
  }
  for (const a of posts.filter(a => a.slug && !isDraft(a))) {
    const path = `bai/${a.slug}/`;
    files[path + "index.html"] = page(path, { title: (a.seo_tieu_de || a.tieu_de) + " · " + siteName, desc: a.seo_mo_ta || a.tom_tat || DEFAULT_DESC, image: a.anh || defImg, type: "article", route: "bai/" + a.slug });
    urls.push({ loc: base + path, lastmod: /^\d{4}-\d{2}-\d{2}$/.test(a.ngay || "") ? a.ngay : "" });
  }
  for (const pg of pages.filter(x => x.slug && !isDraft(x))) {
    const path = `trang/${pg.slug}/`;
    files[path + "index.html"] = page(path, { title: (pg.seo_tieu_de || pg.tieu_de) + " · " + siteName, desc: pg.seo_mo_ta || clip(String(pg.noi_dung || "").replace(/[#>*\-[\]()!]/g, " "), 160) || DEFAULT_DESC, image: pg.anh || defImg, route: "trang/" + pg.slug });
    urls.push({ loc: base + path });
  }
  files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${escA(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
  files["robots.txt"] = `User-agent: *\nDisallow: ${new URL(base).pathname}admin/\n\nSitemap: ${base}sitemap.xml\n`;
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f, d) => existsSync(join(ROOT, f)) ? JSON.parse(readFileSync(join(ROOT, f), "utf8")) : d;
  const files = build({
    site: read("site.json", {}), products: read("products.json", []), posts: read("posts.json", []), pages: read("pages.json", []),
    indexHtml: readFileSync(join(ROOT, "index.html"), "utf8"), env: process.env,
  });
  for (const d of GENERATED_DIRS) rmSync(join(ROOT, d), { recursive: true, force: true });
  for (const [f, c] of Object.entries(files)) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); writeFileSync(join(ROOT, f), c); }
  console.log(`Đã tạo ${Object.keys(files).length - 3} trang SEO, sitemap.xml, robots.txt. Địa chỉ web: ${baseUrl(read("site.json", {}), process.env)}`);
}
