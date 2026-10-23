using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Windows.Forms;

namespace ARTAX200Control
{
    internal static class ARTAX200ControlApp
    {
        private const string AppExeName = "artax core.exe";
        private const string CoreFolderName = "core";

        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length > 0)
            {
                RunCommand(args[0]);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ControlForm());
        }

        internal static string StartApp()
        {
            List<Process> running = GetRunningAppProcesses();
            if (running.Count > 0)
            {
                return "ARTAX-200 is already running. PID: " + JoinProcessIds(running);
            }

            string appPath = GetAppPath();
            if (!File.Exists(appPath))
            {
                throw new FileNotFoundException("ARTAX-200 engine was not found in the same folder as this app.", appPath);
            }

            var info = new ProcessStartInfo
            {
                FileName = appPath,
                WorkingDirectory = Path.GetDirectoryName(appPath),
                UseShellExecute = false,
                CreateNoWindow = true
            };

            Process process = Process.Start(info);
            if (process == null)
            {
                throw new InvalidOperationException("ARTAX-200 could not be started.");
            }

            return "ARTAX-200 started. PID: " + process.Id;
        }

        internal static string StopApp()
        {
            List<Process> running = GetRunningAppProcesses();
            if (running.Count == 0)
            {
                return "ARTAX-200 is already stopped.";
            }

            foreach (Process process in running)
            {
                try
                {
                    process.Kill();
                    process.WaitForExit(10000);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Could not stop PID " + process.Id + ": " + ex.Message, ex);
                }
            }

            return "ARTAX-200 stopped.";
        }

        internal static string RestartApp()
        {
            StopApp();
            return StartApp().Replace("started", "restarted");
        }

        internal static string GetStatusText()
        {
            List<Process> running = GetRunningAppProcesses();
            if (running.Count == 0)
            {
                return "ARTAX-200 status: Stopped";
            }

            return "ARTAX-200 status: Running. PID: " + JoinProcessIds(running);
        }

        internal static string GetEngineUrl()
        {
            Dictionary<string, string> env = ReadBackendEnv();
            string host = GetLocalIPv4Address();
            string port = env.ContainsKey("PORT") ? env["PORT"] : "8200";

            return "http://" + host + ":" + port + "/";
        }

        private static void RunCommand(string command)
        {
            string normalized = command.Trim().ToLowerInvariant();

            switch (normalized)
            {
                case "start":
                    StartApp();
                    break;
                case "stop":
                    StopApp();
                    break;
                case "restart":
                    RestartApp();
                    break;
                case "status":
                    GetStatusText();
                    break;
                default:
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    Application.Run(new ControlForm());
                    break;
            }
        }

        private static string GetAppPath()
        {
            return Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, CoreFolderName, AppExeName));
        }

        private static Dictionary<string, string> ReadBackendEnv()
        {
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string envPath = GetBackendEnvPath();

            if (!File.Exists(envPath))
            {
                return values;
            }

            foreach (string rawLine in File.ReadAllLines(envPath))
            {
                string line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith("#"))
                {
                    continue;
                }

                int separatorIndex = line.IndexOf('=');
                if (separatorIndex <= 0)
                {
                    continue;
                }

                string key = line.Substring(0, separatorIndex).Trim();
                string value = line.Substring(separatorIndex + 1).Trim().Trim('"');
                values[key] = value;
            }

            return values;
        }

        private static string GetBackendEnvPath()
        {
            string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            string localEnvPath = Path.GetFullPath(Path.Combine(baseDirectory, ".env"));
            if (File.Exists(localEnvPath))
            {
                return localEnvPath;
            }

            return Path.GetFullPath(Path.Combine(baseDirectory, "..", ".env"));
        }

        private static string GetLocalIPv4Address()
        {
            try
            {
                foreach (IPAddress address in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
                {
                    if (address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(address))
                    {
                        return address.ToString();
                    }
                }
            }
            catch
            {
            }

            return "localhost";
        }

        private static List<Process> GetRunningAppProcesses()
        {
            string expectedPath = GetAppPath();
            string processName = Path.GetFileNameWithoutExtension(AppExeName);
            var matches = new List<Process>();

            foreach (Process process in Process.GetProcessesByName(processName))
            {
                try
                {
                    string actualPath = Path.GetFullPath(process.MainModule.FileName);
                    if (string.Equals(actualPath, expectedPath, StringComparison.OrdinalIgnoreCase))
                    {
                        matches.Add(process);
                    }
                }
                catch
                {
                    process.Dispose();
                }
            }

            return matches;
        }

        private static string JoinProcessIds(List<Process> processes)
        {
            var ids = new List<string>();
            foreach (Process process in processes)
            {
                ids.Add(process.Id.ToString());
            }

            return string.Join(", ", ids.ToArray());
        }
    }

    internal sealed class ControlForm : Form
    {
        private static readonly Color AppBackground = Color.FromArgb(246, 248, 251);
        private static readonly Color HeaderBackground = Color.FromArgb(18, 42, 67);
        private static readonly Color TextPrimary = Color.FromArgb(32, 45, 57);
        private static readonly Color TextMuted = Color.FromArgb(101, 116, 130);
        private static readonly Color BorderColor = Color.FromArgb(218, 226, 236);
        private static readonly Color RunningColor = Color.FromArgb(31, 122, 77);
        private static readonly Color StoppedColor = Color.FromArgb(186, 72, 72);

        private readonly Label statusLabel;
        private readonly Label statusDetailLabel;
        private readonly Panel statusStripe;
        private readonly TextBox outputBox;
        private readonly Button startButton;
        private readonly Button stopButton;
        private readonly Button restartButton;
        private readonly Button refreshButton;
        private readonly Timer statusTimer;

        public ControlForm()
        {
            Text = "ARTAX-200 Controller";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(680, 470);
            Size = new Size(760, 520);
            Font = new Font("Segoe UI", 9F);
            BackColor = AppBackground;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4,
                Padding = new Padding(20),
                BackColor = AppBackground
            };
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            var headerPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Height = 86,
                BackColor = HeaderBackground,
                Padding = new Padding(22, 14, 22, 14),
                Margin = new Padding(0, 0, 0, 16)
            };

            var titleLabel = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 18F, FontStyle.Bold),
                ForeColor = Color.White,
                Text = "ARTAX-200 Controller",
                Location = new Point(22, 14)
            };

            var subtitleLabel = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 9.5F, FontStyle.Regular),
                ForeColor = Color.FromArgb(207, 216, 226),
                Text = "Start, stop, and monitor the local ARTAX-200 engine",
                Location = new Point(24, 52)
            };

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            var statusPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Height = 92,
                BackColor = Color.White,
                Padding = new Padding(18, 14, 18, 14),
                Margin = new Padding(0, 0, 0, 16)
            };
            statusPanel.Paint += DrawPanelBorder;

            statusStripe = new Panel
            {
                Dock = DockStyle.Left,
                Width = 6,
                BackColor = BorderColor
            };

            var statusCaptionLabel = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 8F, FontStyle.Bold),
                ForeColor = TextMuted,
                Text = "ENGINE STATUS",
                Location = new Point(22, 15)
            };

            statusLabel = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 15F, FontStyle.Bold),
                ForeColor = TextPrimary,
                Text = "Checking...",
                Location = new Point(20, 34)
            };

            statusDetailLabel = new Label
            {
                AutoSize = true,
                ForeColor = TextMuted,
                Text = "Waiting for status refresh",
                Location = new Point(22, 65)
            };

            outputBox = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                ForeColor = TextPrimary,
                Font = new Font("Consolas", 9F),
                Margin = new Padding(0)
            };

            var outputPanel = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                BackColor = AppBackground,
                Margin = new Padding(0, 0, 0, 14)
            };
            outputPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            outputPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            var outputTitleLabel = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 10F, FontStyle.Bold),
                ForeColor = TextPrimary,
                Text = "Activity log",
                Margin = new Padding(0, 0, 0, 8)
            };

            var buttonPanel = new FlowLayoutPanel
            {
                AutoSize = true,
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Margin = new Padding(0),
                BackColor = AppBackground
            };

            startButton = CreateButton("Start", "start", RunningColor, Color.White);
            stopButton = CreateButton("Stop", "stop", StoppedColor, Color.White);
            restartButton = CreateButton("Restart", "restart", Color.FromArgb(52, 101, 164), Color.White);
            refreshButton = CreateButton("Refresh", "status", Color.White, TextPrimary);

            buttonPanel.Controls.Add(startButton);
            buttonPanel.Controls.Add(stopButton);
            buttonPanel.Controls.Add(restartButton);
            buttonPanel.Controls.Add(refreshButton);

            statusPanel.Controls.Add(statusCaptionLabel);
            statusPanel.Controls.Add(statusLabel);
            statusPanel.Controls.Add(statusDetailLabel);
            statusPanel.Controls.Add(statusStripe);

            outputPanel.Controls.Add(outputTitleLabel, 0, 0);
            outputPanel.Controls.Add(outputBox, 0, 1);

            root.Controls.Add(headerPanel, 0, 0);
            root.Controls.Add(statusPanel, 0, 1);
            root.Controls.Add(outputPanel, 0, 2);
            root.Controls.Add(buttonPanel, 0, 3);
            Controls.Add(root);

            statusTimer = new Timer { Interval = 3000 };
            statusTimer.Tick += delegate { RefreshStatus(); };

            Shown += delegate
            {
                RefreshStatus();
                statusTimer.Start();
            };
        }

        private Button CreateButton(string text, string command, Color backColor, Color foreColor)
        {
            var button = new Button
            {
                FlatStyle = FlatStyle.Flat,
                Size = new Size(118, 38),
                Margin = new Padding(0, 0, 10, 0),
                BackColor = backColor,
                ForeColor = foreColor,
                Font = new Font(Font.FontFamily, 9F, FontStyle.Bold),
                Text = text,
                Tag = command,
                UseVisualStyleBackColor = false
            };
            button.FlatAppearance.BorderColor = backColor == Color.White ? BorderColor : backColor;
            button.FlatAppearance.MouseOverBackColor = backColor == Color.White ? Color.FromArgb(236, 241, 246) : ControlPaint.Light(backColor);
            button.Click += delegate { RunUiCommand((string)button.Tag); };
            return button;
        }

        private void RunUiCommand(string command)
        {
            SetButtonsEnabled(false);
            Cursor previousCursor = Cursor;
            Cursor = Cursors.WaitCursor;

            try
            {
                string message;
                switch (command)
                {
                    case "start":
                        message = ARTAX200ControlApp.StartApp();
                        break;
                    case "stop":
                        message = ARTAX200ControlApp.StopApp();
                        break;
                    case "restart":
                        message = ARTAX200ControlApp.RestartApp();
                        break;
                    default:
                        message = ARTAX200ControlApp.GetStatusText();
                        break;
                }

                AppendOutput(message);
            }
            catch (Exception ex)
            {
                AppendOutput("Failed: " + ex.Message);
            }
            finally
            {
                RefreshStatus();
                Cursor = previousCursor;
                SetButtonsEnabled(true);
            }
        }

        private void RefreshStatus()
        {
            try
            {
                string statusText = ARTAX200ControlApp.GetStatusText();
                bool isRunning = statusText.IndexOf("Running", StringComparison.OrdinalIgnoreCase) >= 0;

                statusLabel.Text = (isRunning ? "Running" : "Stopped") + " - " + ARTAX200ControlApp.GetEngineUrl();
                statusLabel.ForeColor = isRunning ? RunningColor : StoppedColor;
                statusStripe.BackColor = isRunning ? RunningColor : StoppedColor;
                statusDetailLabel.Text = statusText.Replace("ARTAX-200 status: ", "");
            }
            catch (Exception ex)
            {
                statusLabel.Text = "Unavailable";
                statusLabel.ForeColor = StoppedColor;
                statusStripe.BackColor = StoppedColor;
                statusDetailLabel.Text = ex.Message;
            }
        }

        private void AppendOutput(string message)
        {
            outputBox.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + message + Environment.NewLine);
        }

        private void SetButtonsEnabled(bool enabled)
        {
            startButton.Enabled = enabled;
            stopButton.Enabled = enabled;
            restartButton.Enabled = enabled;
            refreshButton.Enabled = enabled;
        }

        private void DrawPanelBorder(object sender, PaintEventArgs e)
        {
            Control control = (Control)sender;
            using (var pen = new Pen(BorderColor))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, control.Width - 1, control.Height - 1);
            }
        }
    }
}
