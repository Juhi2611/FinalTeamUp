import { supabase } from '@/lib/supabase';

export async function uploadPrivateFile(
  file: File,
  conversationId: string,
  userId: string
) {
  const filePath = `chat_${conversationId}/${Date.now()}-${file.name}`;

  console.log('Uploading to storage:', filePath);

  const { error: uploadError } = await supabase.storage
    .from('chat-files')
    .upload(filePath, file);

  if (uploadError) {
    console.error('STORAGE ERROR:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('chat-files')
    .getPublicUrl(filePath);

  console.log('Public URL:', data.publicUrl);

  const { error: dbError } = await supabase
  .from('chat_files')
  .insert({
    chat_id: conversationId,
    sender_id: userId,
    file_name: file.name,
    file_path: filePath,
  });
  if (dbError) {
    console.error('DB ERROR:', dbError);
    throw dbError;
  }

  console.log('DB insert success');
}

