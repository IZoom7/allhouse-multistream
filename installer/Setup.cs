// Allhouse Setup / Uninstall — a styled per-user installer (no admin, no extra runtime: .NET Framework 4.x + WPF ship with Windows).
// Built by scripts/build-release.cjs with the Windows csc.exe (C# 5). The same source compiles twice:
//   Setup:      embeds payload.zip (the packaged app) + uninstall.exe
//   UNINSTALLER: no payload; copied into the install folder as "Uninstall Allhouse.exe"
// Installs to %LOCALAPPDATA%\Programs\Allhouse, Start menu + optional desktop shortcut, HKCU uninstall entry.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Microsoft.Win32;
using Path = System.IO.Path;

[assembly: AssemblyCompany("Allhouse")]
[assembly: AssemblyCopyright("© Allhouse. All rights reserved.")]

namespace AllhouseSetup {

class UserError : Exception { public UserError(string m) : base(m) { } }

static class App {
  [STAThread]
  static int Main(string[] args) {
    try {
#if UNINSTALLER
      // Run from a temp copy so the install folder (and this exe in it) can be removed.
      if (args.Length == 0 || args[0] != "/fromtemp") {
        string self = Assembly.GetExecutingAssembly().Location;
        string dir = Path.GetDirectoryName(self);
        string tmp = Path.Combine(Path.GetTempPath(), "Allhouse-uninstall-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
        File.Copy(self, tmp);
        Process.Start(new ProcessStartInfo(tmp, "/fromtemp \"" + dir + "\"") { UseShellExecute = false });
        return 0;
      }
#endif
      var app = new Application();
      app.ShutdownMode = ShutdownMode.OnMainWindowClose;
      var ui = new SetupWindow(args);
      app.Run(ui.Window);
      return 0;
    } catch (Exception ex) {
      MessageBox.Show(ex.Message, "Allhouse Setup", MessageBoxButton.OK, MessageBoxImage.Error);
      return 1;
    }
  }
}

class SetupWindow {
  const string AppName = "Allhouse", ExeName = "Allhouse.exe", Marker = ".allhouse-install", UninstallerName = "Uninstall Allhouse.exe";
  const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Allhouse";
  static readonly Assembly Asm = Assembly.GetExecutingAssembly();

  public readonly Window Window;
  enum Screen { Start, Work, Done, Error }
  Screen screen = Screen.Start;
  bool th, busy, updating;
  string installDir, errorText;
  readonly bool uninstall;
  DispatcherTimerLite tipTimer;
  int tipIndex;

  // Named elements from Setup.xaml (assigned by name with reflection in the constructor)
#pragma warning disable 649, 169
  Image Logo, TitleIcon; TextBlock TitleText, Chip, StartTitle, StartBody, PathLabel, PathText, WorkTitle, TipIcon, TipText, Percent, WorkFile, EndTitle, EndBody, EndIcon, OnAirText, LangText;
  Button StartPrimary, StartSecondary, BrowseBtn, EndPrimary, EndSecondary, CloseBtn, MinBtn, LangBtn;
  CheckBox Opt1, Opt2; FrameworkElement PanelStart, PanelWork, PanelEnd, PathRow, TipBox; Grid BarFill; Border BarTrack, EndBadge, TitleBar; Rectangle BarColors, Shine;
  Ellipse OnAirDot; Canvas Sparkles; TranslateTransform FloatY, ShineX, PanelY, BadgeX; ScaleTransform ShadowScale, LogoScale, BadgeScale;
#pragma warning restore 649, 169

