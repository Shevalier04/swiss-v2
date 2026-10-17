/**
 * Cloudflare Pages Functions - Voice Transcription Endpoint
 * Path: /api/ai/transcribe
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User, X-Username',
};

export const onRequestOptions = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context;
    const body = await request.json().catch(() => ({}));
    const { audio, mimeType, prompt } = body || {};

    if (!audio) {
      return new Response(
        JSON.stringify({ error: '请提供录音音频数据', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cleanBase64 = String(audio).replace(/^data:[^;]+;base64,/, '').trim();
    let cleanMimeType = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (cleanMimeType === 'audio/x-m4a' || cleanMimeType === 'audio/m4a') {
      cleanMimeType = 'audio/mp4';
    }
    const supportedAudioTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/flac', 'audio/mpeg'];
    if (!supportedAudioTypes.includes(cleanMimeType)) {
      cleanMimeType = cleanMimeType.includes('mp4') || cleanMimeType.includes('aac') || cleanMimeType.includes('m4a') ? 'audio/mp4' : 'audio/webm';
    }

    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          fallbackToLocal: true,
          message: '未配置云端 AI 转录密钥，已自动切为本地语音引擎',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const promptText = prompt || '请准确转录这段语音音频内容，输出中文或英文原话纯文本。如果是课程作业，请保留课程名、作业内容与截止时间。直接输出纯文本，不要包含多余解说。';

    const buildPayload = () => ({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: cleanMimeType,
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
    });

    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent?key=${apiKey}`;
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });

    if (!response.ok) {
      console.warn('gemini-3.5-transcribe failed, retrying with gemini-3.8-flash on Cloudflare Pages');
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Gemini API call failed on Cloudflare Pages:', errText);
      return new Response(
        JSON.stringify({
          success: false,
          fallbackToLocal: true,
          message: '云端转录服务繁忙，采用本地识别',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const result: any = await response.json();
    const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return new Response(
      JSON.stringify({
        success: true,
        text: candidateText.trim(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('Cloudflare Pages transcribe error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        fallbackToLocal: true,
        error: err.message || '语音转录遇到异常',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
