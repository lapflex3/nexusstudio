
import { GoogleGenAI, Type, Modality, GenerateContentResponse, LiveServerMessage } from "@google/genai";
import { GenerationSettings } from "../types";

// Base64 Encoding Helper as per guidelines.
export const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Base64 Decoding Helper as per guidelines.
export const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Raw PCM Audio Decoding for the Live API.
export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// Tool definitions for function calling
export const websiteGameGeneratorTool = {
  name: 'generate_code',
  parameters: {
    type: Type.OBJECT,
    description: 'Generate React code for a website or a mini-game.',
    properties: {
      code: {
        type: Type.STRING,
        description: 'The complete React/Tailwind code for the application.',
      },
      explanation: {
        type: Type.STRING,
        description: 'Brief explanation of what was built.',
      }
    },
    required: ['code', 'explanation'],
  },
};

export class GeminiService {
  // Always create a new instance right before making an API call to ensure it uses the most up-to-date API key.
  private get ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async chat(message: string, history: any[], settings: GenerationSettings) {
    // Maps grounding is only supported in Gemini 2.5 series models.
    const modelName = settings.useMaps ? 'gemini-2.5-flash-lite-latest' : 'gemini-3-pro-preview';
    
    const config: any = {
      tools: [],
    };

    if (settings.thinkingMode && !settings.useMaps) {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    if (settings.useSearch) {
      config.tools.push({ googleSearch: {} });
    }

    if (settings.useMaps) {
      config.tools.push({ googleMaps: {} });
      // Example coordinates for Kuala Lumpur.
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude: 3.1390, longitude: 101.6869 } 
        }
      };
    }

    // Map history to the required format for generateContent.
    const contents = [
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await this.ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: config
    });

    return response;
  }

  async generateImage(prompt: string, settings: GenerationSettings) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: settings.aspectRatio,
          imageSize: settings.imageSize
        }
      }
    });

    let imageData = '';
    // Must iterate through parts to find the image part as per guidelines.
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return imageData;
  }

  async generateVideo(prompt: string, imageBase64?: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    let operation = await this.ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      ...(imageBase64 && {
        image: {
          imageBytes: imageBase64.split(',')[1],
          mimeType: 'image/png'
        }
      }),
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    // Append the API key to the download link as per guidelines.
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
  }

  async transcribeAudio(audioBlob: Blob) {
    const reader = new FileReader();
    return new Promise<string>((resolve) => {
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const response = await this.ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64, mimeType: audioBlob.type } },
              { text: "Transcribe this audio exactly as spoken." }
            ]
          }
        });
        resolve(response.text || '');
      };
      reader.readAsDataURL(audioBlob);
    });
  }

  async generateTTS(text: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }

  async connectLive(callbacks: any, systemInstruction: string) {
    return this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: systemInstruction,
      },
    });
  }
}
