# Kế hoạch và phạm vi Admin SONA

Cập nhật: 27/10/2026. Đã được anh Tuấn duyệt làm toàn bộ theo phương án A.

## Kiến trúc đã chọn: GitHub là nơi lưu dữ liệu

Web SONA là web tĩnh trên GitHub Pages, không có máy chủ riêng. Dữ liệu nằm trong các file của kho `anhtuanpower-commits/sona-web`:

| File | Nội dung |
|---|---|
| `site.json` | Tên web, logo, liên hệ, mạng xã hội, chân trang, nhận tiền, trang chủ (`trang_chu`), trang Thông tin (`thong_tin`), SEO mặc định (`seo`) |
| `products.json` | Sản phẩm |
| `posts.json` | Bài viết (quy trình bài học tự động cũng thêm vào đây) |
| `pages.json` | Trang riêng tạo trong Admin |
| `img/` | Ảnh |

Admin (`admin/`) là trang tĩnh, gọi GitHub API để đọc và ghi các file trên.

- **Xác thực và phân quyền ở máy chủ**: GitHub kiểm tra mã truy cập và quyền của tài khoản trên kho ở mọi lệnh ghi. Không có quyền Write thì GitHub trả lỗi 403, dù có mở được giao diện.
- **Không có mật khẩu mặc định** trong code. Tài khoản đầu tiên là tài khoản GitHub chủ kho; mã truy cập do chủ kho tự tạo và chỉ lưu trên máy của họ.
- **Dữ liệu bền vững, có lịch sử**: mỗi lần lưu là một commit trên GitHub. localStorage chỉ dùng cho phiên đăng nhập (khi chọn ghi nhớ) và bản xem trước tạm.
- **Không ghi đè người khác**: khi lưu, Admin đọc bản mới nhất trên GitHub, áp đúng thay đổi của mục đang sửa (theo đường dẫn) rồi ghi, kèm kiểm tra phiên bản (sha). Bài học tự động vừa thêm dữ liệu sẽ không bị mất.
- **Kiểm tra dữ liệu hai lớp**: Admin chặn dữ liệu sai trước khi lưu (`admin/kiem-tra.js`); GitHub Actions chạy lại cùng luật sau mỗi lần dữ liệu đổi (`scripts/kiem-tra-du-lieu.js`), có lỗi thì báo đỏ và gửi email cho chủ kho.
- **Không đổi schema phá dữ liệu**: chỉ thêm trường mới, không xóa hay đổi tên trường cũ. Web công khai đọc trường mới, để trống thì giữ đúng giao diện cũ.

Phương án B (dựng backend và database trên VPS) không chọn vì phải viết lại cách web lấy dữ liệu, tốn phí và công bảo trì, phải sửa quy trình bài học tự động, và đổi địa chỉ web làm mất dữ liệu khách của app Lịch Đăng Spa.

## Danh sách TASK

| # | TASK | Trạng thái |
|---|---|---|
| 0 | PR #1: chữ nhỏ thoáng, vuốt ngang sản phẩm, Admin bản đầu | Chờ merge (gộp chung PR này) |
| 1 | Khung Admin mới: sidebar, thanh trên, breadcrumb, tìm kiếm, thông báo, trạng thái tải, responsive | Xong |
| 2 | Đăng nhập, đăng xuất, kiểm tra quyền thật, chặn khi chưa đăng nhập, không lộ mã | Xong |
| 3 | Kiểm tra dữ liệu dùng chung cho Admin và GitHub Actions | Xong |
| 4 | Tổng quan: số liệu thật, cảnh báo thật, lịch sử cập nhật, tình trạng đăng web, thao tác nhanh | Xong |
| 5 | Trang chủ và Cấu hình web (logo, favicon, liên hệ, chân trang, nhận tiền), ẩn/hiện khối | Xong |
| 6 | Sản phẩm: ẩn/hiện, ảnh minh họa, nội dung chi tiết, SEO, thứ tự, xem trước | Xong |
| 7 | Bài viết: nháp/xuất bản, ảnh đại diện, SEO, trình soạn có thanh nút, xem trước | Xong |
| 8 | Trang riêng `pages.json`, đường dẫn `#trang/<slug>`, link chân trang; trang Thông tin sửa được | Xong |
| 9 | Thư viện ảnh: tải lên, thay, xóa có kiểm tra đang dùng, chặn file không phải ảnh, tự thu nhỏ | Xong |
| 10 | SEO: trang riêng cho từng sản phẩm, bài, trang; sitemap.xml; robots.txt (GitHub Actions) | Xong |
| 11 | Kiểm thử tự động: 8 kiểm tra dữ liệu, 15 kịch bản trên trình duyệt | Xong |
| 12 | Tài liệu | Xong |

## Ngoài phạm vi, chờ anh quyết định

- **Biểu mẫu liên hệ (mục H)**: web hiện chỉ nhận liên hệ qua Zalo, hotline, email. Web tĩnh không tự lưu được thông tin khách gửi lên; nếu cần, có hai cách: Google Form đổ về Google Sheet, hoặc Cloudflare Worker có chống spam.
- **Đăng nhập một chạm bằng GitHub**: cần thêm máy chủ nhỏ (Cloudflare Worker) giữ khóa bí mật của ứng dụng.
- **Phân quyền chi tiết hơn** (ví dụ người biên tập không được sửa tài khoản nhận tiền): GitHub chỉ phân quyền theo cả kho, nên muốn chi tiết hơn cần máy chủ riêng.
