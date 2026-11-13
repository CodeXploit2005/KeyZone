import React from "react";
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Film,
  Flag,
  Link2,
  List,
  Pencil,
  Play,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { StudioShowcase } from "@/components/StudioShowcase";
import { DownloadCenter } from "@/components/DownloadCenter";

const FAQ_ITEMS = [
  {
    q: "Key kích hoạt hoạt động như thế nào?",
    a: "Bản Windows và Android yêu cầu key còn hiệu lực và kết nối Internet. Quản trị viên cấp thời hạn, số thiết bị và có thể thu hồi key từ xa. Windows 0.7.5 và Android 0.7.5-beta.1 có form nhập key và đồng bộ thời hạn với máy chủ quản lý bản quyền.",
  },
  {
    q: "Tôi có cần tài khoản Muse không?",
    a: "Có. Mỗi người kết nối tài khoản Muse của riêng mình trong ứng dụng. KeyZone không cung cấp sẵn tài khoản và không thay đổi giới hạn hoặc quyền sử dụng do Muse áp dụng.",
  },
  {
    q: "Video và dự án được lưu ở đâu?",
    a: "Trực tiếp trên thiết bị của bạn, trong thư mục dữ liệu KeyZone của ứng dụng hoặc tài khoản Windows. Muse vẫn xử lý các yêu cầu tạo nội dung được gửi đến dịch vụ của họ.",
  },
  {
    q: "Có dùng được trên điện thoại hoặc macOS không?",
    a: "Có bản APK thử nghiệm dành cho Android 10 trở lên, chạy độc lập trên điện thoại. Bản Android cần được kiểm tra thêm trên thiết bị thật. Hiện chưa có bộ cài cho macOS.",
  },
  {
    q: "Tính năng giọng đọc và dịch vụ khác thì sao?",
    a: "Các dịch vụ tùy chọn như ElevenLabs hoặc AI Gateway cần khóa API của riêng bạn và có thể có phí từ nhà cung cấp. Các khóa của người phát hành không được kèm trong bộ cài.",
  },
  {
    q: "Cài lại có làm mất dự án không?",
    a: "Trên Windows, bộ gỡ cài đặt giữ lại thư mục dữ liệu riêng. Trên Android, gỡ ứng dụng sẽ xóa dữ liệu nội bộ; video đã lưu ra thư viện vẫn được giữ. Hãy lưu các video quan trọng trước khi gỡ hoặc đổi máy.",
  },
];

