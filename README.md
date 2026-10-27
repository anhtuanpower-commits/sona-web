# Web SoNa (khung)
Web tĩnh, chạy được trên GitHub Pages, Cloudflare Pages hoặc bất kỳ chỗ nào miễn phí.
- `site.json`: tên web, Zalo, email, thông tin NHẬN tiền công khai (mã ngân hàng, số tài khoản, tên). Không bao giờ ghi mật khẩu/OTP.
- `products.json`: mỗi sản phẩm nhà máy ra mắt là 1 mục. Khâu 05 của app SoNa Nhà máy sẽ tự thêm mục vào đây.
- `index.html`: trang chủ liệt kê sản phẩm; trang sản phẩm ở `#sp/<slug>`; nút Mua hiện QR VietQR có sẵn số tiền và mã đơn.
Mọi kênh (Facebook, TikTok, Zalo) sẽ dẫn link về `.../#sp/<slug>`.

## Trang quản trị

Vào `…/admin/` để sửa trang chủ, sản phẩm, bài viết, trang riêng, ảnh, liên hệ và SEO mà không cần sửa code.
- Hướng dẫn dùng: `ADMIN_USER_GUIDE.md`
- Kiến trúc và phạm vi: `ADMIN_IMPLEMENTATION_PLAN.md`
- Triển khai, tên miền: `DEPLOYMENT_GUIDE.md`
- Tình trạng: `PROJECT_STATUS.md`