  public SetupWindow(string[] args) {
#if UNINSTALLER
    uninstall = true;
    installDir = args.Length > 1 ? args[1].TrimEnd('\\', '"') : "";
#else
    installDir = ExistingInstall() ?? DefaultDir();
    updating = File.Exists(Path.Combine(installDir, Marker));
#endif
    th = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "th";
    using (var s = Asm.GetManifestResourceStream("Setup.xaml")) Window = (Window)XamlReader.Load(s);
    foreach (var f in GetType().GetFields(BindingFlags.NonPublic | BindingFlags.Instance)) {
      if (f.FieldType == typeof(string) || f.FieldType == typeof(bool) || f.FieldType == typeof(Window)) continue;
      object el = Window.FindName(f.Name);
      if (el != null && f.FieldType.IsInstanceOfType(el)) f.SetValue(this, el);
    }
    var icon = Img("icon.png");
    Window.Icon = icon; Logo.Source = icon; TitleIcon.Source = icon;
    Window.Title = uninstall ? "Uninstall Allhouse" : "Allhouse Setup";

    TitleBar.MouseLeftButtonDown += (s, e) => { if (e.ButtonState == MouseButtonState.Pressed) Window.DragMove(); };
    CloseBtn.Click += (s, e) => TryClose();
    MinBtn.Click += (s, e) => Window.WindowState = WindowState.Minimized;
    LangBtn.Click += (s, e) => { th = !th; Render(); };
    BrowseBtn.Click += (s, e) => Browse();
    StartPrimary.Click += (s, e) => Begin();
    StartSecondary.Click += (s, e) => TryClose();
    EndPrimary.Click += (s, e) => EndAction(true);
    EndSecondary.Click += (s, e) => EndAction(false);
    Window.Closing += (s, e) => { if (busy) e.Cancel = true; };
    Window.Closed += (s, e) => { if (uninstall) DeleteSelfLater(); };
    Window.Loaded += (s, e) => { Idle(); BuildBar(); };

    if (uninstall) {
      Opt1.IsChecked = false; Opt2.Visibility = Visibility.Collapsed; PathRow.Visibility = Visibility.Collapsed;
      if (!IsOurInstall(installDir)) { errorText = null; screen = Screen.Error; }
    }
    Render();
  }

  string T(string thai, string english) { return th ? thai : english; }
  static string Version { get { return BuildInfo.Version; } }

