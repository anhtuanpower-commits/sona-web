// Kiểm tra site.json, products.json, posts.json, pages.json trước khi web cập nhật.
// Chạy: node scripts/kiem-tra-du-lieu.js  (thoát mã 1 nếu có lỗi phải sửa)
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { kiemTra } from "../admin/kiem-tra.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const data = {};
let broken = false;
for (const [k, f] of [["site", "site.json"], ["products", "products.json"], ["posts", "posts.json"], ["pages", "pages.json"]]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) { data[k] = k === "site" ? {} : []; continue; }
  try { data[k] = JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { console.error(`LỖI  ${f}: không đọc được JSON (${e.message})`); broken = true; }
}
if (broken) process.exit(1);

const images = new Set();
const walk = d => readdirSync(d).forEach(n => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : images.add(relative(ROOT, p).split("\\").join("/")); });
if (existsSync(join(ROOT, "img"))) walk(join(ROOT, "img"));

const issues = kiemTra(data, images);
const loi = issues.filter(i => i.loi), canhBao = issues.filter(i => !i.loi);
for (const i of loi) console.error(`LỖI       ${i.file}.json ${i.slug ? "[" + i.slug + "] " : ""}${i.msg}`);
for (const i of canhBao) console.log(`CẢNH BÁO  ${i.file}.json ${i.slug ? "[" + i.slug + "] " : ""}${i.msg}`);
console.log(`\n${data.products.length} sản phẩm, ${data.posts.length} bài viết, ${data.pages.length} trang, ${images.size} ảnh. ${loi.length} lỗi, ${canhBao.length} cảnh báo.`);
process.exit(loi.length ? 1 : 0);
