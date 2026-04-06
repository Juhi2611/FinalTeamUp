// =============================================================
// services/supabase_recordings.ts
// Supabase Storage - interview video recording uploads
// BUCKET MUST BE PUBLIC in Supabase Dashboard for URLs to work
// =============================================================

import { supabase } from '@/lib/supabase';

const BUCKET = 'interview-recordings';
const MIN_BLOB_SIZE = 1000; // bytes — anything smaller is likely empty

export const uploadRecording = async (
  interviewId: string,
  blob: Blob,
): Promise<{ path: string; url: string }> => {

  console.log(`Uploading recording: ${blob.size} bytes, type: ${blob.type}`);

  if (blob.size < MIN_BLOB_SIZE) {
    throw new Error(`Recording is too small (${blob.size} bytes) — likely empty. Check camera/mic permissions.`);
  }

  // Use .webm if available, fallback to blob's own type
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `${interviewId}_${Date.now()}.${ext}`;
  const path = `recordings/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'video/webm',
      upsert: true, // overwrite if exists
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Get public URL — requires bucket to be PUBLIC in Supabase dashboard
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  console.log(`Recording uploaded successfully: ${urlData.publicUrl}`);

  return {
    path,
    url: urlData.publicUrl,
  };
};

export const getRecordingSignedUrl = async (
  path: string,
  expiresInSeconds = 3600
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to get signed URL: ${error.message}`);
  return data.signedUrl;
};

export const deleteRecording = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
};