  // ---------------------------------------------------------------- texts per screen
  void Render() {
    LangText.Text = th ? "TH · en" : "th · EN";
    TitleText.Text = uninstall ? "ALLHOUSE UNINSTALL" : "ALLHOUSE SETUP";
    PanelStart.Visibility = screen == Screen.Start ? Visibility.Visible : Visibility.Collapsed;
    PanelWork.Visibility = screen == Screen.Work ? Visibility.Visible : Visibility.Collapsed;
    PanelEnd.Visibility = screen == Screen.Done || screen == Screen.Error ? Visibility.Visible : Visibility.Collapsed;
    Chip.Text = "v" + Version + " · LOCAL ALPHA";
    if (uninstall) {
      StartTitle.Text = T("จะย้ายออกจากบ้านแล้วเหรอ?", "Moving out already?");
      StartBody.Text = T("Allhouse จะถูกลบออกจากเครื่องนี้ พร้อมไอคอนในเมนู Start และบนเดสก์ท็อป", "Allhouse will be removed from this PC, along with its Start menu and desktop icons.");
      Opt1.Content = T("ลบห้อง วิดเจ็ต และการตั้งค่าของฉันด้วย", "Also delete my room, widgets and settings");
      StartPrimary.Content = T("ถอนการติดตั้ง", "Uninstall"); StartSecondary.Content = T("เก็บไว้ก่อน", "Keep it");
      WorkTitle.Text = T("กำลังเก็บของ…", "Packing up…");
    } else {
      StartTitle.Text = updating ? T("อัปเดตบ้านของคุณ", "Update your house") : T("ยินดีต้อนรับสู่ Allhouse", "Welcome to Allhouse");
      StartBody.Text = updating
        ? T("ติดตั้งเวอร์ชันใหม่ทับของเดิม ห้อง วิดเจ็ต และการตั้งค่าของคุณยังอยู่ครบ", "Installs the new version over the old one. Your room, widgets and settings stay as they are.")
        : T("แชท การแจ้งเตือน และวิดเจ็ต OBS จากทุกแพลตฟอร์ม รวมไว้ในบ้านหลังเดียว", "Chat, alerts and OBS widgets from every platform, together in one house.");
      PathLabel.Text = T("ติดตั้งที่", "Install to");
      PathText.Text = installDir;
      BrowseBtn.Content = T("เปลี่ยน", "Change");
      BrowseBtn.IsEnabled = !updating;
      Opt1.Content = T("สร้างไอคอนบนเดสก์ท็อป", "Add a desktop icon");
      Opt2.Content = T("เปิด Allhouse เมื่อติดตั้งเสร็จ", "Open Allhouse when finished");
      StartPrimary.Content = updating ? T("อัปเดต", "Update") : T("ติดตั้ง", "Install");
      StartSecondary.Content = T("ยกเลิก", "Cancel");
      WorkTitle.Text = T("กำลังขนของเข้าบ้าน…", "Moving in…");
    }
    if (screen == Screen.Work) ShowTip(false);
    if (screen == Screen.Done) {
      EndBadge.Background = Brush("#287B49"); EndIcon.Text = "";
      EndTitle.Text = uninstall ? T("ย้ายออกเรียบร้อย", "All moved out") : T("เข้าบ้านเรียบร้อย!", "Welcome home!");
      EndBody.Text = uninstall
        ? T("ลบ Allhouse ออกจากเครื่องแล้ว ขอบคุณที่แวะมาอยู่ด้วยกันนะ", "Allhouse has been removed. Thanks for staying with us.")
        : T("Allhouse พร้อมแล้ว เปิดได้จากเมนู Start" + (Opt1.IsChecked == true ? " หรือไอคอนบนเดสก์ท็อป" : ""), "Allhouse is ready. Open it from the Start menu" + (Opt1.IsChecked == true ? " or your desktop." : "."));
      EndPrimary.Content = uninstall ? T("ปิด", "Close") : launchAfter ? T("เปิด Allhouse", "Open Allhouse") : T("เสร็จสิ้น", "Finish");
      EndSecondary.Content = T("ไว้ทีหลัง", "Later");
      EndSecondary.Visibility = !uninstall && launchAfter ? Visibility.Visible : Visibility.Collapsed;
    }
    if (screen == Screen.Error) {
      EndBadge.Background = Brush("#BD3933"); EndIcon.Text = "";
      EndTitle.Text = T("ยังติดตั้งไม่ได้", "That didn’t work");
      if (uninstall && errorText == null) {
        EndTitle.Text = T("ไม่พบ Allhouse", "Allhouse not found");
        EndBody.Text = T("โฟลเดอร์นี้ไม่ใช่ที่ติดตั้ง Allhouse จึงไม่ลบอะไรเลย", "This folder isn’t an Allhouse install, so nothing was removed.") + "\n" + installDir;
        EndPrimary.Content = T("ปิด", "Close"); EndSecondary.Visibility = Visibility.Collapsed;
      } else {
        EndBody.Text = errorText;
        EndPrimary.Content = T("ลองอีกครั้ง", "Try again"); EndSecondary.Content = T("ปิด", "Close"); EndSecondary.Visibility = Visibility.Visible;
      }
    }
    OnAirText.Text = screen == Screen.Work ? "ON AIR" : screen == Screen.Done ? (uninstall ? "BYE!" : "HOME!") : screen == Screen.Error ? "OOPS" : "READY";
    OnAirDot.Fill = Brush(screen == Screen.Work ? "#BD3933" : screen == Screen.Error ? "#BD3933" : "#287B49");
    CloseBtn.IsEnabled = !busy;
  }

  void Go(Screen next) {
    screen = next; Render();
    PanelY.BeginAnimation(TranslateTransform.YProperty, Anim(14, 0, 320, new CubicEase { EasingMode = EasingMode.EaseOut }));
    var fade = Anim(0, 1, 260, null);
    FrameworkElement shown = next == Screen.Start ? PanelStart : next == Screen.Work ? PanelWork : PanelEnd;
    shown.BeginAnimation(UIElement.OpacityProperty, fade);
    if (next == Screen.Work) Working(); else if (next == Screen.Done) Celebrate(); else if (next == Screen.Error) { StopWorking(); Shake(); }
  }

