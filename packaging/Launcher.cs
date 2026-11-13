using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;

class Launcher : Form {
    Label status = new Label();
    Launcher() {
        Text = "KeyZone Video Studio"; Width = 440; Height = 170;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; BackColor = Color.FromArgb(18, 19, 30);
        status.Text = "Đang mở KeyZone Video Studio…"; status.ForeColor = Color.White;
        status.Font = new Font("Segoe UI", 12); status.AutoSize = false; status.Dock = DockStyle.Fill;
        status.TextAlign = ContentAlignment.MiddleCenter; Controls.Add(status);
        Shown += async (s, e) => await StartApp();
    }
    async Task StartApp() {
        try {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            ProcessStartInfo info = new ProcessStartInfo(Path.Combine(root, "runtime", "node", "node.exe"), "\"" + Path.Combine(root, "launcher.mjs") + "\"");
            info.WorkingDirectory = root; info.UseShellExecute = false; info.CreateNoWindow = true;
            info.RedirectStandardOutput = true; info.RedirectStandardError = true;
            using (Process process = Process.Start(info)) {
                Task<string> output = process.StandardOutput.ReadToEndAsync();
                Task<string> errors = process.StandardError.ReadToEndAsync();
                await Task.Run(() => process.WaitForExit());
                string result = await output; string detail = await errors;
                if (process.ExitCode != 0) throw new Exception(result + "\n" + detail);
            }
            Close();
        } catch (Exception error) {
            MessageBox.Show(error.Message, "Chưa mở được KeyZone", MessageBoxButtons.OK, MessageBoxIcon.Warning); Close();
        }
    }
    [STAThread] static void Main() { Application.EnableVisualStyles(); Application.Run(new Launcher()); }
}
