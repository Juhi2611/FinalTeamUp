import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadPrivateFile } from '@/services/PrivateFiles';

export function usePrivateFiles(chatId: string, userId: string) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, [chatId]);

  const fetchFiles = async () => {
  setLoading(true);

  const { data, error } = await supabase
    .from('chat_files')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    setFiles([]);
    setLoading(false);
    return;
  }

  const filesWithUrls = await Promise.all(
    (data || []).map(async (f) => {
      const { data: signed, error: urlError } =
        await supabase.storage
          .from('chat-files')
          .createSignedUrl(f.file_path, 60 * 60); // 1 hour

      if (urlError) {
        console.error('SIGNED URL ERROR', urlError);
      }

      return {
        id: f.id,
        chatId: f.chat_id,
        senderId: f.sender_id,
        fileName: f.file_name,
        filePath: f.file_path,
        fileUrl: signed?.signedUrl,
        createdAt: f.created_at,
      };
    })
  );

  setFiles(filesWithUrls);
  setLoading(false);
};

  const uploadFile = async (file: File) => {
    setUploading(true);
    await uploadPrivateFile(file, chatId, userId);
    await fetchFiles();
    setUploading(false);
  };

  const deleteFile = async (file: any) => {
    await supabase.storage
      .from('chat-files')
      .remove([file.filePath]);

    await supabase
      .from('chat_files')
      .delete()
      .eq('id', file.id);

    fetchFiles();
  };

  return {
    files,
    loading,
    uploading,
    uploadFile,
    deleteFile,
  };
}