export default function ReleasePage() {
  return (
    <div className="min-h-screen text-slate-100">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0b081d]/85">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <a
            href="#"
            aria-label="KeyZone Video Studio"
            className="group inline-flex items-center gap-3"
          >
            <img
              src="./keyzone-icon.png"
              alt=""
              width={36}
              height={36}
              className="rounded-xl shadow-md transition-transform duration-200 group-hover:scale-105"
            />
            <span className="flex flex-col leading-none">
              <span className="text-xl font-extrabold tracking-tight text-white">
                KeyZone
              </span>
              <span className="mt-1 font-mono text-[9px] font-semibold tracking-[0.22em] text-violet-300">
                VIDEO STUDIO
              </span>
            </span>
          </a>

          <nav aria-label="Điều hướng" className="flex items-center gap-8 text-sm">
            <a href="/admin" className="hidden font-medium text-violet-300 transition hover:text-white md:inline">Quản trị key</a>
            <a
              href="#features"
              className="hidden font-medium text-slate-200 transition hover:text-white sm:inline"
            >
              Tính năng
            </a>
            <a
              href="#start"
              className="hidden font-medium text-slate-200 transition hover:text-white sm:inline"
            >
              Cách bắt đầu
            </a>
            <a
              href="#faq"
              className="hidden font-medium text-slate-200 transition hover:text-white md:inline"
            >
              Giải đáp
            </a>
            <a
              href="#download"
              className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#6344e6] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition hover:brightness-110"
            >
              <span>Tải xuống</span>
              <Download className="h-3.5 w-3.5" />
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO SECTION (Matches Reference Image 2) */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-12 pb-20 lg:grid-cols-[1fr_1.12fr] lg:pt-16 lg:pb-24">
          <div className="animate-enter max-w-xl">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-fuchsia-400/35 bg-violet-950/60 px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-violet-100 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <span>STUDIO CỦA BẠN • TRÊN MÁY CỦA BẠN</span>
              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                v0.7.5
              </span>
            </div>

            <h1 className="mt-6 text-5xl leading-[1.06] font-extrabold tracking-tight text-white sm:text-6xl lg:text-[68px]">
              Từ ý tưởng
              <br />
              đến{" "}
              <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                thước phim.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-violet-100/85">
              Viết kịch bản có cấu trúc, giữ nhân vật xuyên suốt và dựng video hoàn chỉnh trong một nơi. Cài KeyZone, kết nối Muse và bắt đầu sáng tạo ngay trên thiết bị của bạn.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <a
                href="#download"
                className="btn-sheen inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-fuchsia-500/25 transition hover:-translate-y-0.5"
              >
                <Download className="h-4 w-4" />
                <span>Tải KeyZone ngay</span>
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-950/45 px-5 py-3.5 text-sm font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-900/50"
              >
                <span>Xem tính năng</span>
              </a>
            </div>

            <p className="mt-5 flex flex-wrap items-center gap-2.5 text-xs text-violet-200/75">
              <span className="font-semibold text-white">Windows 10 / 11 (64-bit)</span>
              <span>•</span>
              <span>
                Android 10+ <em className="not-italic text-amber-300">(thử nghiệm)</em>
              </span>
            </p>
          </div>

          <div className="animate-enter" style={{ animationDelay: "100ms" }}>
            <StudioShowcase />
          </div>
        </section>

        {/* FEATURES SECTION (Matches Reference Image 3 Top Half) */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-[#1e163b] px-3.5 py-1.5 text-xs font-semibold text-violet-200">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              Một không gian sáng tạo
            </span>
            <h2 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-5xl">
              Nhiều thời gian{" "}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                làm video.
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
              Từ những dòng kịch bản đầu tiên đến file hoàn chỉnh, KeyZone giữ tất cả các bước làm việc liền mạch trong cùng một giao diện.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <article className="card-lift flex flex-col justify-between rounded-2xl border border-white/12 bg-[#121124]/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/35 bg-[#251b4a] text-violet-300">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400">
                    01 / LÊN Ý TƯỞNG
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-white">Kịch bản có cấu trúc</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                  Chọn ngách nội dung, viết hoặc nhập kịch bản và điều chỉnh từng phân cảnh trước khi bấm máy tạo video.
                </p>
              </div>

              <div className="mt-6 space-y-2 text-xs">
                <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#6c47ff] to-[#5835d4] px-3.5 py-2.5 font-semibold text-white shadow-md">
                  <Pencil className="h-3.5 w-3.5 text-violet-200" />
                  <span>Mở đầu câu chuyện</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#18172b] px-3.5 py-2.5 text-slate-300">
                  <List className="h-3.5 w-3.5 text-slate-400" />
                  <span>Phát triển nội dung</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#18172b] px-3.5 py-2.5 text-slate-300">
                  <Flag className="h-3.5 w-3.5 text-slate-400" />
                  <span>Chốt thông điệp</span>
                </div>
              </div>
            </article>

            {/* Feature 2 */}
            <article className="card-lift flex flex-col justify-between rounded-2xl border border-white/12 bg-[#121124]/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/35 bg-[#132842] text-sky-300">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400">
                    02 / TẠO HÌNH ẢNH
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-white">Nhân vật xuyên suốt</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                  Quản lý hồ sơ nhân vật và ảnh tham chiếu để đảm bảo hình ảnh đồng nhất qua mọi cảnh trong dự án.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-[#18172b] p-3.5">
                <img
                  src="./scene-01.jpg"
                  alt="Nhân vật tham chiếu"
                  className="h-16 w-24 flex-shrink-0 rounded-lg object-cover shadow-md"
                />
                <div>
                  <span className="inline-block rounded border border-sky-400/30 bg-sky-500/20 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-sky-300">
                    IDENTITY LOCK
                  </span>
                  <p className="mt-1.5 text-xs leading-snug text-slate-200">
                    Một diễn viên –
                    <br />
                    Nhiều câu chuyện mới.
                  </p>
                </div>
              </div>
            </article>

            {/* Feature 3 */}
            <article className="card-lift flex flex-col justify-between rounded-2xl border border-white/12 bg-[#121124]/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/35 bg-[#251b4a] text-violet-300">
                    <Film className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400">
                    03 / HOÀN THIỆN
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-white">Dựng và xuất video</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                  Tạo cảnh với Muse, ghép nhạc, hiệu ứng và xuất file MP4 để tiếp tục chỉnh sửa hoặc đăng tải.
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-[#18172b] p-4">
                <div className="grid grid-cols-4 gap-2">
                  <span className="flex h-9 items-center justify-center rounded-lg bg-[#6c47ff] font-mono text-[11px] font-bold text-white shadow">
                    SC 16:9
                  </span>
                  <span className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#121122] font-mono text-[11px] font-medium text-slate-200">
                    SC 9:16
                  </span>
                  <span className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#121122] font-mono text-[11px] font-medium text-slate-200">
                    SC 1:1
                  </span>
                  <span className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#121122] text-[11px] font-medium text-slate-200">
                    Custom
                  </span>
                </div>
                <div className="mt-3.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Tùy chọn chất lượng:</span>
                  <span className="font-semibold text-slate-200">
                    MP4 &nbsp;·&nbsp; FFmpeg &nbsp;·&nbsp; GIF
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* HOW TO START SECTION (Matches Reference Image 3 Bottom Half) */}
        <section id="start" className="border-t border-white/8 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-3 font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
                <span className="h-0.5 w-6 bg-violet-400" />
                BẮT ĐẦU THẬT GỌN
              </p>
              <h2 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl">
                Cài xong. Kết nối.{" "}
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Sáng tạo.
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
                Bộ cài chuẩn bị sẵn tất cả các thành phần cần thiết. Bạn không phải tự cài đặt Node.js, Python, FFmpeg hay cơ sở dữ liệu.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {["Node.js Runtime", "PostgreSQL 18", "FFmpeg Native", "Muse Bridge"].map(
                  tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-[#1e1738] px-3.5 py-1.5 text-xs font-medium text-slate-200"
                    >
                      <Check className="h-3.5 w-3.5 text-violet-300" />
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            <ol className="space-y-3.5">
              {[
                {
                  step: "01.",
                  icon: Download,
                  title: "Tải và cài KeyZone",
                  desc: "Chọn bản Windows hoặc Android, mở file cài đặt và làm theo hướng dẫn tự động.",
                },
                {
                  step: "02.",
                  icon: Link2,
                  title: "Kết nối tài khoản Muse",
                  desc: "Mở ứng dụng KeyZone, vào mục Tài khoản và đăng nhập tài khoản Muse.",
                },
                {
                  step: "03.",
                  icon: Play,
                  title: "Tạo dự án đầu tiên",
                  desc: "Chọn ngách nội dung, chuẩn bị kịch bản, duyệt các cảnh và bắt đầu tạo video.",
                },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.step}
                    className="card-lift flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#121124]/90 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-[#231b42] text-violet-300">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          <span className="mr-1.5 text-violet-400">{item.step}</span>
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-violet-400/70" />
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* DOWNLOAD COMMAND CENTER (Matches Reference Image 1) */}
        <section id="download" className="mx-auto max-w-5xl px-6 py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-[#1e163b] px-3.5 py-1.5 text-xs font-semibold text-violet-200">
              <TrendingUp className="h-3.5 w-3.5 text-violet-300" />
              Cập nhật &amp; ổn định
            </span>
            <h2 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight text-white sm:text-5xl">
              Studio sẵn sàng.
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Đến lượt ý tưởng của bạn.
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Tải phiên bản phù hợp và bắt đầu ngay trên thiết bị của bạn. Mỗi gói cài đặt đều được tự động xác thực mã kiểm tra SHA-256.
            </p>
          </div>

          <DownloadCenter />
        </section>

        {/* FAQ SECTION */}
        <section
          id="faq"
          className="mx-auto grid max-w-6xl gap-10 border-t border-white/8 px-6 py-20 lg:grid-cols-[0.9fr_1.35fr] lg:gap-16"
        >
          <div>
            <p className="font-mono text-xs font-bold tracking-widest text-violet-400 uppercase">
              TRƯỚC KHI BẮT ĐẦU
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl">
              Một vài điều
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                bạn muốn biết.
              </span>
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Thông tin minh bạch về cách KeyZone lưu trữ dữ liệu và kết nối tài khoản.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <details
                key={item.q}
                open={idx === 0}
                className="group rounded-2xl border border-white/10 bg-[#121124]/90 p-5 shadow-lg transition hover:border-violet-400/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-white">
                  <span>{item.q}</span>
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-violet-300/30 bg-violet-500/15 text-xs text-violet-200 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/8 bg-[#080614]/90 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-400">
          <a href="#" className="inline-flex items-center gap-2.5">
            <img
              src="./keyzone-icon.png"
              alt=""
              width={26}
              height={26}
              className="rounded-lg"
            />
            <span className="font-bold text-white">KeyZone Video Studio</span>
          </a>
          <p>Một không gian cho câu chuyện của bạn.</p>
          <a
            href="#download"
            className="font-semibold text-violet-300 transition hover:text-white"
          >
            Tải KeyZone ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
