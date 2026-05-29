import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, KeyRound, ArrowRight, ShieldAlert, Sparkles, Music } from 'lucide-react';

interface PlayerJoinProps {
  onJoin: (roomCode: string, name: string) => void;
  error: string | null;
  initialRoomCode?: string;
}

export default function PlayerJoin({ onJoin, error, initialRoomCode = '' }: PlayerJoinProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !name.trim()) return;
    setIsSubmitting(true);
    onJoin(roomCode.trim().toUpperCase(), name.trim());
    
    // Clear loading if error occurs after a delay
    setTimeout(() => {
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[80vh] px-4">
      
      {/* App Branding */}
      <div className="text-center mb-10 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-pink-500/20 rounded-full blur-[50px] pointer-events-none" />
        <div 
          className="w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-xl shadow-pink-500/20 rounded-[28px] overflow-hidden border border-white/10 bg-cover bg-center"
          style={{ backgroundImage: "url('/logo.png')" }}
        >
          <Music className="w-10 h-10 text-white fill-current drop-shadow-lg" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter italic">Tjenamors Musikquiz!</h1>
        <p className="text-indigo-200 font-medium text-base mt-2">
          Häng med i det ultimata musikspelet!
        </p>
      </div>

      {/* Main Card Entry form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-8 shadow-2xl relative"
      >
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Room PIN Input */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-pink-400 font-bold block mb-2 px-1">
              Ange Spelkod/PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 pointer-events-none" />
              <input
                type="text"
                maxLength={4}
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="T.ex. ABCD"
                className="w-full bg-black/20 border border-white/10 focus:border-pink-400 focus:ring-1 focus:ring-pink-400 text-white font-black text-3xl tracking-[0.5em] text-center py-4 pl-12 pr-4 rounded-full focus:outline-none placeholder-indigo-300/30 uppercase transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Nickname Input */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold block mb-2 px-1">
              Ditt Smeknamn
            </label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 pointer-events-none" />
              <input
                type="text"
                maxLength={15}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skriv in namn..."
                className="w-full bg-black/20 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-white font-bold text-xl py-4 pl-12 pr-4 rounded-full focus:outline-none placeholder-indigo-300/30 transition-all shadow-inner"
              />
            </div>
          </div>

          {error && (
            <div className="bg-pink-500/10 border border-pink-500/30 text-pink-300 text-sm py-3 px-5 rounded-2xl flex items-center gap-3 font-medium select-none">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            id="btn-player-join-submit"
            disabled={isSubmitting || !roomCode.trim() || !name.trim()}
            className={`w-full py-5 rounded-full font-black text-xl text-indigo-950 shadow-xl transition-all flex items-center justify-center gap-2 mt-4 ${
              isSubmitting || !roomCode.trim() || !name.trim()
                ? 'bg-white/10 text-white/40 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-yellow-400 to-pink-500 text-white shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_50px_rgba(236,72,153,0.6)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
            }`}
          >
            {isSubmitting ? 'Ansluter...' : 'Gå med i Spel'}
            <ArrowRight className="w-6 h-6" />
          </button>
        </form>
      </motion.div>

      {/* Decorative tagline */}
      <div className="flex items-center justify-center mt-8 gap-2 text-xs text-indigo-300/80 font-medium select-none uppercase tracking-widest">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <span>Gör dig redo för snabba poäng! Let the music play.</span>
      </div>
    </div>
  );
}
