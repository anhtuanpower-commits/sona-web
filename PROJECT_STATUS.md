# Tình trạng dự án web SONA

Cập nhật: 27/10/2026

## Đã xong (nằm trong PR #1, lên web thật khi merge)

**Web công khai**
- Giữ nguyên giao diện đen vàng; chữ nhỏ và thoáng hơn.
- Trang chủ hiện từng sản phẩm, vuốt ngang; có nút "Xem thêm", sản phẩm sau ló ra, hiệu ứng lắc nhẹ.
- Đọc thêm nội dung sửa từ Admin: mô tả, banner, nút kêu gọi, ẩn/hiện ô tìm kiếm và bộ lọc, chân trang, logo, favicon, địa chỉ, trang Thông tin, các bước mua.
- Sản phẩm ẩn và bài nháp không hiện; trang riêng `#trang/<slug>`; ảnh minh họa và phần chi tiết sản phẩm; ảnh đại diện bài viết; link và ảnh trong nội dung.
- Chế độ xem trước (`?preview=1`) cho Admin.

**Admin `/admin/`**: Tổng quan, Trang chủ, Trang, Sản phẩm, Bài viết, Thư viện ảnh, Cấu hình web, SEO, Hướng dẫn. Chi tiết trong `ADMIN_USER_GUIDE.md`.

**Tự động trên GitHub** (`.github/workflows/cap-nhat-web.yml`): kiểm tra dữ liệu và tạo trang SEO, `sitemap.xml`, `robots.txt` sau mỗi lần dữ liệu thay đổi.

## Kiểm thử đã chạy

- `npm test`: 8/8 kiểm tra dữ liệu và trang SEO đạt, gồm cả dữ liệu thật trong kho.
- `node tests/giao-dien.e2e.js`: 15/15 kịch bản trên Chromium đạt, GitHub được giả lập ghi vào bản sao web: chặn khi chưa đăng nhập, mã sai, tài khoản chỉ xem, API ghi không quyền bị 403/401, đăng nhập/đăng xuất, tạo/sửa/xóa trang, nháp/xuất bản bài, tạo/ẩn/hiện/sửa giá sản phẩm, kiểm tra dữ liệu, tải ảnh và chặn file giả, banner trang chủ, cấu hình liên hệ, không ghi đè bài tự động, xem trước, trang SEO, giao diện điện thoại và máy tính bảng không tràn ngang.
- Dự án không có bước build hay type-check (HTML, CSS, JavaScript thuần).

## Chưa kiểm được trong môi trường dựng

- Gọi GitHub thật bằng mã truy cập thật: cần anh đăng nhập thử sau khi merge.
- Lần chạy đầu của GitHub Actions trên kho thật (tạo trang SEO, gửi lệnh dựng lại GitHub Pages).

## Chưa làm, chờ quyết định

Xem mục "Ngoài phạm vi" trong `ADMIN_IMPLEMENTATION_PLAN.md`: biểu mẫu liên hệ, đăng nhập một chạm, phân quyền chi tiết. Gắn tên miền riêng: xem `DEPLOYMENT_GUIDE.md`.
