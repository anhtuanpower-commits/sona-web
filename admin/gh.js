/* Kết nối GitHub: đọc và ghi dữ liệu web.
   GitHub là nơi lưu dữ liệu và cũng là nơi kiểm tra quyền: mọi lệnh ghi đều do máy chủ GitHub
   xác thực mã truy cập và quyền của tài khoản trên kho. Mã truy cập không bao giờ được in ra màn hình hay log. */

export const REPO = (() => {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  const p = location.pathname.split("/").filter(Boolean);
  if (m && p[0] && p[0] !== "admin") return { owner: m[1], repo: p[0] };
  if (m) return { owner: m[1], repo: m[1] + ".github.io" };
  return { owner: "anhtuanpower-commits", repo: "sona-web" };
})();
export const BRANCH = "main";
export const FILES = { site: "site.json", products: "products.json", posts: "posts.json", pages: "pages.json" };
const EMPTY = { site: () => ({}), products: () => [], posts: () => [], pages: () => [] };

let TOKEN = "";
export let DEMO = false;
export const setToken = t => { TOKEN = t || ""; };
export const setDemo = v => { DEMO = !!v; };
export const DATA = { site: {}, products: [], posts: [], pages: [] };

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
const MSG = {
  401: "Phiên đăng nhập đã hết hạn hoặc mã truy cập không đúng. Anh chị đăng nhập lại.",
  403: "Tài khoản hoặc mã truy cập này chưa có quyền làm việc này trên kho web.",
  404: "Không tìm thấy dữ liệu trên GitHub, hoặc mã truy cập chưa được cấp quyền cho kho web.",
  409: "Dữ liệu vừa được sửa ở nơi khác.",
  422: "GitHub không nhận dữ liệu gửi lên.",
};

export async function gh(path, opt = {}) {
  let r;
  try {
    r = await fetch("https://api.github.com/" + path, {
      ...opt, cache: "no-store",
      headers: { Accept: "application/vnd.github+json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}), ...(opt.headers || {}) },
    });
  } catch (e) { throw new ApiError("Không kết nối được GitHub. Anh chị kiểm tra mạng rồi thử lại.", 0); }
  if ((r.status === 403 || r.status === 429) && r.headers.get("x-ratelimit-remaining") === "0")
    throw new ApiError("GitHub đang tạm giới hạn số lần truy cập. Anh chị đợi vài phút rồi thử lại.", 429);
  if (!r.ok) throw new ApiError(MSG[r.status] || `GitHub báo lỗi (mã ${r.status}). Anh chị thử lại sau.`, r.status);
  return r.status === 204 ? null : r.json();
}
export const repo = p => `repos/${REPO.owner}/${REPO.repo}${p ? "/" + p : ""}`;
const enc = encodeURIComponent;
const pathUrl = p => p.split("/").map(enc).join("/");

export const b64 = str => bytesB64(new TextEncoder().encode(str));
export function bytesB64(bytes) { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); }
export const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\n/g, "")), c => c.charCodeAt(0)));

/* ---------- tài khoản ---------- */
export async function whoAmI() {
  const user = await gh("user");
  const info = await gh(repo());
  const p = info.permissions || {};
  const role = p.admin || p.maintain ? "quan-tri" : p.push ? "bien-tap" : p.pull ? "chi-xem" : "";
  if (!role) throw new ApiError("Tài khoản này chưa được cấp quyền vào kho web.", 403);
  return { login: user.login, name: user.name || user.login, avatar: user.avatar_url, role, privateRepo: !!info.private };
}
export const ROLE_NAME = { "quan-tri": "Quản trị", "bien-tap": "Biên tập", "chi-xem": "Chỉ xem", demo: "Dùng thử" };

/* ---------- dữ liệu JSON ---------- */
async function readJson(file) {
  let j;
  try { j = await gh(repo(`contents/${pathUrl(file)}?ref=${BRANCH}`)); }
  catch (e) { if (e.status === 404) return { data: null, sha: null }; throw e; }
  let text;
  if (j.content) text = unb64(j.content);
  else { const blob = await gh(repo(`git/blobs/${j.sha}`)); text = unb64(blob.content); } // file lớn hơn 1MB
  try { return { data: JSON.parse(text), sha: j.sha }; }
  catch (e) { throw new ApiError(`File ${file} trên GitHub đang hỏng định dạng. Cần sửa file này trước.`, 422); }
}

export async function loadAll() {
  for (const k in FILES) {
    if (DEMO) {
      try { const r = await fetch("../" + FILES[k], { cache: "no-cache" }); DATA[k] = r.ok ? await r.json() : EMPTY[k](); }
      catch (e) { DATA[k] = EMPTY[k](); }
    } else {
      const { data } = await readJson(FILES[k]);
      DATA[k] = data ?? EMPTY[k]();
    }
  }
}

/** Ghi một file JSON: đọc bản mới nhất trên GitHub, áp thay đổi lên đó rồi ghi.
    Nhờ vậy bài học tự động hoặc người khác vừa thêm dữ liệu sẽ không bị ghi đè. */
export async function commit(key, mutate, message) {
  if (DEMO) { const next = mutate(structuredClone(DATA[key])) ?? DATA[key]; DATA[key] = next; return { demo: true }; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, sha } = await readJson(FILES[key]);
    const fresh = data ?? EMPTY[key]();
    const next = mutate(fresh) ?? fresh;
    if (key === "site" ? typeof next !== "object" || Array.isArray(next) : !Array.isArray(next)) throw new ApiError("Dữ liệu không đúng dạng, chưa lưu.", 422);
    try {
      const r = await gh(repo(`contents/${FILES[key]}`), { method: "PUT", body: JSON.stringify({ message, content: b64(JSON.stringify(next, null, 2) + "\n"), branch: BRANCH, ...(sha ? { sha } : {}) }) });
      DATA[key] = next;
      return r.commit;
    } catch (e) { if (e.status === 409 || (e.status === 422 && attempt < 2)) continue; throw e; }
  }
  throw new ApiError("Dữ liệu đang được sửa liên tục ở nơi khác. Anh chị đợi một chút rồi lưu lại.", 409);
}

/* ---------- ảnh ---------- */
export const rawUrl = p => `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${BRANCH}/${pathUrl(p)}`;
export async function listImages() {
  const t = await gh(repo(`git/trees/${BRANCH}?recursive=1`));
  return t.tree.filter(x => x.type === "blob" && /^img\/.+\.(jpe?g|png|webp|gif|svg|ico)$/i.test(x.path)).map(x => ({ path: x.path, size: x.size, sha: x.sha }));
}
export async function fileSha(path) {
  try { return (await gh(repo(`contents/${pathUrl(path)}?ref=${BRANCH}`))).sha; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
export async function putBinary(path, base64, message, sha) {
  if (DEMO) return { demo: true };
  return gh(repo(`contents/${pathUrl(path)}`), { method: "PUT", body: JSON.stringify({ message, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
}
export async function deleteFile(path, sha, message) {
  if (DEMO) return { demo: true };
  return gh(repo(`contents/${pathUrl(path)}`), { method: "DELETE", body: JSON.stringify({ message, sha, branch: BRANCH }) });
}

/* ---------- trạng thái web ---------- */
export const recentCommits = () => gh(repo(`commits?sha=${BRANCH}&per_page=8`));
export const pagesBuild = () => gh(repo("pages/builds/latest"));
export const lastRun = () => gh(repo(`actions/workflows/cap-nhat-web.yml/runs?branch=${BRANCH}&per_page=1`));
