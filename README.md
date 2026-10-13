# Web SoNa (khung)
Web tĩnh, chạy được trên GitHub Pages, Cloudflare Pages hoặc bất kỳ chỗ nào miễn phí.
- `site.json`: tên web, Zalo, email, thông tin NHẬN tiền công khai (mã ngân hàng, số tài khoản, tên). Không bao giờ ghi mật khẩu/OTP.
- `products.json`: mỗi sản phẩm nhà máy ra mắt là 1 mục. Khâu 05 của app SoNa Nhà máy sẽ tự thêm mục vào đây.
- `index.html`: trang chủ liệt kê sản phẩm; trang sản phẩm ở `#sp/<slug>`; nút Mua hiện QR VietQR có sẵn số tiền và mã đơn.
Mọi kênh (Facebook, TikTok, Zalo) sẽ dẫn link về `.../#sp/<slug>`.

## Trang quản trị
- Địa chỉ: `<web>/admin/`. Sửa sản phẩm, ảnh bìa, bài học, thông tin web; bấm Lưu là ghi thẳng vào kho này, khoảng 1 phút sau web cập nhật.
- Đăng nhập bằng mã truy cập GitHub (fine-grained, chỉ kho `sona-web`, quyền Contents: Read and write). Mã chỉ lưu trên máy người quản trị.
- Nút "Dùng thử" mở bằng dữ liệu thật nhưng không lưu gì.
