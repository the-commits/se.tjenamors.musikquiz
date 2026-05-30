import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Sparkles, Users, Music, Layers, Trash2, ShieldAlert } from 'lucide-react';
import { RoomState, Question } from '../types';

interface HostLobbyProps {
  roomState: RoomState;
  onStartGame: () => void;
  onSelectPreset: (presetName: string) => void;
  onGenerateAIQuiz: (theme: string) => Promise<void>;
  aiGenerationError: string | null;
  selectedPreset: string;
}

export default function HostLobby({
  roomState,
  onStartGame,
  onSelectPreset,
  onGenerateAIQuiz,
  aiGenerationError,
  selectedPreset
}: HostLobbyProps) {
  const [aiTheme, setAiTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.href.split('?')[0]}?join=${roomState.code}` : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTheme.trim() || isGenerating) return;
    setIsGenerating(true);
    await onGenerateAIQuiz(aiTheme);
    setIsGenerating(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch h-full">
      {/* Lobby Connection Pane */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-[40px] p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden transform hover:scale-[1.02] transition-transform duration-500">
        
        <div className="flex flex-col items-center text-center space-y-6">
          <h2 className="text-indigo-950 text-2xl font-black leading-tight">Är du redo att krossa dina vänner?</h2>
          <p className="text-indigo-600 font-medium">Gå till <span className="font-bold underline">{window.location.host}</span> eller skanna koden</p>
          
          <div className="bg-indigo-50 w-full max-w-[280px] aspect-square rounded-3xl p-6 flex flex-col items-center justify-center relative border-4 border-dashed border-indigo-200">
            <img 
              src={qrUrl} 
              alt="QR-kod för att ansluta" 
              className="w-full h-full object-contain mix-blend-multiply"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="w-full bg-pink-600/10 border border-pink-500/20 p-4 rounded-3xl">
            <span className="text-[10px] uppercase tracking-widest font-bold text-pink-500">Spelkod / PIN</span>
            <span className="font-black text-5xl text-indigo-950 block tracking-widest tabular-nums mt-1">{roomState.code}</span>
          </div>
        </div>

        <button
          onClick={onStartGame}
          id="btn-host-start"
          disabled={roomState.players.length === 0}
          className={`w-full mt-8 py-5 px-8 rounded-full font-black text-xl flex items-center justify-center gap-2 transition-all ${
            roomState.players.length > 0
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-indigo-950 shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] active:scale-95 cursor-pointer'
              : 'bg-indigo-100 text-indigo-300 cursor-not-allowed shadow-none'
          }`}
        >
          <Play className="w-6 h-6 fill-current" />
          STARTA SPELET
        </button>
      </div>

      {/* Main Panel */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
        
        {/* Players Lobby Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-3xl font-black text-white">
              Anslutna spelare
              <span className="text-yellow-400 ml-3">{roomState.players.length}</span>
            </h3>
            {roomState.players.length === 0 && (
              <span className="text-indigo-300 font-medium font-sans">Väntar på start...</span>
            )}
          </div>

          {roomState.players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white/5 backdrop-blur-sm rounded-[40px] border border-white/10 h-full">
              <div className="w-20 h-20 bg-white/10 rounded-[30px] flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-white/50 animate-pulse" />
              </div>
              <p className="text-indigo-200 text-lg max-w-sm font-medium">
                Be vännerna att skanna QR-koden för att delta!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto content-start py-2">
              {roomState.players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-3 border border-white/10 shadow-lg"
                >
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-sm shadow-inner overflow-hidden ${player.color}`}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-xl truncate tracking-tight text-white flex-1 block">
                    {player.name}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Game Configurations Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-8 shadow-xl mt-auto">
          <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-6">
            <div className="bg-white/10 p-2 rounded-xl"><Music className="w-5 h-5 text-yellow-400" /></div>
            Välj eller skapa er spellista
          </h3>
 
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {(roomState.presets || [
              { id: "default", name: "🔥 Hits", description: "Blandade populära låtar.", songCount: 10, playCount: 0 },
              { id: "swedish", name: "🇸🇪 Svenskt", description: "Svenska klassiker o hits.", songCount: 10, playCount: 0 },
              { id: "millennium", name: "💿 2000-tal", description: "Nostalgi från tidigt 00-tal.", songCount: 10, playCount: 0 }
            ]).map((preset, idx) => {
              const isSelected = selectedPreset === preset.id;
              // Cycle through gradient colors for variety
              const gradientClass = preset.id === 'default' || idx % 3 === 0
                ? 'from-pink-500/20 to-fuchsia-500/20 border-pink-500/50 shadow-pink-500/20'
                : preset.id === 'swedish' || idx % 3 === 1
                ? 'from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-cyan-500/20'
                : 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-yellow-500/20';

              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectPreset(preset.id)}
                  className={`p-5 rounded-3xl border text-left transition-all relative group flex flex-col justify-between min-h-[140px] ${
                    isSelected
                      ? `bg-gradient-to-r ${gradientClass} text-white shadow-lg`
                      : 'bg-black/20 border-white/10 text-indigo-300 hover:border-white/30'
                  }`}
                >
                  <div>
                    <div className="font-black text-lg mb-1">{preset.name}</div>
                    <p className="text-xs opacity-80 leading-snug font-medium pr-8">{preset.description}</p>
                  </div>
                  <div className="mt-3 flex justify-between items-center text-[10px] uppercase tracking-wider font-black opacity-80">
                    <span>{preset.songCount} låtar</span>
                    {preset.playCount > 0 && (
                      <span className="bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                        {preset.playCount} spelningar
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleGenerate} className="bg-black/20 p-5 rounded-3xl border border-white/10">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiTheme}
                  onChange={(e) => setAiTheme(e.target.value)}
                  placeholder="Eget tema (t.ex. 'Rockballader')"
                  className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-white placeholder-indigo-300/50 focus:outline-none focus:border-yellow-400 focus:bg-white/10 font-medium text-lg transition-all"
                />
                <Sparkles className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-yellow-400 pointer-events-none" />
              </div>
              <button
                type="submit"
                disabled={isGenerating || !aiTheme.trim()}
                className={`py-4 px-8 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${
                  isGenerating || !aiTheme.trim()
                    ? 'bg-white/5 text-indigo-300/50 cursor-not-allowed'
                    : 'bg-yellow-400 text-indigo-950 shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:scale-[1.02] active:scale-95 cursor-pointer'
                }`}
              >
                {isGenerating ? "Genererar..." : "AI Skapa Quiz"}
              </button>
            </div>
            
            <div className="mt-4 flex justify-between items-center px-1">
               {aiGenerationError && (
                 <div className="text-pink-400 text-sm font-bold flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4" />
                   <span>{aiGenerationError}</span>
                 </div>
               )}
               <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-500/20 ml-auto">
                 Spellistan innehåller nu {roomState.questions.length} låtar
               </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
