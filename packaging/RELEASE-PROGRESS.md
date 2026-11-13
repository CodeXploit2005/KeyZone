# Windows 0.7.6 and admin confirmations — 2026-11-14

Fixed session-dependent React resume/hydration failures by disabling partial prerendering for the dynamic application shell. Workspace checks have bounded deadlines, report busy/disconnected states and always release the checking UI. Muse Chrome startup is serialized and reuses a stable debugging port/profile. Chat errors no longer trigger duplicate long retries.
A real saved Muse session reached a ready workspace in 5.11 seconds; one short diagnostic prompt received its response in 9.84 seconds. Full video/script generation duration still depends on Muse.
Restored the missing confirmation dialog used by revoke, reset-devices and delete. All three actions and cancellation passed browser tests against an isolated in-memory database; server suite 11/11 passed. Production accounts navigation/reload showed no React 418/resume errors; busy and timeout controls recovered.
Windows installer: 305334538 bytes; SHA256 edceb95a3aab17c934b144b73a55d33d0e61dda20f469607a3e4f897e65a83c1. Includes updated Python bridge files. Android remains 0.7.5-beta.1. The removed portal announcement stays removed.

# Windows 0.7.5 and Android 0.7.5-beta.1 — 2026-11-14

Windows hides FFmpeg/ffprobe consoles with windowsHide while preserving stdout/stderr and failure reporting. Actual two-clip merge passed and output duration/audio were verified. The bundled worker includes the hidden-process option.
Android uses in-process FFmpegKit inside JobService; no external console/activity is launched. FFmpeg calls now suppress banners and non-error logs, including hardware-codec fallback. APK compiled, signature matched the previous release and native alignment verified. Physical Android rendering remains untested.
Windows installer: 305639568 bytes; SHA256 6c25c43783915e09394e7688b74d3fef51b71a421aa19fee2636717ea127099e.
Android APK: 70309112 bytes; SHA256 a051d38ce3e1bbae6c3045db84999a3cadc9636c195e5241a11d70e17d032cf1.
The verbose portal announcement removed at the user's request stays removed.

# Windows 0.7.4 and single-device policy — 2026-11-13

Installer: release-build/KeyZone-Video-Studio-Setup-0.7.4.exe; 305639476 bytes; SHA256 db610748a3ef0c2e88a6ba0f18235ce801cbbc5101eff2424b71253d4dc8f5fd.
Actual isolated installation: original PNG logo delivery and application/API gates passed.
Production app against isolated real PostgreSQL and in-memory license API: saved activation survives absent/stale cookies, reload and process restart; a verified protected HTML document contains no activation form; a second device is denied without evicting the first; spoofed UI-state headers are overwritten; revocation blocks saved sessions. UI SSR test also passed.
Server suite: new and legacy multi-device key limits, concurrent activations, expiry/revocation and key migration passed. Admin mobile topbar position y=0 at 390px, fixed device count and logout verified in browser. Screenshot: ui-previews/admin-mobile-top-fixed.jpg.
Permissions-Policy warnings could not be reproduced: portal/admin responses contain no such header and the tested admin browser console showed none. No third-party security headers were removed.

# Windows 0.7.3 and Android 0.7.3-beta.1 — 2026-11-13

Windows: release-build/KeyZone-Video-Studio-Setup-0.7.3.exe
305699999 bytes; SHA256 0ef26f3fe4e24d50443e37087dcd59963a44e9bb7dcdc1d212809c44bdf5ce6c.
Rebuilt from current source with the /brand/ proxy exemption. Actual isolated installation passed: logo returns image/png with original bytes, without redirect, for vi/en and query strings; app and API still require activation. Report: release-build/qa-logo-0.7.3.json. Does not modify the user's existing installation or project data.

Android: android-build/KeyZone-Video-Studio-0.7.3-beta1-Android.apk
70309112 bytes; SHA256 b8bb4453c0d420a624e817b5b7f454a756254925c11ffa0cff38d28122a00748.
Includes native online activation, encrypted session persistence, expiry and revocation checks, device release and PNG logo MIME fix. Signature matches previous Android beta; versionCode 8. Java policy and UI tests passed. Physical-device and live-key testing remain outstanding.

Portal static build passed. Both download manifests reconstruct the new artifacts exactly. Publication checkout API/UI suite: 10/10 passed. Preserves the existing admin redesign.

# Windows 0.7.1 — 2026-11-13

Release: release-build/KeyZone-Video-Studio-Setup-0.7.1.exe
305697173 bytes; SHA256 4728cb643dea61a7998e467ad4eda497e58e88a38df2719a416530d54560cdf8.
License endpoint: https://keyzone-6laz.onrender.com

Actual isolated installer exited 0. Installed app and API are blocked before key activation. A temporary key issued on live Render/Turso activated the installed studio. Revoking it invalidated the existing session and blocked studio entry. Deleting it removed the key/session. Full-key copy worked against the live server and in browser clipboard QA. Temporary remote key was deleted; isolated QA processes stopped.

Report: release-build/qa-license-data-071/license-qa-report.json
Gate screenshot: ui-previews/windows-license-0.7.1.jpg
9 server/unit test groups passed, including legacy database migration and atomic session deletion. Download parts reconstruct the exact installer hash. Android remains the older build without key enforcement.

Previous release notes follow.

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
