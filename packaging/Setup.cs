using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Win32;

class Setup : Form {
    static string target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "KeyZone Video Studio");
    static bool silent, noLaunch, testOnly;
    Label title = new Label(); Label description = new Label(); ProgressBar progress = new ProgressBar(); Button install = new Button();
    Setup() {
        Text = "Cài đặt KeyZone Video Studio"; ClientSize = new Size(510, 285); StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; BackColor = Color.FromArgb(18, 19, 30); ForeColor = Color.White;
        title.Text = "KeyZone Video Studio"; title.Font = new Font("Segoe UI", 22, FontStyle.Bold); title.SetBounds(28, 26, 450, 48);
        description.Text = "Tạo video ngay trên máy tính của bạn.\nBộ cài tự chuẩn bị các thành phần cần thiết.\nDữ liệu hiện có được giữ lại khi cập nhật.";
        description.Font = new Font("Segoe UI", 10); description.SetBounds(30, 90, 450, 78);
        progress.SetBounds(30, 185, 450, 12); install.Text = "Cài đặt"; install.SetBounds(330, 220, 150, 38);
        install.BackColor = Color.FromArgb(112, 87, 237); install.ForeColor = Color.White; install.FlatStyle = FlatStyle.Flat;
        Controls.AddRange(new Control[] { title, description, progress, install });
        install.Click += async (s, e) => await Install();
        if (silent) Shown += async (s, e) => { Hide(); await Install(); };
    }
    async Task Install() {
        install.Enabled = false;
        description.Text = "Đang cài đặt… Vui lòng giữ cửa sổ này mở.";
        try {
            await Task.Run(() => Extract());
            if (!testOnly) Register();
            description.Text = "Đã cài đặt xong. Mở KeyZone trên màn hình Desktop\nvà kết nối tài khoản Muse của bạn để bắt đầu.";
            progress.Value = 100; install.Text = "Mở KeyZone"; install.Enabled = true;
            if (silent || noLaunch) { Close(); return; }
            install.Click += (s, e) => { Process.Start(Path.Combine(target, "KeyZone.exe")); Close(); };
            if (!noLaunch) { Process.Start(Path.Combine(target, "KeyZone.exe")); Close(); }
        } catch (Exception error) {
            Environment.ExitCode = 1;
            if (silent) { File.WriteAllText(Path.Combine(Path.GetTempPath(), "keyzone-setup-error.txt"), error.ToString()); Close(); }
            else { MessageBox.Show(error.Message, "Cài đặt chưa hoàn tất", MessageBoxButtons.OK, MessageBoxIcon.Error); install.Enabled = true; }
        }
    }
    void Extract() {
        Directory.CreateDirectory(target);
        string oldStop = Path.Combine(target, "Stop-KeyZone.ps1");
        if (File.Exists(oldStop)) {
            using (Process stop = Process.Start(new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File \"" + oldStop + "\" -InstallRoot \"" + target + "\"") { UseShellExecute = false, CreateNoWindow = true })) { stop.WaitForExit(30000); }
        }
        string temporary = Path.Combine(Path.GetTempPath(), "keyzone-" + Guid.NewGuid().ToString("N") + ".zip");
        try {
            using (FileStream input = File.OpenRead(Application.ExecutablePath)) {
                input.Seek(-48, SeekOrigin.End); byte[] checksum = new byte[32]; input.Read(checksum, 0, 32);
                byte[] bytes = new byte[8]; input.Read(bytes, 0, 8); long length = BitConverter.ToInt64(bytes, 0);
                input.Read(bytes, 0, 8); if (Encoding.ASCII.GetString(bytes) != "KZPAY001" || length <= 0 || length > input.Length - 48) throw new Exception("Bộ cài không hợp lệ.");
                input.Seek(-48 - length, SeekOrigin.End);
                using (FileStream output = File.Create(temporary)) {
                    byte[] block = new byte[1048576]; long remaining = length;
                    while (remaining > 0) { int read = input.Read(block, 0, (int)Math.Min(block.Length, remaining)); if (read == 0) throw new EndOfStreamException(); output.Write(block, 0, read); remaining -= read; }
                }
                using (SHA256 hash = SHA256.Create()) using (FileStream zipped = File.OpenRead(temporary)) {
                    if (!hash.ComputeHash(zipped).SequenceEqual(checksum)) throw new Exception("Bộ cài bị hỏng. Vui lòng tải lại.");
                }
            }
            string prefix = Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            using (ZipArchive archive = ZipFile.OpenRead(temporary)) {
                int count = 0;
                foreach (ZipArchiveEntry entry in archive.Entries) {
                    string file = Path.GetFullPath(Path.Combine(target, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
                    if (!file.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new Exception("Đường dẫn trong bộ cài không hợp lệ.");
                    if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(file); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(file)); entry.ExtractToFile(file, true);
                    int percentage = ++count * 100 / archive.Entries.Count;
                    if (!silent) BeginInvoke(new Action(() => progress.Value = Math.Min(100, percentage)));
                }
            }
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    void Register() {
        string name = "KeyZone Video Studio";
        string key = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyZoneVideoStudio";
        using (RegistryKey entry = Registry.CurrentUser.CreateSubKey(key)) {
            entry.SetValue("DisplayName", name); entry.SetValue("DisplayVersion", "0.7.0"); entry.SetValue("Publisher", "KeyZone");
            entry.SetValue("InstallLocation", target); entry.SetValue("DisplayIcon", Path.Combine(target, "KeyZone.exe"));
            entry.SetValue("UninstallString", "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + Path.Combine(target, "Uninstall-KeyZone.ps1") + "\" -InstallRoot \"" + target + "\"");
            entry.SetValue("NoModify", 1); entry.SetValue("NoRepair", 1);
        }
        Type shellType = Type.GetTypeFromProgID("WScript.Shell"); dynamic shell = Activator.CreateInstance(shellType);
        foreach (string dir in new string[] { Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), name) }) {
            Directory.CreateDirectory(dir); dynamic shortcut = shell.CreateShortcut(Path.Combine(dir, name + ".lnk"));
            shortcut.TargetPath = Path.Combine(target, "KeyZone.exe"); shortcut.WorkingDirectory = target; shortcut.Description = name; shortcut.Save();
            shortcut.IconLocation = Path.Combine(target, "KeyZone.exe") + ",0"; shortcut.Save();
        }
    }
    [STAThread] static void Main(string[] args) {
        silent = args.Any(a => a.Equals("/SILENT", StringComparison.OrdinalIgnoreCase));
        noLaunch = args.Any(a => a.Equals("/NOLAUNCH", StringComparison.OrdinalIgnoreCase));
        testOnly = args.Any(a => a.Equals("/TEST", StringComparison.OrdinalIgnoreCase));
        foreach (string arg in args) if (arg.StartsWith("/DIR=", StringComparison.OrdinalIgnoreCase)) target = Path.GetFullPath(arg.Substring(5));
        Application.EnableVisualStyles(); Application.Run(new Setup());
    }
}
