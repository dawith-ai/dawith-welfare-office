// "Dawith Welfare Office.exe": starts the bundled Node runtime without a
// console window. Built with the csc.exe that ships with Windows' .NET
// Framework, so it needs no extra toolchain.
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Dawith Welfare Office")]
[assembly: System.Reflection.AssemblyProduct("Dawith Welfare Office")]

static class Launcher
{
    static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    [STAThread]
    static int Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string runtime = Path.Combine(dir, "runtime", "dawith-runtime.exe");
        string entry = Path.Combine(dir, "app", "desktop", "lite.mjs");
        if (!File.Exists(runtime) || !File.Exists(entry))
        {
            MessageBox.Show("프로그램 파일이 손상되었습니다. 설치 파일을 다시 받아 설치해 주세요.", "Dawith Welfare Office", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        var start = new ProcessStartInfo(runtime, string.Join(" ", new[] { Quote(entry) }.Concat(args.Select(Quote))))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = dir,
        };
        try
        {
            Process.Start(start);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show("프로그램을 시작하지 못했습니다.\n" + error.Message, "Dawith Welfare Office", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
