# KeyZone · Download portal & license admin

Website tải Windows/Android, trang quản trị key và API xác minh dùng chung một dịch vụ Render.

[Triển khai trên Render](https://render.com/deploy?repo=https://github.com/CodeXploit2005/KeyZone)

## Triển khai

1. Mở liên kết trên, kết nối GitHub và chọn repo này. Render đọc `render.yaml`.
2. Đặt `KEYZONE_ADMIN_PASSWORD` riêng, ít nhất 16 ký tự. Không đưa mật khẩu vào GitHub.
3. Kiểm tra gói **Starter và disk 1 GB có phí** trước khi tạo dịch vụ. Disk giữ cơ sở dữ liệu qua các lần deploy; không chuyển sang ổ tạm.
4. Khi deploy thành công, mở URL Render cung cấp: `/` là trang tải, `/admin` là quản trị. Đăng nhập bằng mật khẩu đã đặt.
5. URL máy chủ tự lấy từ `RENDER_EXTERNAL_URL`. Nếu dùng tên miền riêng, đặt `KEYZONE_PUBLIC_URL=https://ten-mien-cua-ban` và truy cập admin qua đúng tên miền đó.

Render chỉ chạy máy chủ cấp key và website. Video và tài khoản Muse tiếp tục chạy/lưu trên thiết bị khách.

## Trạng thái bộ cài — cần đọc

Các tệp tải **0.7.0 hiện tại là bản cũ, chưa có khóa key**; website ghi rõ điều này. Mã nguồn Windows trong `keyzone/keyzone-studio` đã được thêm màn hình kích hoạt và kiểm tra quyền. **Chưa phát hành bộ cài mới**, vì cần URL Render thật sau lần triển khai đầu tiên. APK hiện tại cũng chưa được tích hợp key.

Sau khi có URL Render, người phát hành cần build và thay bộ cài Windows kèm manifest tải xuống; khách đã cài bản cũ cần cập nhật. Không thể khóa từ xa những bản cũ chưa tích hợp cơ chế kiểm tra key.

Quy trình trong workspace Windows gốc:

```powershell
$env:KEYZONE_LICENSE_URL='https://URL-RENDER-THAT.onrender.com'
python packaging/build-release.py
```

Script build yêu cầu URL HTTPS và ghi `license-config.json` vào bộ cài. Repo này lưu mã nguồn phục vụ tham khảo và tiếp tục phát triển, không kèm runtime Node/Python/Postgres nặng hoặc dữ liệu cá nhân để build Windows độc lập. Script đóng gói vẫn cần workspace Windows có runtime tương ứng như bản trước.

## Quản lý key

- Tạo key với khách hàng, ngày giờ hết hạn và giới hạn thiết bị. Key đầy đủ chỉ hiện một lần; hãy sao chép trước khi đóng.
- Thu hồi: các lần xác minh sau bị từ chối. Form ứng dụng kiểm tra mỗi 20 giây, khi lấy lại focus và khóa khi hết hạn. API và mỗi tác vụ nền mới kiểm tra trực tuyến riêng. Tác vụ đã chạy có thể hoàn tất; chưa có cơ chế hủy giữa chừng.
- Gia hạn/sửa cũng khôi phục key đã thu hồi. Gỡ thiết bị buộc các máy nhập lại key.
- Mất mạng hoặc máy chủ không truy cập được: khóa quyền sử dụng, không có chế độ dùng offline.
- Thiết bị dùng mã ngẫu nhiên lưu trong thư mục dữ liệu; cài lại/xóa dữ liệu sẽ tính là máy mới. Đây chưa phải fingerprint phần cứng chống giả mạo.
- Key và token chỉ lưu dạng SHA-256 ở máy chủ; phiên quản trị dùng cookie HttpOnly, giới hạn thử mật khẩu và kiểm tra Origin. Chỉ sao lưu DB qua kênh riêng, không đưa vào Git.
- Mã chạy trên máy khách có thể bị sửa bởi người có toàn quyền máy. Cơ chế này kiểm soát các bản cài nguyên gốc; không cam kết chống crack tuyệt đối.

## Chạy thử

Node.js 24.14 trở lên, nhánh 24.x. Máy chủ không cần dependency ngoài.

```powershell
$env:KEYZONE_ADMIN_PASSWORD='mat-khau-rieng-dai-it-nhat-16-ky-tu'
$env:KEYZONE_SITE_DIR='./release-site/dist'
npm start
```

Mở `http://127.0.0.1:4320` và `/admin`. Chạy `npm test` để kiểm tra API, `npm run build` để xác minh toàn bộ tệp tải bằng SHA-256. Sửa web bằng `npm install` và `npm run build` trong `release-site`, rồi commit lại `dist`. Đầu ra web được lưu trong Git để Render chạy trực tiếp mà không cần cài Next.js.

Kiến trúc: ứng dụng Windows → HTTPS `/v1/activate`, `/v1/verify` → SQLite trên disk Render ← `/admin`.
