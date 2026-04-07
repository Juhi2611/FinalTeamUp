import { useState } from "react";
import { supabase } from "@/lib/supabase"; // adjust path
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
const UploadPage = ({ onBack }: { onBack?: () => void }) => {
  const { user } = useAuth();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const uploadFile = async (file: File, type: "cv" | "video") => {
    if (!user) return;

    const filePath = `${user.uid}/${type}-${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("user-uploads")
      .upload(filePath, file);

    if (error) {
      console.error(error);
      alert("Upload failed");
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("user-uploads")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleUpload = async () => {
    if (!user) return;

    setLoading(true);

    let cvUrl = null;
    let videoUrl = null;

    if (cvFile) {
      cvUrl = await uploadFile(cvFile, "cv");
    }

    if (videoFile) {
      videoUrl = await uploadFile(videoFile, "video");
    }

    // 🔹 Save to database
    await updateDoc(doc(db, "profiles", user.uid), {
  cvUrl: cvUrl || null,
  videoUrl: videoUrl || null,
  cvUploaded: !!cvUrl,
  videoUploaded: !!videoUrl,
});

    setLoading(false);
alert("Uploaded successfully!");
navigate("/profile");
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
        <button
  onClick={() => {
    if (onBack) {
      onBack(); // if coming from Index navigation
    } else {
      navigate("/"); // if coming from route (/upload)
    }
  }}
  className="mb-4 text-sm text-blue-500 hover:underline"
>
  ← Back
</button>
      <h1 className="text-2xl font-bold">Upload Your Profile</h1>

      {/* CV Upload */}
      <div>
        <label className="block mb-2 font-medium">Upload CV (PDF)</label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* Video Upload */}
      <div>
        <label className="block mb-2 font-medium">Upload Intro Video</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
};

export default UploadPage;