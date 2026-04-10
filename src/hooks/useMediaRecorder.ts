// =============================================================
// hooks/useMediaRecorder.ts
// Records combined audio+video stream
// Ensures final chunk is flushed before resolving
// =============================================================

import { useRef, useState, useCallback } from 'react';

export const useMediaRecorder = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = [];

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    console.log(`MediaRecorder: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);

    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || '';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType
        ? { mimeType, audioBitsPerSecond: 128000, videoBitsPerSecond: 800000 }
        : {}
      );
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        console.log(`Chunk received: ${e.data.size} bytes, total chunks: ${chunksRef.current.length}`);
      }
    };

    recorder.onerror = (e) => console.error('MediaRecorder error:', e);

    // Collect a chunk every 2 seconds
    recorder.start(2000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    console.log('Recording started, mimeType:', mimeType || 'browser default');
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === 'inactive') {
        console.warn('Recorder already inactive');
        resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
        return;
      }

      recorder.onstop = () => {
        const totalSize = chunksRef.current.reduce((sum, c) => sum + c.size, 0);
        console.log(`Recording stopped. ${chunksRef.current.length} chunks, ${totalSize} bytes total`);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        setRecordingBlob(blob);
        setIsRecording(false);
        resolve(blob);
      };

      // Request any buffered data before stopping
      if (recorder.state === 'recording') {
        recorder.requestData();
      }

      // Small delay to let requestData flush
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 300);
    });
  }, []);

  return { isRecording, startRecording, stopRecording, recordingBlob };
};