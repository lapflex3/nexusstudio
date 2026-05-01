
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Monitor, 
  Gamepad2, 
  Code2, 
  Sparkles, 
  Mic, 
  Image as ImageIcon, 
  Video, 
  Search, 
  MapPin, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  X,
  Play,
  RotateCcw,
  Maximize2,
  Trash2,
  Download,
  Settings,
  BrainCircuit,
  Volume2
} from 'lucide-react';
import { AppMode, ToolType, ProjectState, ChatMessage, GenerationSettings } from './types';
import { GeminiService, encode, decode, decodeAudioData } from './services/gemini';
// Import LiveServerMessage from @google/genai to fix the missing type error.
import { LiveServerMessage } from '@google/genai';

// Initial Template Code
const INITIAL_WEBSITE_CODE = `
import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <header className="max-w-4xl mx-auto border-b border-slate-700 pb-8 mb-8">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Welcome to Your AI Site
        </h1>
        <p className="mt-4 text-slate-400 text-xl italic">
          Built with Nexus Studio & Gemini 3 Pro
        </p>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-blue-500 transition-colors">
          <h2 className="text-2xl font-bold mb-4">Interactive Demo</h2>
          <p className="text-slate-400 mb-6">Test the reactivity of your generated site.</p>
          <button 
            onClick={() => setCount(prev => prev + 1)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
          >
            Clicked {count} times
          </button>
        </section>

        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-emerald-500 transition-colors">
          <h2 className="text-2xl font-bold mb-4">Tech Stack</h2>
          <ul className="space-y-3 text-slate-400">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> React 18+
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> Tailwind CSS
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span> Gemini Intelligence
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
`;

const INITIAL_GAME_CODE = `
import React, { useState, useEffect, useCallback } from 'react';

export default function Game() {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState({ x: 80, y: 20 });

  const moveTarget = useCallback(() => {
    setTarget({
      x: Math.random() * 90,
      y: Math.random() * 90
    });
  }, []);

  useEffect(() => {
    const dist = Math.sqrt(Math.pow(pos.x - target.x, 2) + Math.pow(pos.y - target.y, 2));
    if (dist < 5) {
      setScore(s => s + 1);
      moveTarget();
    }
  }, [pos, target, moveTarget]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center overflow-hidden cursor-none">
      <div className="absolute top-8 left-8 text-white font-mono text-2xl">
        SCORE: {score.toString().padStart(4, '0')}
      </div>
      
      <div 
        className="relative w-[90vw] h-[70vh] border-2 border-white/20 rounded-xl overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        <div 
          className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]"
          style={{ left: \`\${pos.x}%\`, top: \`\${pos.y}%\`, transform: 'translate(-50%, -50%)' }}
        />
        <div 
          className="absolute w-10 h-10 bg-red-500 rounded-lg animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.6)]"
          style={{ left: \`\${target.x}%\`, top: \`\${target.y}%\`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      <p className="mt-8 text-white/50 font-mono">CHASE THE RED GLITCH</p>
    </div>
  );
}
`;

