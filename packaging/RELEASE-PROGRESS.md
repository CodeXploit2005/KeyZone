# Release status — 2026-11-12

Windows 0.7.0: release-build/KeyZone-Video-Studio-Setup-0.7.0.exe
305738184 bytes; SHA256 37ea7b2c6380424538712e8b851651821dd4d3919b775759bb2a7aa49886fac4.
Actual isolated install, clean database, pages, thumbnail and final video rendering passed. QA instances stopped. Recipient data is stored separately in LocalAppData. No publisher accounts or private data included.

Android 0.7.0-beta.1: android-build/KeyZone-Video-Studio-0.7.0-beta1-Android.apk
70292728 bytes; SHA256 f89db861eaf20ecddc7101706dff97beaede5758c105982abd50383b604ac8d3.
Native standalone app: local SQLite, encrypted sessions, separate Muse WebView, native FFmpeg rendering and export/share. Built and signature verified; responsive UI checked; native library 16KB alignment checked. NOT yet tested end to end with Muse on a physical Android device. Label as beta; do not claim verified Windows parity.

Final supplied logo: C:/Users/DungTran/Downloads/K tím trên ô vuông trắng.png. Applied to installer, launcher, desktop shortcut, APK launcher/adaptive icons, mobile UI and download website. No artwork redesign.

Android release signing key and password remain private under android/signing (ignored). Keep a private backup to sign future updates; never publish these files.

Website: release-site/.openai/hosting.json binds appgprj_6af5a7e453a081918f255fc6d94621af. Never create another Site for this checkout. Both manifests and all download chunks reconstruct exact files above. Public audience authorized by user's request to let others download. Source helper publication currently in progress; check final deployment result before reporting a live URL.