  // ---------------------------------------------------------------- animation
  static DoubleAnimation Anim(double from, double to, int ms, IEasingFunction ease) {
    var a = new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(ms)); if (ease != null) a.EasingFunction = ease; return a;
  }
  void Idle() {
    var sine = new SineEase { EasingMode = EasingMode.EaseInOut };
    var f = Anim(0, -9, 1500, sine); f.AutoReverse = true; f.RepeatBehavior = RepeatBehavior.Forever;
    FloatY.BeginAnimation(TranslateTransform.YProperty, f);
    var sh = Anim(1, 0.82, 1500, sine); sh.AutoReverse = true; sh.RepeatBehavior = RepeatBehavior.Forever;
    ShadowScale.BeginAnimation(ScaleTransform.ScaleXProperty, sh);
    Smoke(2200);
  }
  void Smoke(int periodMs) {
    string[] names = { "Puff1", "Puff2", "Puff3" };
    for (int i = 0; i < names.Length; i++) {
      var p = (Rectangle)Window.FindName(names[i]);
      var tt = (TranslateTransform)p.RenderTransform;
      var begin = TimeSpan.FromMilliseconds(i * periodMs / 3);
      var up = Anim(0, -46, periodMs, new QuadraticEase { EasingMode = EasingMode.EaseOut }); up.BeginTime = begin; up.RepeatBehavior = RepeatBehavior.Forever;
      var side = Anim(0, (i % 2 == 0 ? 10 : -6), periodMs, null); side.BeginTime = begin; side.RepeatBehavior = RepeatBehavior.Forever;
      var fade = new DoubleAnimationUsingKeyFrames { BeginTime = begin, RepeatBehavior = RepeatBehavior.Forever, Duration = TimeSpan.FromMilliseconds(periodMs) };
      fade.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(0)));
      fade.KeyFrames.Add(new LinearDoubleKeyFrame(0.95, KeyTime.FromPercent(0.15)));
      fade.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(1)));
      tt.BeginAnimation(TranslateTransform.YProperty, up); tt.BeginAnimation(TranslateTransform.XProperty, side); p.BeginAnimation(UIElement.OpacityProperty, fade);
    }
  }
  void Working() {
    Smoke(900); // the chimney works harder while we move in
    var blink = Anim(1, 0.15, 520, null); blink.AutoReverse = true; blink.RepeatBehavior = RepeatBehavior.Forever;
    OnAirDot.BeginAnimation(UIElement.OpacityProperty, blink);
    var shine = Anim(-80, Math.Max(200, BarTrack.ActualWidth), 1300, new SineEase { EasingMode = EasingMode.EaseInOut }); shine.RepeatBehavior = RepeatBehavior.Forever;
    ShineX.BeginAnimation(TranslateTransform.XProperty, shine);
    tipIndex = 0; ShowTip(false);
    tipTimer = new DispatcherTimerLite(2800, () => { tipIndex++; ShowTip(true); });
  }
  void StopWorking() {
    if (tipTimer != null) { tipTimer.Stop(); tipTimer = null; }
    OnAirDot.BeginAnimation(UIElement.OpacityProperty, null);
    Smoke(2200);
  }
  void ShowTip(bool animate) {
    string[][] tips = uninstall ? new[] {
      new[] { "", "กำลังลบไฟล์ของโปรแกรม", "Removing program files" },
      new[] { "", "ขอบคุณที่ใช้ Allhouse นะ", "Thanks for using Allhouse" },
    } : new[] {
      new[] { "", "แชทจาก Twitch, YouTube, Kick และ TikTok รวมไว้ในห้องเดียว", "Twitch, YouTube, Kick and TikTok chat in one room" },
      new[] { "", "วิดเจ็ต OBS พร้อมใช้ คัดลอกลิงก์ไปวางใน Browser Source ได้เลย", "Ready-made OBS widgets: paste the link into a Browser Source" },
      new[] { "", "บอทอ่านแชทภาษาไทยด้วยเสียงที่ฟังเป็นธรรมชาติ", "Chat read aloud in natural Thai and English voices" },
      new[] { "", "ทุกอย่างอยู่ในเครื่องคุณ ไม่ต้องสมัครบัญชี", "Everything stays on your PC. No account needed" },
    };
    var tip = tips[tipIndex % tips.Length];
    TipIcon.Text = tip[0]; TipText.Text = th ? tip[1] : tip[2];
    if (animate) TipBox.BeginAnimation(UIElement.OpacityProperty, Anim(0, 1, 380, null));
  }
  void Celebrate() {
    StopWorking();
    var pop = new DoubleAnimationUsingKeyFrames { Duration = TimeSpan.FromMilliseconds(520) };
    pop.KeyFrames.Add(new EasingDoubleKeyFrame(1, KeyTime.FromPercent(0)));
    pop.KeyFrames.Add(new EasingDoubleKeyFrame(1.14, KeyTime.FromPercent(0.4), new QuadraticEase()));
    pop.KeyFrames.Add(new EasingDoubleKeyFrame(1, KeyTime.FromPercent(1), new ElasticEase { Oscillations = 1, Springiness = 4 }));
    LogoScale.BeginAnimation(ScaleTransform.ScaleXProperty, pop); LogoScale.BeginAnimation(ScaleTransform.ScaleYProperty, pop);
    var badge = Anim(0.2, 1, 520, new BackEase { Amplitude = 0.6, EasingMode = EasingMode.EaseOut });
    BadgeScale.BeginAnimation(ScaleTransform.ScaleXProperty, badge); BadgeScale.BeginAnimation(ScaleTransform.ScaleYProperty, badge);
    // Pixel sparkles in the controller colours
    string[] colors = { "#285BB5", "#BD3933", "#F0CB45", "#287B49", "#F5EDD7", "#E62EB4" };
    double[,] spots = { { 12, 40 }, { 178, 58 }, { 30, 150 }, { 172, 160 }, { 96, 6 }, { 6, 100 }, { 188, 112 }, { 60, 196 } };
    Sparkles.Children.Clear();
    for (int i = 0; i < spots.GetLength(0); i++) {
      var r = new Rectangle { Width = 8, Height = 8, Fill = Brush(colors[i % colors.Length]), Stroke = Brush("#514738"), StrokeThickness = 1.5, Opacity = 0, RenderTransformOrigin = new Point(0.5, 0.5) };
      var sc = new ScaleTransform(0, 0); r.RenderTransform = sc;
      Canvas.SetLeft(r, spots[i, 0]); Canvas.SetTop(r, spots[i, 1]); Sparkles.Children.Add(r);
      var begin = TimeSpan.FromMilliseconds(80 * i);
      var grow = new DoubleAnimationUsingKeyFrames { BeginTime = begin, Duration = TimeSpan.FromMilliseconds(1400), RepeatBehavior = new RepeatBehavior(3) };
      grow.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(0)));
      grow.KeyFrames.Add(new EasingDoubleKeyFrame(1.3, KeyTime.FromPercent(0.3), new QuadraticEase()));
      grow.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(1)));
      sc.BeginAnimation(ScaleTransform.ScaleXProperty, grow); sc.BeginAnimation(ScaleTransform.ScaleYProperty, grow);
      var op = new DoubleAnimation(1, TimeSpan.Zero) { BeginTime = begin };
      r.BeginAnimation(UIElement.OpacityProperty, op);
    }
  }
  void Shake() {
    var k = new DoubleAnimationUsingKeyFrames { Duration = TimeSpan.FromMilliseconds(420) };
    double[] xs = { 0, -8, 7, -5, 3, 0 };
    for (int i = 0; i < xs.Length; i++) k.KeyFrames.Add(new LinearDoubleKeyFrame(xs[i], KeyTime.FromPercent(i / (double)(xs.Length - 1))));
    BadgeX.BeginAnimation(TranslateTransform.XProperty, k);
  }
  void BuildBar() {
    // TV colour bars from the logo's screen, mapped across the full track so the colours are revealed as it fills.
    string[] bars = { "#EDEDED", "#F7D21E", "#2BC3E0", "#29B24A", "#E62EB4", "#E53935", "#2858C8" };
    double w = Math.Max(1, BarTrack.ActualWidth > 0 ? BarTrack.ActualWidth - 6 : 380);
    var brush = new LinearGradientBrush { MappingMode = BrushMappingMode.Absolute, StartPoint = new Point(0, 0), EndPoint = new Point(w, 0) };
    for (int i = 0; i < bars.Length; i++) {
      var c = (Color)ColorConverter.ConvertFromString(bars[i]);
      brush.GradientStops.Add(new GradientStop(c, i / (double)bars.Length));
      brush.GradientStops.Add(new GradientStop(c, (i + 1) / (double)bars.Length));
    }
    BarColors.Fill = brush; BarColors.Width = w; BarColors.HorizontalAlignment = HorizontalAlignment.Left;
  }
  double shownFraction;
  void SetProgress(double fraction, string file) {
    if (BarColors.Width < 2 || double.IsNaN(BarColors.Width)) BuildBar();
    fraction = Math.Max(shownFraction, Math.Min(1, fraction)); shownFraction = fraction;
    double w = BarColors.Width * fraction;
    BarFill.BeginAnimation(FrameworkElement.WidthProperty, new DoubleAnimation(w, TimeSpan.FromMilliseconds(220)));
    Percent.Text = ((int)Math.Round(fraction * 100)) + "%";
    if (file != null) WorkFile.Text = file;
  }
  static SolidColorBrush Brush(string hex) { var b = new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex)); b.Freeze(); return b; }
  static BitmapImage Img(string name) {
    var b = new BitmapImage(); b.BeginInit(); b.CacheOption = BitmapCacheOption.OnLoad; b.StreamSource = Asm.GetManifestResourceStream(name); b.EndInit(); b.Freeze(); return b;
  }

  // ---------------------------------------------------------------- actions
  void TryClose() { if (!busy) Window.Close(); }
  void Browse() {
    using (var d = new System.Windows.Forms.FolderBrowserDialog()) {
      d.Description = T("เลือกโฟลเดอร์ที่จะติดตั้ง Allhouse (จะสร้างโฟลเดอร์ Allhouse ข้างใน)", "Choose where to install Allhouse (an Allhouse folder is created inside)");
      d.SelectedPath = Path.GetDirectoryName(installDir);
      if (d.ShowDialog() != System.Windows.Forms.DialogResult.OK) return;
      string p = d.SelectedPath;
      if (!string.Equals(Path.GetFileName(p.TrimEnd('\\')), AppName, StringComparison.OrdinalIgnoreCase)) p = Path.Combine(p, AppName);
      installDir = Path.GetFullPath(p).TrimEnd('\\');
      Render();
    }
  }
  void Begin() {
    bool opt1 = Opt1.IsChecked == true, opt2 = Opt2.IsChecked == true;
    busy = true; shownFraction = 0; BarFill.BeginAnimation(FrameworkElement.WidthProperty, null); BarFill.Width = 0; Percent.Text = "0%"; WorkFile.Text = "";
    launchAfter = opt2;
    Go(Screen.Work);
    var t = new Thread(() => {
      try {
        var clock = Stopwatch.StartNew();
        if (uninstall) DoUninstall(opt1); else DoInstall(opt1);
        if (clock.ElapsedMilliseconds < 3200) Thread.Sleep(3200 - (int)clock.ElapsedMilliseconds); // fast disks finish in ~2 s: let the screen be seen
        Ui(() => { busy = false; SetProgress(1, ""); Go(Screen.Done); });
      } catch (Exception ex) {
        string msg = ex is UserError ? ex.Message : T("เกิดข้อผิดพลาด: ", "Something went wrong: ") + ex.Message;
        Ui(() => { busy = false; errorText = msg; Go(Screen.Error); });
      }
    });
    t.IsBackground = true; t.Start();
  }
  bool launchAfter;
  void EndAction(bool primary) {
    if (screen == Screen.Error && primary && !(uninstall && errorText == null)) { Go(Screen.Start); return; }
    if (screen == Screen.Done && !uninstall && primary && launchAfter) Launch();
    Window.Close();
  }
  void Launch() {
    try { Process.Start(new ProcessStartInfo(Path.Combine(installDir, ExeName)) { WorkingDirectory = installDir, UseShellExecute = true }); } catch { }
  }
  void Ui(Action a) { Window.Dispatcher.BeginInvoke(a); }
  long lastReport;
  void Report(long done, long total, string file) {
    long now = Environment.TickCount;
    if (now - lastReport < 60 && done < total) return;
    lastReport = now;
    double f = total > 0 ? (double)done / total : 1;
    Ui(() => SetProgress(f, file));
  }

  // ---------------------------------------------------------------- install
  static string DefaultDir() { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName); }
  static string ExistingInstall() {
    using (var k = Registry.CurrentUser.OpenSubKey(UninstallKey)) {
      var loc = k == null ? null : k.GetValue("InstallLocation") as string;
      return loc != null && IsOurInstall(loc) ? loc.TrimEnd('\\') : null;
    }
  }
  /** Ownership evidence: our marker file and our exe, at least two levels below the drive root. */
  static bool IsOurInstall(string dir) {
    try {
      if (string.IsNullOrEmpty(dir)) return false;
      string full = Path.GetFullPath(dir).TrimEnd('\\');
      if (full.Split('\\').Length < 3) return false;
      if ((File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0) return false;
      return File.Exists(Path.Combine(full, Marker)) && File.Exists(Path.Combine(full, ExeName));
    } catch { return false; }
  }
  void EnsureNotRunning(string dir) {
    string root = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
    foreach (var p in Process.GetProcessesByName("Allhouse")) {
      string f = null;
      try { f = p.MainModule.FileName; } catch { }
      if (f == null || f.StartsWith(root, StringComparison.OrdinalIgnoreCase))
        throw new UserError(T("Allhouse ยังเปิดอยู่ ปิดโปรแกรมก่อน แล้วกด \"ลองอีกครั้ง\"", "Allhouse is still open. Close it, then press \"Try again\"."));
    }
  }
  void DoInstall(bool desktopIcon) {
    string dir = installDir;
    if (Path.GetFullPath(dir).TrimEnd('\\').Split('\\').Length < 3) throw new UserError(T("เลือกโฟลเดอร์ที่ลึกกว่านี้", "Choose a folder below the drive root."));
    EnsureNotRunning(dir);
    if (Directory.Exists(dir)) {
      if (IsOurInstall(dir)) DeleteContents(dir, null);
      else if (Directory.EnumerateFileSystemEntries(dir).Any())
        throw new UserError(T("โฟลเดอร์นี้มีไฟล์อื่นอยู่แล้ว เลือกที่อื่นหรือโฟลเดอร์ว่าง", "That folder already has other files in it. Choose an empty folder.") + "\n" + dir);
    }
    Directory.CreateDirectory(dir);
    string root = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
    long total = 0, done = 0;
    using (var s = Asm.GetManifestResourceStream("payload.zip"))
    using (var zip = new ZipArchive(s, ZipArchiveMode.Read)) {
      foreach (var e in zip.Entries) total += e.Length;
      var buf = new byte[1 << 17];
      foreach (var e in zip.Entries) {
        string dest = Path.GetFullPath(Path.Combine(dir, e.FullName));
        if (!dest.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new UserError("Bad archive entry: " + e.FullName); // zip-slip
        if (e.FullName.EndsWith("/")) { Directory.CreateDirectory(dest); continue; }
        Directory.CreateDirectory(Path.GetDirectoryName(dest));
        using (var i = e.Open()) using (var o = File.Create(dest)) {
          int n; while ((n = i.Read(buf, 0, buf.Length)) > 0) { o.Write(buf, 0, n); done += n; Report(done, total, e.FullName); }
        }
      }
    }
    using (var u = Asm.GetManifestResourceStream("uninstall.exe")) using (var o = File.Create(Path.Combine(dir, UninstallerName))) u.CopyTo(o);
    File.WriteAllText(Path.Combine(dir, Marker), "Allhouse " + Version + "\r\n");
    string exe = Path.Combine(dir, ExeName);
    string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk");
    Shortcut(startMenu, exe, dir);
    string desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk");
    if (desktopIcon) Shortcut(desktop, exe, dir); else if (File.Exists(desktop)) File.Delete(desktop);
    using (var k = Registry.CurrentUser.CreateSubKey(UninstallKey)) {
      k.SetValue("DisplayName", AppName);
      k.SetValue("DisplayVersion", Version);
      k.SetValue("Publisher", AppName);
      k.SetValue("DisplayIcon", exe + ",0");
      k.SetValue("InstallLocation", dir);
      k.SetValue("UninstallString", "\"" + Path.Combine(dir, UninstallerName) + "\"");
      k.SetValue("EstimatedSize", (int)(total / 1024), RegistryValueKind.DWord);
      k.SetValue("NoModify", 1, RegistryValueKind.DWord);
      k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
      k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
    }
  }
  static void Shortcut(string lnk, string target, string workDir) {
    Type t = Type.GetTypeFromProgID("WScript.Shell");
    object shell = Activator.CreateInstance(t);
    try {
      object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
      Type st = sc.GetType();
      st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
      st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { workDir });
      st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { target + ",0" });
      st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { "Allhouse — your stream, together" });
      st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
      Marshal.FinalReleaseComObject(sc);
    } finally { Marshal.FinalReleaseComObject(shell); }
  }

  // ---------------------------------------------------------------- uninstall
  void DoUninstall(bool deleteData) {
    string dir = installDir;
    if (!IsOurInstall(dir)) throw new UserError(T("ไม่พบ Allhouse ในโฟลเดอร์นี้ จึงไม่ลบอะไรเลย", "Allhouse wasn’t found in this folder, so nothing was removed.") + "\n" + dir);
    EnsureNotRunning(dir);
    foreach (var lnk in new[] {
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk") })
      if (File.Exists(lnk)) File.Delete(lnk);
    using (var k = Registry.CurrentUser.OpenSubKey(UninstallKey)) {
      var loc = k == null ? null : k.GetValue("InstallLocation") as string;
      if (k != null && loc != null && string.Equals(loc.TrimEnd('\\'), dir, StringComparison.OrdinalIgnoreCase)) { k.Close(); Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false); }
    }
    var files = new List<string>(); Collect(dir, files);
    long total = files.Count, done = 0;
    DeleteContents(dir, f => { done++; Report(done, total, f.Substring(dir.Length).TrimStart('\\')); });
    try { Directory.Delete(dir); } catch { }
    if (deleteData) {
      // The app's data folder (Electron userData for "allhouse"). Fixed location, and only if it looks like ours.
      string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "allhouse");
      if (Directory.Exists(data) && (File.Exists(Path.Combine(data, "workspace.json")) || File.Exists(Path.Combine(data, "overlay-token")))
          && (File.GetAttributes(data) & FileAttributes.ReparsePoint) == 0) {
        DeleteContents(data, null); try { Directory.Delete(data); } catch { }
      }
    }
  }
  static void Collect(string dir, List<string> files) {
    foreach (var f in Directory.GetFiles(dir)) files.Add(f);
    foreach (var d in Directory.GetDirectories(dir)) if ((File.GetAttributes(d) & FileAttributes.ReparsePoint) == 0) Collect(d, files);
  }
  /** Deletes everything inside dir. Junctions/symlinks are removed as links, never followed. */
  static void DeleteContents(string dir, Action<string> onFile) {
    foreach (var f in Directory.GetFiles(dir)) { File.SetAttributes(f, FileAttributes.Normal); File.Delete(f); if (onFile != null) onFile(f); }
    foreach (var d in Directory.GetDirectories(dir)) {
      if ((File.GetAttributes(d) & FileAttributes.ReparsePoint) != 0) { Directory.Delete(d); continue; }
      DeleteContents(d, onFile); Directory.Delete(d);
    }
  }
  static void DeleteSelfLater() {
    try {
      string self = Assembly.GetExecutingAssembly().Location;
      if (!Path.GetFileName(self).StartsWith("Allhouse-uninstall-", StringComparison.OrdinalIgnoreCase)) return;
      Process.Start(new ProcessStartInfo("cmd.exe", "/c ping 127.0.0.1 -n 3 >nul & del /f /q \"" + self + "\"") { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
    } catch { }
  }
}

/** Tiny repeating UI-thread timer (avoids a WindowsBase.Threading import clash with System.Threading). */
class DispatcherTimerLite {
  readonly System.Windows.Threading.DispatcherTimer t;
  public DispatcherTimerLite(int ms, Action tick) { t = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(ms) }; t.Tick += (s, e) => tick(); t.Start(); }
  public void Stop() { t.Stop(); }
}
}
