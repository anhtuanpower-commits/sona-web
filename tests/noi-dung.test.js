import { test } from "node:test";
import assert from "node:assert/strict";
import { upsert, removeBy } from "../admin/noi-dung.js";

const original = { slug: "bai-cu", tieu_de: "Bài cũ", noi_dung: "Nội dung" };
const changed = { ...original, tieu_de: "Bài đã sửa" };
const other = { slug: "bai-tu-dong", tieu_de: "Bài tự động" };
const conflict = fn => assert.throws(fn, e => e.status === 409);

test("sửa bài giữ nguyên bài tự động vừa được thêm", () => {
  assert.deepEqual(upsert(original, changed)([structuredClone(original), other]), [changed, other]);
});
test("chặn ghi đè và xóa nếu cùng nội dung đã được người khác sửa", () => {
  conflict(() => upsert(original, changed)([{ ...original, noi_dung: "Người khác sửa" }]));
  conflict(() => removeBy(original)([{ ...original, noi_dung: "Người khác sửa" }]));
});
test("không tự tạo lại bài đã bị xóa hoặc đổi đường dẫn", () => {
  conflict(() => upsert(original, changed)([other]));
  conflict(() => removeBy(original)([other]));
});
test("chặn trùng đường dẫn khi thêm hoặc đổi tên, cho phép xóa bản chưa đổi", () => {
  conflict(() => upsert(null, original)([original]));
  conflict(() => upsert(original, { ...changed, slug: other.slug })([original, other]));
  assert.deepEqual(removeBy(original)([original, other]), [other]);
});