const App: React.FC = () => {
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<ToolType>(ToolType.CHAT);
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  // Project State
  const [project, setProject] = useState<ProjectState>({
    code: INITIAL_WEBSITE_CODE,
    mode: AppMode.WEBSITE,
    name: 'Untitled Project'
  });

  // AI State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<GenerationSettings>({
    aspectRatio: "16:9",
    imageSize: "1K",
    thinkingMode: false,
    useSearch: false,
    useMaps: false
  });

  // Services
  const gemini = useRef(new GeminiService());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Audio Context for Voice
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionPromiseRef = useRef<Promise<any> | null>(null);

  // Update Preview when code changes
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <script src="https://cdn.tailwindcss.com"></script>
              <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
              <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
              <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            </head>
            <body>
              <div id="root"></div>
              <script type="text/babel">
                const { useState, useEffect, useCallback, useMemo, useRef } = React;
                ${project.code.replace('export default', 'const App =')}
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(<App />);
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [project.code]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsGenerating(true);

    try {
      const response = await gemini.current.chat(inputValue, messages, settings);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.text || '',
        timestamp: Date.now(),
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
          title: c.web?.title || c.maps?.title || 'Source',
          uri: c.web?.uri || c.maps?.uri || '#'
        }))
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Error communicating with AI. Please check your API key settings.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!inputValue.trim()) return;

    // Users MUST select an API key before using gemini-3-pro-image-preview.
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    setIsGenerating(true);
    try {
      const imageUrl = await gemini.current.generateImage(inputValue, settings);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Generated image based on: "${inputValue}"`,
        image: imageUrl,
        timestamp: Date.now()
      }]);
      setInputValue('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!inputValue.trim()) return;

    // Users MUST select an API key before using Veo models.
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    setIsGenerating(true);
    try {
      const videoUrl = await gemini.current.generateVideo(inputValue, undefined, settings.aspectRatio as any);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Generated video for: "${inputValue}"`,
        video: videoUrl,
        timestamp: Date.now()
      }]);
      setInputValue('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startLiveConversation = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    setIsLiveMode(true);
    let nextStartTime = 0;
    const outputAudioContext = audioContextRef.current;
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    const sources = new Set<AudioBufferSourceNode>();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      // Use a session promise to avoid race conditions with sendRealtimeInput as per guidelines.
      const sessionPromise = gemini.current.connectLive({
        onopen: () => {
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
            
            // Solely rely on sessionPromise resolves to call sendRealtimeInput.
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData) {
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            // Decode raw PCM data using the manual implementation.
            const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputNode);
            source.start(nextStartTime);
            nextStartTime += buffer.duration;
            sources.add(source);
          }

          if (msg.serverContent?.interrupted) {
            for (const source of sources.values()) {
              source.stop();
              sources.delete(source);
            }
            nextStartTime = 0;
          }
        },
        onclose: () => setIsLiveMode(false),
        onerror: () => setIsLiveMode(false)
      }, "You are a coding assistant in Nexus Studio. Help the user build websites and games.");
      
      liveSessionPromiseRef.current = sessionPromise;
    } catch (error) {
      console.error(error);
      setIsLiveMode(false);
    }
  };

  const stopLiveConversation = async () => {
    if (liveSessionPromiseRef.current) {
      const session = await liveSessionPromiseRef.current;
      session.close();
      liveSessionPromiseRef.current = null;
    }
    setIsLiveMode(false);
  };

  const toggleMode = (mode: AppMode) => {
    setProject({
      ...project,
      mode,
      code: mode === AppMode.WEBSITE ? INITIAL_WEBSITE_CODE : INITIAL_GAME_CODE
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setMessages(prev => [...prev, {
        role: 'user',
        content: `Uploaded: ${file.name}`,
        image: file.type.startsWith('image/') ? base64 : undefined,
        timestamp: Date.now()
      }]);

      setIsGenerating(true);
      try {
        const response = await gemini.current.chat(`Analyze this ${file.type.startsWith('image/') ? 'image' : 'video'} for its structure and visual style.`, [], settings);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.text || 'Analyzed content successfully.',
          timestamp: Date.now()
        }]);
      } catch (e) { console.error(e); }
      finally { setIsGenerating(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* --- Sidebar (Toolbox & Chat) --- */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 w-96 bg-slate-900 border-l border-slate-800 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-lg">AI Assistant</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Tool Navigation */}
        <div className="flex justify-around p-2 bg-slate-800/50 m-2 rounded-xl">
          {[
            { id: ToolType.CHAT, icon: <BrainCircuit className="w-5 h-5" /> },
            { id: ToolType.GENERATE_IMAGE, icon: <ImageIcon className="w-5 h-5" /> },
            { id: ToolType.GENERATE_VIDEO, icon: <Video className="w-5 h-5" /> },
            { id: ToolType.VOICE, icon: <Mic className="w-5 h-5" /> }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id)}
              className={`p-3 rounded-lg transition-all ${activeTab === tool.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-400'}`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Active Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Start a conversation to build your next big thing.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
                {msg.content}
                {msg.image && <img src={msg.image} className="mt-2 rounded-lg max-w-full" alt="Generated" />}
                {msg.video && <video src={msg.video} controls className="mt-2 rounded-lg max-w-full" />}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500">
                    <p className="mb-1">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((s, j) => (
                        <a key={j} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-400">
                          <Search className="w-2 h-2" /> {s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex items-center gap-2 text-slate-500 italic text-xs ml-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              Gemini is working...
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {/* Settings Bar */}
          <div className="flex gap-2 text-[10px] text-slate-500 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => setSettings(s => ({ ...s, thinkingMode: !s.thinkingMode }))}
              className={`flex items-center gap-1 px-2 py-1 rounded border ${settings.thinkingMode ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'border-slate-800'}`}
            >
              <BrainCircuit className="w-3 h-3" /> Thinking
            </button>
            <button 
              onClick={() => setSettings(s => ({ ...s, useSearch: !s.useSearch }))}
              className={`flex items-center gap-1 px-2 py-1 rounded border ${settings.useSearch ? 'bg-blue-900/40 border-blue-500 text-blue-300' : 'border-slate-800'}`}
            >
              <Search className="w-3 h-3" /> Search
            </button>
            <button 
              onClick={() => setSettings(s => ({ ...s, useMaps: !s.useMaps }))}
              className={`flex items-center gap-1 px-2 py-1 rounded border ${settings.useMaps ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300' : 'border-slate-800'}`}
            >
              <MapPin className="w-3 h-3" /> Maps
            </button>
            <select 
              value={settings.aspectRatio}
              onChange={(e) => setSettings(s => ({ ...s, aspectRatio: e.target.value as any }))}
              className="bg-slate-900 border border-slate-800 px-2 py-1 rounded"
            >
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
            </select>
          </div>

          <div className="flex gap-2">
            <label className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <ImageIcon className="w-5 h-5 text-slate-400" />
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
            </label>
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (activeTab === ToolType.GENERATE_IMAGE ? handleGenerateImage() : activeTab === ToolType.GENERATE_VIDEO ? handleGenerateVideo() : handleSendMessage())}
                placeholder={activeTab === ToolType.GENERATE_IMAGE ? "Describe an image..." : activeTab === ToolType.GENERATE_VIDEO ? "Describe a video..." : "Ask Gemini anything..."}
                className="w-full bg-slate-800 text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 text-sm"
                rows={1}
              />
              <button 
                onClick={activeTab === ToolType.GENERATE_IMAGE ? handleGenerateImage : activeTab === ToolType.GENERATE_VIDEO ? handleGenerateVideo : handleSendMessage}
                disabled={isGenerating}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* --- Main Studio Interface --- */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'mr-96' : 'mr-0'}`}>
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">N</div>
              <h1 className="font-bold text-lg hidden sm:block">Nexus Studio</h1>
            </div>
            
            <nav className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => toggleMode(AppMode.WEBSITE)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${project.mode === AppMode.WEBSITE ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}
              >
                <Monitor className="w-4 h-4" /> Website
              </button>
              <button 
                onClick={() => toggleMode(AppMode.GAME)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${project.mode === AppMode.GAME ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}
              >
                <Gamepad2 className="w-4 h-4" /> Game
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={isLiveMode ? stopLiveConversation : startLiveConversation}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${isLiveMode ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-blue-400 hover:bg-slate-700'}`}
            >
              {isLiveMode ? <RotateCcw className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isLiveMode ? "End Call" : "Live Chat"}
            </button>
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Studio Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <section className="w-1/2 flex flex-col border-r border-slate-800">
            <div className="bg-slate-900 p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Code2 className="w-4 h-4" />
                <span>App.tsx</span>
              </div>
              <button className="text-[10px] text-slate-500 hover:text-white uppercase tracking-widest font-bold">
                Auto-save ON
              </button>
            </div>
            <textarea
              value={project.code}
              onChange={(e) => setProject({ ...project, code: e.target.value })}
              className="flex-1 bg-slate-950 p-6 font-mono text-sm leading-relaxed focus:outline-none text-emerald-400/90 selection:bg-emerald-500/20"
              spellCheck={false}
            />
          </section>

          {/* Preview Area */}
          <section className="w-1/2 flex flex-col bg-[#1e293b]">
            <div className="bg-slate-900 p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Play className="w-3 h-3 text-emerald-500" />
                <span>localhost:3000</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1 text-slate-500 hover:text-white"><RotateCcw className="w-3 h-3" /></button>
                <button className="p-1 text-slate-500 hover:text-white"><Maximize2 className="w-3 h-3" /></button>
              </div>
            </div>
            <div className="flex-1 bg-white relative">
              <iframe 
                ref={iframeRef}
                title="Preview"
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-modals"
              />
              {/* Voice Visualization Overlay */}
              {isLiveMode && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-4 shadow-2xl">
                  <div className="flex gap-1 h-4 items-center">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${40 + Math.random() * 60}%` }} />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Listening...</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Status Bar */}
        <footer className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Connected</span>
            <span>UTF-8</span>
            <span>TypeScript JSX</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 hover:text-slate-300 cursor-pointer"><Settings className="w-3 h-3" /> Settings</span>
            <span className="text-blue-400">Nexus Core 1.2.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
