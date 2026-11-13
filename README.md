# KeyZone · Download portal & license admin

Website tải Windows/Android, trang quản trị key và API xác minh dùng chung một dịch vụ **Render Free**, lưu dữ liệu trên **Turso Free**. Không cần mua disk hoặc chọn gói trả phí. Các gói miễn phí có hạn mức của nhà cung cấp.

[Triển khai trên Render](https://render.com/deploy?repo=https://github.com/CodeXploit2005/KeyZone)

## Triển khai

1. Tạo tài khoản và database ở [Turso](https://turso.tech/), giữ gói Free. Lấy Database URL và Database Auth Token có quyền đọc/ghi của database đó (không dùng API token quản lý toàn tài khoản).
2. Mở liên kết triển khai Render ở trên, kết nối GitHub và chọn repo này. Blueprint đã chọn `plan: free`, không tạo disk. Nếu tạo Web Service thủ công: Node, branch `main`, Singapore, Root Directory trống, Build Command `npm run build`, Start Command `npm start`, Compute Free, Health Check `/healthz`.
3. Nhập ENV như mẫu dưới đây. Thay các placeholder trong giao diện Environment của Render; không commit mật khẩu/token thật vào GitHub.
4. Khi deploy thành công, mở URL Render cung cấp: `/` là trang tải, `/admin` là quản trị. Database tự tạo bảng ở lần truy cập API đầu tiên.
5. URL máy chủ tự lấy từ `RENDER_EXTERNAL_URL`. Nếu dùng tên miền riêng, đặt `KEYZONE_PUBLIC_URL=https://ten-mien-cua-ban` và truy cập admin qua đúng tên miền đó.

```dotenv
NODE_VERSION=24.14.1
HOST=0.0.0.0
KEYZONE_SITE_DIR=./release-site/dist
KEYZONE_ADMIN_PASSWORD=your-private-password-at-least-12-characters
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-database-read-write-token
```

URL `https://...turso.io` hoặc `turso://...turso.io` cũng được hỗ trợ. Xóa `KEYZONE_LICENSE_DB` cũ trên Render để tránh nhầm lẫn; khi có Turso, dữ liệu không lưu ở ổ cục bộ. Máy chủ từ chối khởi động trên Render nếu thiếu URL/token, tránh việc tạo key rồi mất khi restart. Key đang nằm trong SQLite cũ không tự chuyển lên Turso; bản triển khai mới bắt đầu với database Turso bạn chọn.

Theo [Render Free](https://render.com/docs/free), dịch vụ ngủ sau 15 phút không có yêu cầu; lần mở tiếp theo có thể chờ khoảng một phút. Trong lúc chưa kết nối được API, ứng dụng vẫn khóa theo chính sách xác minh trực tuyến và tự thử lại. Dữ liệu key nằm ở Turso nên không mất khi Render ngủ/redeploy. Phiên đăng nhập admin cần đăng nhập lại sau khi Render restart. Turso Free có hạn mức: theo dõi Usage và giữ gói Free nếu không muốn phát sinh chi phí. Không dùng Render Postgres Free cho dữ liệu key lâu dài vì database đó hết hạn sau 30 ngày.

Render chỉ chạy máy chủ cấp key và website. Video và tài khoản Muse tiếp tục chạy/lưu trên thiết bị khách.

## Bộ cài Windows 0.7.2 có kích hoạt key

Windows 0.7.2 đã có form nhập key trước khi vào studio và trỏ tới `https://keyzone-6laz.onrender.com`. Bản 0.7.0 cũ chưa có bản quyền: người đang dùng cần tải bộ cài mới trên website và cài cập nhật. Installer giữ dữ liệu dự án tại thư mục dữ liệu riêng, không cần gỡ bản cũ trước. APK hiện tại chưa tích hợp key.

Key được xác minh qua API khi vào ứng dụng, khi gọi API/tác vụ mới và mỗi 20 giây trong giao diện. Key hết hạn, bị thu hồi hoặc bị xóa sẽ bị chặn; không có chế độ offline. Tác vụ đang chạy có thể hoàn tất.

Build trong workspace Windows có đủ runtime:

```powershell
$env:KEYZONE_LICENSE_URL='https://keyzone-6laz.onrender.com'
python packaging/build-release.py
```

Build dùng font local và biên dịch Tailwind trước để không phụ thuộc Google Fonts lúc đóng gói. Script yêu cầu URL HTTPS, không kèm mật khẩu admin/token Turso trong bộ cài. Mã nguồn và giấy phép font được lưu trong repo; runtime Python/Postgres/FFmpeg không được đưa vào Git dưới dạng mã nguồn, nhưng có trong bộ cài được chia thành các phần tải đã xác minh SHA-256.

## Quản lý key

Giao diện quản trị có bố cục desktop và mobile. Trên điện thoại, chuyển giữa Danh sách key và Tạo key bằng thanh điều hướng phía dưới; mỗi key hiển thị thành thẻ có nút gia hạn, thu hồi, gỡ máy.

Thời hạn có thể chọn nhanh, tự nhập số ngày/giờ hoặc gõ ngày cụ thể theo `DD/MM/YYYY HH:mm` (múi giờ thiết bị). Trong cửa sổ gia hạn, có thể gõ ngày mới hoặc cộng thêm 7/30/90 ngày. Ô Key tùy chọn cho phép tự đặt mã 16–80 ký tự (chữ, số, dấu gạch ngang); mã được chuẩn hóa thành chữ hoa và từ chối nếu trùng. Để trống thì hệ thống vẫn sinh key ngẫu nhiên.

- Tạo key với khách hàng, ngày giờ hết hạn và giới hạn thiết bị. Key tạo từ bản mới có nút Sao chép để lấy lại toàn bộ mã. Key cũ chỉ lưu hash nên không thể khôi phục; cần tạo key thay thế.
- Thu hồi: các lần xác minh sau bị từ chối. Form ứng dụng kiểm tra mỗi 20 giây, khi lấy lại focus và khóa khi hết hạn. API và mỗi tác vụ nền mới kiểm tra trực tuyến riêng. Tác vụ đã chạy có thể hoàn tất; chưa có cơ chế hủy giữa chừng.
- Gia hạn/sửa cũng khôi phục key đã thu hồi. Gỡ thiết bị buộc các máy nhập lại key.
- Mất mạng hoặc máy chủ không truy cập được: khóa quyền sử dụng, không có chế độ dùng offline.
- Thiết bị dùng mã ngẫu nhiên lưu trong thư mục dữ liệu; cài lại/xóa dữ liệu sẽ tính là máy mới. Đây chưa phải fingerprint phần cứng chống giả mạo.
- Token và bản xác minh key lưu SHA-256; bản sao key mới được mã hóa AES-256-GCM để quản trị viên sao chép lại; phiên quản trị dùng cookie HttpOnly, giới hạn thử mật khẩu và kiểm tra Origin. Chỉ sao lưu DB qua kênh riêng, không đưa vào Git.
- Mã chạy trên máy khách có thể bị sửa bởi người có toàn quyền máy. Cơ chế này kiểm soát các bản cài nguyên gốc; không cam kết chống crack tuyệt đối.

## Chạy thử

Node.js 24.14 trở lên, nhánh 24.x. Máy chủ không cần dependency ngoài.

```powershell
$env:KEYZONE_ADMIN_PASSWORD='mat-khau-rieng-dai-it-nhat-12-ky-tu'
$env:KEYZONE_SITE_DIR='./release-site/dist'
npm start
```

Mở `http://127.0.0.1:4320` và `/admin`. Chạy `npm test` để kiểm tra API, `npm run build` để xác minh toàn bộ tệp tải bằng SHA-256. Sửa web bằng `npm install` và `npm run build` trong `release-site`, rồi commit lại `dist`. Đầu ra web được lưu trong Git để Render chạy trực tiếp mà không cần cài Next.js.

Kiến trúc: ứng dụng Windows → HTTPS `/v1/activate`, `/v1/verify` → Render Free → Turso Free; quản trị viên điều khiển qua `/admin` trên cùng web Render.

## Kiểm tra bản Free

Bộ kiểm thử chạy API với SQLite thật tại máy và fixture mô phỏng giao thức Turso HTTP để kiểm tra tham số, kết quả số/ngày giờ, thu hồi/hết hạn, lỗi database và giới hạn thiết bị khi kích hoạt đồng thời. Chưa xác minh trên database Turso thật khi chưa có cấu hình tài khoản. Sau khi nhập ENV trên Render, hãy tạo một key, kích hoạt máy thử, thu hồi rồi restart dịch vụ để xác nhận dữ liệu trên tài khoản thật.

Nút Xóa xóa key và mọi phiên kích hoạt trong cùng một thao tác database, không thể dùng lại key đã xóa. Mã hóa key sử dụng `KEYZONE_KEY_SECRET` nếu có, mặc định dùng mật khẩu admin hiện tại. Khi đổi mật khẩu admin, đặt `KEYZONE_KEY_SECRET` bằng giá trị đã dùng trước đó để tiếp tục giải mã key; giữ bí mật này riêng trên Render. Không thể khôi phục key cũ vốn chỉ lưu hash.

Bộ cài 0.7.2 sửa lỗi cập nhật khi phiên cũ còn giữ `libvips-42.dll`: chạy script dừng đã xác minh từ chính bộ cài, chờ tiến trình kết thúc, dừng cài đặt nếu preflight thất bại và thử lại khi có khóa tệp ngắn hạn. Chỉ dừng tiến trình có executable nằm trong đúng thư mục cài KeyZone. Không xóa dữ liệu dự án.
