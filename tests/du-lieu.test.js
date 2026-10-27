import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kiemTra, checkProduct, checkPost, checkPage, checkSite, slugify } from "../admin/kiem-tra.js";
import { build, baseUrl } from "../scripts/tao-trang-seo.js";

const read = f => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const real = { site: read("site.json"), products: read("products.json"), posts: read("posts.json"), pages: read("pages.json") };
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const goodProduct = { slug: "a", ten: "A", phu_de: "x", anh_bia: "img/a.jpg", goi: [{ ten: "G", so_tien: 100000 }] };

test("dữ liệu thật trong kho không có lỗi", () => {
  assert.deepEqual(kiemTra(real).filter(i => i.loi), []);
});
test("slugify bỏ dấu tiếng Việt", () => {
  assert.equal(slugify("Lịch Đăng Spa: Hết Lo!"), "lich-dang-spa-het-lo");
});
test("sản phẩm thiếu tên, giá, trùng đường dẫn bị chặn", () => {
  const loi = p => checkProduct(p, { products: [p, goodProduct] }).filter(i => i.loi).map(i => i.truong);
  assert.ok(loi({ ...goodProduct, ten: "" }).includes("ten"));
  assert.ok(loi({ ...goodProduct, slug: "b", goi: [{ so_tien: 0 }] }).includes("goi.0.so_tien"));
  assert.ok(loi({ ...goodProduct }).includes("slug"));
  assert.ok(loi({ ...goodProduct, slug: "b", goi: [{ so_tien: 100, gia_niem_yet: 50 }] }).includes("goi.0.gia_niem_yet"));
  assert.ok(loi({ ...goodProduct, slug: "b", anh_bia: "javascript:alert(1)" }).includes("anh_bia"));
});
test("bài viết sai ngày, nháp không cần nội dung", () => {
  assert.ok(checkPost({ slug: "x", tieu_de: "X", ngay: "27/10/2026", noi_dung: "a" }).some(i => i.loi && i.truong === "ngay"));
  assert.deepEqual(checkPost({ slug: "x", tieu_de: "X", ngay: "2026-10-27", trang_thai: "nhap", tom_tat: "t" }).filter(i => i.loi), []);
  assert.ok(checkPost({ slug: "x", tieu_de: "X", ngay: "2026-10-27", tom_tat: "t" }).some(i => i.loi && i.truong === "noi_dung"));
});
test("trang không được dùng tên hệ thống", () => {
  assert.ok(checkPage({ slug: "admin", tieu_de: "A", noi_dung: "x" }).some(i => i.loi && i.truong === "slug"));
});
test("cấu hình chặn mật khẩu, mã truy cập, link không an toàn", () => {
  assert.ok(checkSite({ ten_web: "S", mat_khau: "123" }).some(i => i.loi));
  assert.ok(checkSite({ ten_web: "S", ghi_chu: "github_pat_11ABC" }).some(i => i.loi));
  assert.ok(checkSite({ ten_web: "S", mang_xa_hoi: { facebook: "javascript:x" } }).some(i => i.loi));
  assert.ok(checkSite({ ten_web: "S", trang_chu: { nut_link: "javascript:x" } }).some(i => i.loi));
  assert.deepEqual(checkSite(real.site).filter(i => i.loi), []);
});
test("tạo trang SEO cho sản phẩm, bài đã xuất bản; bỏ qua nháp và sản phẩm ẩn", () => {
  const files = build({
    site: { ...real.site, seo: { dia_chi_web: "https://sona.vn/", mo_ta: "Mô tả" } },
    products: [goodProduct, { ...goodProduct, slug: "an", an: true }],
    posts: [{ slug: "b1", tieu_de: "Bài <1>", tom_tat: "Tóm", ngay: "2026-10-01" }, { slug: "nhap", tieu_de: "N", trang_thai: "nhap" }],
    pages: [{ slug: "gioi-thieu", tieu_de: "Giới thiệu", noi_dung: "Xin chào" }],
    indexHtml,
  });
  assert.ok(files["sp/a/index.html"]); assert.ok(!files["sp/an/index.html"]);
  assert.ok(files["bai/b1/index.html"]); assert.ok(!files["bai/nhap/index.html"]);
  assert.ok(files["trang/gioi-thieu/index.html"]);
  const b = files["bai/b1/index.html"];
  assert.match(b, /<base href="\.\.\/\.\.\/">/);
  assert.match(b, /<title>Bài &lt;1&gt; · SONA<\/title>/);
  assert.match(b, /og:url" content="https:\/\/sona\.vn\/bai\/b1\/"/);
  assert.match(b, /window\.SONA_ROUTE="bai\/b1"/);
  assert.match(files["sitemap.xml"], /<loc>https:\/\/sona\.vn\/bai\/b1\/<\/loc><lastmod>2026-10-01<\/lastmod>/);
  assert.match(files["robots.txt"], /Disallow: \/admin\//);
  assert.equal(files["index.html"].replace(/<!--seo:dau-->[\s\S]*?<!--seo:cuoi-->/, ""), indexHtml.replace(/<!--seo:dau-->[\s\S]*?<!--seo:cuoi-->/, ""));
});
test("địa chỉ web mặc định theo kho GitHub", () => {
  assert.equal(baseUrl({}, { GITHUB_REPOSITORY: "Chu/sona-web" }), "https://chu.github.io/sona-web/");
  assert.equal(baseUrl({ seo: { dia_chi_web: "https://sona.vn" } }), "https://sona.vn/");
});
