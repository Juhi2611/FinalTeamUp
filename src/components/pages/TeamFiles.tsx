import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TeamFile = {
  id: string;
  team_id: string;
  uploader_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
};

const TeamFiles = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();

  const [files, setFiles] = useState<TeamFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // =========================
  // FETCH FILES FROM DB
  // =========================
  const fetchFiles = async () => {
    if (!teamId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("team_files")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load files");
      setLoading(false);
      return;
    }

    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [teamId]);

  // =========================
  // UPLOAD FILE
  // =========================
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user || !teamId) return;

    const file = e.target.files[0];
    const safeName = file.name.replace(/\s+/g, "_");
    const filePath = `${teamId}/${user.uid}/${Date.now()}-${safeName}`;

    setUploading(true);

    // 1️⃣ Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("team-files")
      .upload(filePath, file);

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    // 2️⃣ Save metadata to DB
    const { error: dbError } = await supabase.from("team_files").insert({
      team_id: teamId,
      uploader_id: user.uid,
      file_path: filePath,
      file_name: file.name,
    });

    if (dbError) {
      toast.error("File uploaded but failed to save metadata");
      setUploading(false);
      return;
    }

    toast.success("File uploaded");
    setUploading(false);
    e.target.value = "";
    fetchFiles();
  };

  // =========================
  // OPEN FILE (SIGNED URL)
  // =========================
  const openFile = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("team-files")
      .createSignedUrl(filePath, 120);

    if (error || !data?.signedUrl) {
      toast.error("Failed to open file");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };
  const downloadFile = async (filePath: string, fileName: string) => {
  try {
    // 1️⃣ Get signed URL
    const { data, error } = await supabase.storage
      .from("team-files")
      .createSignedUrl(filePath, 120);

    if (error || !data?.signedUrl) {
      toast.error("Failed to download file");
      return;
    }

    // 2️⃣ Fetch file as blob
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();

    // 3️⃣ Force download to device
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = fileName; // 👈 forces device download
    document.body.appendChild(a);
    a.click();

    // 4️⃣ Cleanup
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("Download failed");
  }
};
  // =========================
  // UI
  // =========================
  return (
  <div className="space-y-6 px-6 md:px-10 lg:px-16 pt-6 md:pt-8">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Files</h1>
        <p className="text-sm text-muted-foreground">
          Share files with your team members
        </p>
      </div>

      <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {uploading ? "Uploading..." : "Upload File"}
        <input type="file" hidden onChange={handleUpload} />
      </label>
    </div>

    {/* Files Card */}
    <div className="card-base p-4">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">
            No files uploaded yet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {files.map((file) => {
            const ext = file.file_name.split(".").pop()?.toLowerCase();

            return (
              <div
                key={file.id}
                className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition"
              >
                {/* Left */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                    {ext?.toUpperCase() || "FILE"}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {file.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded to team workspace
                    </p>
                  </div>
                </div>

                {/* Right */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openFile(file.file_path)}
                    className="btn-secondary text-sm"
                  >
                    Open
                  </button>

                  <button
                    onClick={() =>
                      downloadFile(file.file_path, file.file_name)
                    }
                    className="btn-outline text-sm"
                  >
                    Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

};

export default TeamFiles;
