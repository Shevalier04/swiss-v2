/**
 * Universal WAV Audio Recorder
 * Records 16,000 Hz Mono 16-bit PCM WAV directly using AudioContext.
 * 100% compatible with Huawei Browser, HarmonyOS, iOS Safari, and all mobile browsers,
 * bypassing buggy and inconsistent browser MediaRecorder implementations.
 */

export interface WavRecorderInstance {
  stop: () => Promise<{ blob: Blob; base64: string; duration: number }>;
  getVolumeLevel: () => number;
  cleanup: () => void;
}

/**
 * Encodes PCM samples (Float32Array) to a standard 44-byte RIFF WAV Blob (16-bit, 16kHz, mono).
 */
export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true); // file length - 8
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8 = 16000 * 2)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8 = 2)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true); // Subchunk2Size

  // Write PCM samples (16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Resamples Float32Array audio buffer to target sample rate (16,000 Hz)
 */
function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number = 16000): Float32Array {
  if (outputRate === inputRate) {
    return buffer;
  }
  if (outputRate > inputRate) {
    return buffer; // Can't upsample accurately, keep as is
  }
  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Starts WAV recording on the given MediaStream.
 */
export async function startWavRecording(stream: MediaStream): Promise<WavRecorderInstance> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('当前浏览器不支持 AudioContext 录音接口');
  }

  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaStreamSource(stream);
  // Buffer size 4096 gives balance between latency and performance
  const bufferSize = 4096;
  const scriptNode = audioCtx.createScriptProcessor
    ? audioCtx.createScriptProcessor(bufferSize, 1, 1)
    : (audioCtx as any).createJavaScriptNode(bufferSize, 1, 1);

  // Analyser node for real-time sound wave animation
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const audioChunks: Float32Array[] = [];
  let isRecording = true;
  let currentVolume = 0;
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
    if (!isRecording) return;
    const inputData = e.inputBuffer.getChannelData(0);
    // Clone chunk
    const chunk = new Float32Array(inputData.length);
    chunk.set(inputData);
    audioChunks.push(chunk);

    // Calculate volume
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) {
      sum += freqData[i];
    }
    currentVolume = Math.min(100, Math.round((sum / freqData.length / 128) * 100));
  };

  source.connect(scriptNode);
  scriptNode.connect(audioCtx.destination);

  const startTime = Date.now();

  const cleanup = () => {
    isRecording = false;
    try {
      source.disconnect();
      scriptNode.disconnect();
      analyser.disconnect();
    } catch {}
    try {
      audioCtx.close();
    } catch {}
  };

  const stop = async (): Promise<{ blob: Blob; base64: string; duration: number }> => {
    isRecording = false;
    const duration = (Date.now() - startTime) / 1000;

    // Merge recorded PCM chunks
    let totalLength = 0;
    for (let i = 0; i < audioChunks.length; i++) {
      totalLength += audioChunks[i].length;
    }
    const mergedBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < audioChunks.length; i++) {
      mergedBuffer.set(audioChunks[i], offset);
      offset += audioChunks[i].length;
    }

    // Downsample to 16,000 Hz
    const resampled = downsampleBuffer(mergedBuffer, audioCtx.sampleRate, 16000);

    // Encode to WAV Blob
    const wavBlob = encodeWAV(resampled, 16000);

    // Clean up Web Audio graph
    cleanup();

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(wavBlob);
    });

    return {
      blob: wavBlob,
      base64,
      duration,
    };
  };

  const getVolumeLevel = () => currentVolume;

  return {
    stop,
    getVolumeLevel,
    cleanup,
  };
}
