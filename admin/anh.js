/* Xử lý ảnh trước khi tải lên: kiểm tra đúng là ảnh, giới hạn dung lượng, tự thu nhỏ ảnh quá lớn. */
import { bytesB64 } from "./gh.js";

export const MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_SIDE = 1600;
export const ACCEPT = "image/jpeg,image/png,image/webp";
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Nhận diện loại ảnh theo nội dung file (không tin vào đuôi file). */
export function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return "";
}

function loadImg(blob) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const i = new Image(); i.onload = () => { res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Không mở được ảnh này.")); }; i.src = u; });
}

/** Trả về {base64, ext, bytes, width, height, resized}. forceExt: giữ đúng loại ảnh khi thay ảnh cũ. */
export async function prepareImage(file, { forceExt = "" } = {}) {
  if (!file) throw new Error("Chưa chọn ảnh.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Ảnh nặng quá 25 MB, anh chị chọn ảnh khác.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw new Error(`"${file.name}" không phải ảnh JPG, PNG hoặc WEBP. Không nhận file loại khác để giữ an toàn cho web.`);
  const img = await loadImg(file);
  let { naturalWidth: w, naturalHeight: h } = img;
  const outExt = forceExt || kind;
  const needResize = Math.max(w, h) > MAX_SIDE || file.size > MAX_BYTES || outExt !== kind;
  if (!needResize) { URL.revokeObjectURL(img.src); return { base64: bytesB64(buf), ext: kind, bytes: buf.length, width: w, height: h, resized: false }; }
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (outExt === "jpg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src);
  let blob = null;
  for (const q of [0.86, 0.75, 0.62]) {
    blob = await new Promise(r => c.toBlob(r, TYPES[outExt], q));
    if (blob && blob.size <= MAX_BYTES) break;
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error("Ảnh vẫn nặng hơn 1,5 MB sau khi thu nhỏ. Anh chị chọn ảnh khác.");
  const out = new Uint8Array(await blob.arrayBuffer());
  return { base64: bytesB64(out), ext: outExt, bytes: out.length, width: w, height: h, resized: true };
}

/** Tìm nơi đang dùng ảnh: trong dữ liệu web và trong code trang (index.html). */
export function usages(path, data, codeTexts = {}) {
  const out = [];
  const has = v => typeof v === "string" ? v === path || v.includes(path) : v && typeof v === "object" ? Object.values(v).some(has) : false;
  (data.products || []).forEach(p => { if (has(p)) out.push({ ten: "Sản phẩm: " + (p.ten || p.slug), link: "#/san-pham/" + p.slug }); });
  (data.posts || []).forEach(a => { if (has(a)) out.push({ ten: "Bài viết: " + (a.tieu_de || a.slug), link: "#/bai-viet/" + a.slug }); });
  (data.pages || []).forEach(a => { if (has(a)) out.push({ ten: "Trang: " + (a.tieu_de || a.slug), link: "#/trang/" + a.slug }); });
  if (has(data.site || {})) out.push({ ten: "Cấu hình web hoặc trang chủ", link: "#/cau-hinh" });
  Object.entries(codeTexts).forEach(([f, t]) => { if (t && t.includes(path)) out.push({ ten: "Code trang " + f + " (không xóa được trong Admin)", link: "" }); });
  return out;
}
