
export enum AppMode {
  WEBSITE = 'WEBSITE',
  GAME = 'GAME'
}

export enum ToolType {
  CHAT = 'CHAT',
  GENERATE_IMAGE = 'GENERATE_IMAGE',
  GENERATE_VIDEO = 'GENERATE_VIDEO',
  VOICE = 'VOICE',
  ANALYZE = 'ANALYZE'
}

export interface ProjectState {
  code: string;
  mode: AppMode;
  name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  image?: string;
  video?: string;
  sources?: Array<{ title: string; uri: string }>;
}

export interface GenerationSettings {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9" | "3:2" | "2:3";
  imageSize: "1K" | "2K" | "4K";
  thinkingMode: boolean;
  useSearch: boolean;
  useMaps: boolean;
}
