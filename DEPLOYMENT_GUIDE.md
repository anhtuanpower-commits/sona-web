# Hướng dẫn triển khai web SONA

## Kiến trúc

- Kho hiện có cả **GitHub Pages** và tích hợp **Cloudflare Pages**. Các lần kiểm tra trên `main` ghi nhận cả hai; nhánh PR có bản xem trước Cloudflare. Không đổi hosting hoặc DNS khi cập nhật mã.
- Web tĩnh, dữ liệu ở thư mục gốc nhánh `main`. Không có máy chủ ứng dụng hoặc database.
- Dữ liệu: `site.json`, `products.json`, `posts.json`, `pages.json`, thư mục `img/`.
- Admin: `admin/` (gọi GitHub API, xem `ADMIN_USER_GUIDE.md`).
- GitHub Actions `.github/workflows/cap-nhat-web.yml`: mỗi lần `main` đổi thì kiểm tra dữ liệu, chạy kiểm thử, tạo `sp/`, `bai/`, `trang/`, `sitemap.xml`, `robots.txt` và commit lại (tác giả `github-actions[bot]`). Các thư mục `sp/`, `bai/`, `trang/` là file tự sinh, không sửa tay.

## Đưa thay đổi lên web

1. Merge PR vào `main`.
2. GitHub Pages và tích hợp Cloudflare Pages sẽ xử lý thay đổi theo cấu hình hiện có. Kiểm tra thêm trạng thái **Cloudflare Pages** trên commit và mở tên miền thật `https://sona.ai.vn/`.
3. Lần đầu sau khi merge: mở tab **Actions** của kho, xem lượt chạy "Kiểm tra dữ liệu và tạo trang SEO" có dấu xanh.
   - Nếu bước "Lưu trang SEO vào kho" báo lỗi, đọc log để phân biệt lỗi quyền, xung đột cập nhật hoặc yêu cầu dựng Pages thất bại. Workflow chỉ cập nhật các trang SEO đã sinh, thử tối đa 3 lần từ `main` mới nhất và báo đỏ nếu chưa hoàn tất.
   - Đợi cả workflow kiểm tra dữ liệu lẫn **pages build and deployment** thành công rồi kiểm tra web thật. Thời gian xuất bản có thể tới 10 phút; không xem việc merge xong là đã đăng web xong.

## Gắn tên miền riêng

Làm theo tài liệu "Hướng dẫn gắn tên miền cho web SONA" (bản Claude Docs đã gửi). Tóm tắt:

1. Mua tên miền, tạo bản ghi DNS: 4 bản ghi **A** cho `@` trỏ về `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; bản ghi **CNAME** `www` trỏ về `anhtuanpower-commits.github.io`.
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

Nếu máy đã có Chromium ở đường dẫn riêng, đặt biến môi trường `PLAYWRIGHT_EXECUTABLE_PATH` trỏ tới file thực thi rồi chạy kiểm thử. Không còn phụ thuộc đường dẫn Chromium cố định của Linux.

## Không làm

- Không dán mã truy cập, mật khẩu, OTP vào bất kỳ file nào trong kho (kho đang công khai). Admin và GitHub Actions đều chặn nếu thấy trong `site.json`.
- Không sửa tay thư mục `sp/`, `bai/`, `trang/`, `sitemap.xml`, `robots.txt`: sẽ bị ghi đè ở lần chạy sau.
