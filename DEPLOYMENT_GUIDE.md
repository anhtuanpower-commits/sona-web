# Hướng dẫn triển khai web SONA

## Kiến trúc

- Web tĩnh trên **GitHub Pages**, nhánh `main`, thư mục gốc. Không có máy chủ, không có database, không có bước build.
- Dữ liệu: `site.json`, `products.json`, `posts.json`, `pages.json`, thư mục `img/`.
- Admin: `admin/` (gọi GitHub API, xem `ADMIN_USER_GUIDE.md`).
- GitHub Actions `.github/workflows/cap-nhat-web.yml`: mỗi lần `main` đổi thì kiểm tra dữ liệu, chạy kiểm thử, tạo `sp/`, `bai/`, `trang/`, `sitemap.xml`, `robots.txt` và commit lại (tác giả `github-actions[bot]`). Các thư mục `sp/`, `bai/`, `trang/` là file tự sinh, không sửa tay.

## Đưa thay đổi lên web

1. Merge PR vào `main`.
2. GitHub Pages tự đăng lại sau khoảng 1–2 phút.
3. Lần đầu sau khi merge: mở tab **Actions** của kho, xem lượt chạy "Kiểm tra dữ liệu và tạo trang SEO" có dấu xanh.
   - Nếu bước "Lưu trang SEO vào kho" báo lỗi quyền: vào **Settings → Actions → General → Workflow permissions**, chọn **Read and write permissions**, bấm Save, rồi bấm **Re-run jobs**.

## Gắn tên miền riêng

Làm theo tài liệu "Hướng dẫn gắn tên miền cho web SONA" (bản Claude Docs đã gửi). Tóm tắt:

1. Mua tên miền, tạo bản ghi DNS: 4 bản ghi **A** cho `@` trỏ về `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; bản ghi **CNAME** `www` trỏ về `nguyenanhtuansonnam-coder.github.io`.
2. Kho GitHub → **Settings → Pages → Custom domain**: nhập tên miền, Save, đợi kiểm tra xong thì bật **Enforce HTTPS**.
3. Vào Admin → **SEO** → **Địa chỉ web chính thức**: đổi thành `https://tenmien/` rồi lưu, để sitemap, robots.txt và link chia sẻ dùng tên miền mới.
4. Admin mới ở `https://tenmien/admin/`. Mã truy cập không đổi, chỉ cần đăng nhập lại.

Lưu ý: app Lịch Đăng Spa lưu dữ liệu khách trong trình duyệt theo địa chỉ web. Đổi tên miền thì khách phải sao lưu ra file ở địa chỉ cũ rồi nhập lại ở địa chỉ mới.

## Chạy và kiểm tra trên máy

```bash
python3 -m http.server 8000          # mở http://localhost:8000/ và /admin/ (bấm Dùng thử)
npm run kiem-tra                     # kiểm tra dữ liệu
npm test                             # kiểm tra dữ liệu và trang SEO
npm run tao-seo                      # tạo thử trang SEO (không commit các file sinh ra)
npm run test:giao-dien               # kiểm thử trên trình duyệt, cần Playwright
```

## Không làm

- Không dán mã truy cập, mật khẩu, OTP vào bất kỳ file nào trong kho (kho đang công khai). Admin và GitHub Actions đều chặn nếu thấy trong `site.json`.
- Không sửa tay thư mục `sp/`, `bai/`, `trang/`, `sitemap.xml`, `robots.txt`: sẽ bị ghi đè ở lần chạy sau.
