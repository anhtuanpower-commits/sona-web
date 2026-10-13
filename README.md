# Web SoNa (khung)
Web tĩnh, chạy được trên GitHub Pages, Cloudflare Pages hoặc bất kỳ chỗ nào miễn phí.
- `site.json`: tên web, Zalo, email, thông tin NHẬN tiền công khai (mã ngân hàng, số tài khoản, tên). Không bao giờ ghi mật khẩu/OTP.
- `products.json`: mỗi sản phẩm nhà máy ra mắt là 1 mục. Khâu 05 của app SoNa Nhà máy sẽ tự thêm mục vào đây.
- `index.html`: trang chủ liệt kê sản phẩm; trang sản phẩm ở `#sp/<slug>`; nút Mua hiện QR VietQR có sẵn số tiền và mã đơn.
Mọi kênh (Facebook, TikTok, Zalo) sẽ dẫn link về `.../#sp/<slug>`.

## Giao diện SONA AI (đặc tả V1.0)
- Các trang: trang chủ `#`, sản phẩm `#san-pham`, chi tiết `#sp/<slug>`, Học AI `#hoc`, Cộng đồng `#cong-dong`, Hỗ trợ `#ho-tro` (link cũ `#thong-tin` vẫn chạy).
- Màu, chữ, khoảng cách, bo góc, bóng đổ: khối `:root` đầu `index.html`.
- `products.json`: thêm được `loai_hien_thi` (nhãn loại), `mo_ta_ngan` (mô tả trên thẻ), `ten_ngan`, `sap_ra_mat: true` (hiện nhãn Sắp ra mắt, khóa nút Mua). Giá gạch ngang chỉ hiện khi `gia_niem_yet` lớn hơn `so_tien`.
- `site.json` > `trang_chu`: `noi_bat` (3 sản phẩm ở trang chủ), `video` (link video giới thiệu), `chi_so` (vd `{"so":"1.200+","nhan":"Người dùng"}`), `danh_gia` (vd `{"ten":"…","thong_tin":"…","noi_dung":"…","sao":5,"anh":"img/…"}`). Chỉ điền số liệu và đánh giá THẬT. `hien_mau: false` để ẩn các ô mẫu.
