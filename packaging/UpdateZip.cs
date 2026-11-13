using System;
using System.IO.Compression;
class UpdateZip {
    static int Main(string[] args) {
        using (ZipArchive archive=ZipFile.Open(args[0],ZipArchiveMode.Update)) {
            for(int i=1;i<args.Length;i+=2) {
                ZipArchiveEntry old=archive.GetEntry(args[i]);if(old!=null)old.Delete();
                archive.CreateEntryFromFile(args[i+1],args[i],CompressionLevel.Optimal);
            }
        }
        Console.WriteLine("Installer payload branding updated");return 0;
    }
}
