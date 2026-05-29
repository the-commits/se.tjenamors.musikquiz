import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ArrowRight, Play, Home, Award, Star } from 'lucide-react';
import { RoomState, Player } from '../types';
import confetti from 'canvas-confetti';

interface HostScoreboardProps {
  roomState: RoomState;
  onNextQuestion: () => void;
  onResetGame: () => void;
}

export default function HostScoreboard({ roomState, onNextQuestion, onResetGame }: HostScoreboardProps) {
  const isFinal = roomState.currentQuestionIndex >= roomState.questions.length - 1 || roomState.status === 'ended';
  
  // Sort players descending
  const sortedPlayers = [...roomState.players]
    .sort((a, b) => b.score - a.score)
    .map((player, idx) => ({ ...player, rank: idx + 1 }));

  // Animation triggers for final game podium
  const [visibleRankCutoff, setVisibleRankCutoff] = useState(isFinal ? 4 : 0); // 4 means only ranks >3 are visible initially

  useEffect(() => {
    if (isFinal) {
      // Step-by-step reveal:
      // Show rank 3 after 1.5s
      const timer3 = setTimeout(() => {
        setVisibleRankCutoff(3);
        // Little pop sound or confetti burst could go here, let's fire localized confetti
        confetti({
          particleCount: 20,
          angle: 60,
          spread: 55,
          origin: { x: 0.1, y: 0.8 }
        });
      }, 2000);

      // Show rank 2 after 4s
      const timer2 = setTimeout(() => {
        setVisibleRankCutoff(2);
        confetti({
          particleCount: 25,
          angle: 120,
          spread: 55,
          origin: { x: 0.9, y: 0.8 }
        });
      }, 4500);

      // Show rank 1 after 7s
      const timer1 = setTimeout(() => {
        setVisibleRankCutoff(1);
        
        // Massive grand-finale confetti shower!
        const duration = 4 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          // since particles fall down, animate a bit higher than they would
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
      }, 7000);

      return () => {
        clearTimeout(timer3);
        clearTimeout(timer2);
        clearTimeout(timer1);
      };
    }
  }, [isFinal]);

  // Intermediate scoreboard rendering
  if (!isFinal) {
    return (
      <div className="flex flex-col h-full gap-8 justify-between">
        <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold px-4 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full inline-block">
            AKTUELL STÄLLNING
          </span>
          <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white mt-5 mb-2">
            Vem leder kampen?
          </h2>
          <p className="text-indigo-200 font-medium text-sm bg-black/20 py-2 px-6 rounded-full inline-block border border-white/5 mt-2">
            Rundor spelade: {roomState.currentQuestionIndex + 1} av {roomState.questions.length}
          </p>
        </div>

        {/* Vertical list of ranks and players with transition animations */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[32px] p-8 flex-1 shadow-2xl max-w-3xl mx-auto w-full max-h-[460px] overflow-y-auto">
          <div className="space-y-4">
            {sortedPlayers.length === 0 ? (
              <div className="text-indigo-200 text-sm text-center font-medium py-16">
                Inga spelare anslutna än. Hur lyckades du starta spelet?
              </div>
            ) : (
              sortedPlayers.map((player, idx) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="flex justify-between items-center p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all shadow-lg"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                      player.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-indigo-950 shadow-[0_0_15px_rgba(250,204,21,0.5)]' :
                      player.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 border border-slate-300' :
                      player.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white border border-amber-600' : 'bg-white/10 text-white/50 border border-white/10'
                    }`}>
                      #{player.rank}
                    </div>

                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-4 h-4 rounded-full shrink-0 shadow-inner ${player.color}`} />
                      <span className="font-bold text-white truncate text-xl">{player.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* If player got points last round, animate a points popup label */}
                    {player.lastAnswerPoints > 0 && (
                      <span className="text-[11px] uppercase font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-full select-none animate-bounce shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        +{player.lastAnswerPoints} p!
                      </span>
                    )}
                    <span className="font-black text-cyan-400 text-2xl tabular-nums tracking-tighter">
                      {player.score} p
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard control footer */}
        <div className="flex justify-between items-center mt-2">
          <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
            Ställningen uppdaterad
          </div>
          <button
            onClick={onNextQuestion}
            id="btn-board-next"
            className="bg-gradient-to-r from-cyan-400 to-blue-500 text-indigo-950 font-black py-4 px-10 rounded-full transition-all shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)] active:scale-95 text-lg flex items-center gap-2 cursor-pointer"
          >
            Nästa Fråga
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  // PODIUM CEREMONY (Game Over Screen)
  // Ranks visible: if visibleRankCutoff is 4, then we filter out rank <=3.
  const revealedPlayers = sortedPlayers.map(p => {
    // If rank is 1, 2 or 3, we only show it if cutoff allows
    const isTopThree = p.rank <= 3;
    const isRevealed = !isTopThree || p.rank >= visibleRankCutoff;
    return { ...p, isRevealed };
  });

  const firstPlace = sortedPlayers.find(p => p.rank === 1);
  const secondPlace = sortedPlayers.find(p => p.rank === 2);
  const thirdPlace = sortedPlayers.find(p => p.rank === 3);

  return (
    <div className="flex flex-col h-full gap-8 justify-between">
      {/* Grand Title */}
      <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 rounded-[40px] p-10 shadow-2xl relative overflow-hidden max-w-4xl mx-auto w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-cyan-500/20 blur-[60px] pointer-events-none" />
        <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-5 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-[pulse_2s_infinite]" />
        <span className="text-[10px] uppercase tracking-widest text-yellow-300 font-bold px-4 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full inline-block mb-2">
          RESULTAT & PRISUTDELNING
        </span>
        <h2 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter mt-3 mb-4 drop-shadow-lg">
          GRAND FINALE!
        </h2>
        <p className="text-indigo-200 font-medium max-w-lg mx-auto text-lg bg-black/20 py-3 px-6 rounded-full inline-block border border-white/5">
          Alla frågor är besvarade och poängen är räknade. Här är era vinnare!
        </p>
      </div>

      {/* The Podium Arena */}
      <div className="flex flex-col md:flex-row justify-center items-end gap-6 my-10 max-w-4xl mx-auto w-full min-h-[380px] px-6 select-none">
        
        {/* SECOND PLACE */}
        <AnimatePresence>
          {secondPlace && secondPlace.rank >= visibleRankCutoff && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 70 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15, mass: 1.2 }}
              className="flex flex-col items-center w-full md:w-1/3 order-1 md:order-1"
            >
              <div className="relative mb-3 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full ${secondPlace.color} flex items-center justify-center border-4 border-slate-300 shadow-lg text-white font-black text-xl`}>
                  {secondPlace.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -top-6 bg-slate-300 text-slate-900 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border border-slate-400 flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-current" /> 2ND PLACE
                </div>
              </div>
              <span className="font-display font-bold text-slate-100 text-lg text-center truncate w-full max-w-[140px] block">
                {secondPlace.name}
              </span>
              <span className="font-mono text-indigo-400 text-sm font-bold block mb-4">
                {secondPlace.score} p
              </span>
              
              {/* Silver Pillar */}
              <div className="w-full h-32 bg-slate-800 rounded-t-2xl border-x-4 border-t-4 border-slate-700 flex flex-col justify-center items-center font-display font-black text-3xl text-slate-400">
                <span>2</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FIRST PLACE */}
        <AnimatePresence>
          {firstPlace && firstPlace.rank >= visibleRankCutoff && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 80 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12, mass: 1.5 }}
              className="flex flex-col items-center w-full md:w-1/3 order-2 md:order-2"
            >
              <div className="relative mb-3 flex flex-col items-center">
                <div className={`w-24 h-24 rounded-full ${firstPlace.color} flex items-center justify-center border-4 border-amber-400 shadow-xl text-white font-black text-3xl`}>
                  {firstPlace.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -top-7 bg-amber-400 text-slate-950 text-xs font-display font-black px-3 py-1 rounded-full uppercase border-2 border-amber-500 shadow-lg flex items-center gap-1 animate-bounce">
                  <Trophy className="w-3.5 h-3.5 fill-current" /> VINNARE
                </div>
              </div>
              <span className="font-display font-extrabold text-white text-2xl text-center truncate w-full max-w-[180px] block">
                {firstPlace.name}
              </span>
              <span className="font-mono text-amber-400 text-base font-bold block mb-4">
                {firstPlace.score} p
              </span>
              
              {/* Gold Pillar */}
              <div className="w-full h-44 bg-gradient-to-b from-slate-800 to-indigo-950 rounded-t-2xl border-x-4 border-t-4 border-amber-400 flex flex-col justify-center items-center font-display font-black text-5xl text-amber-400 shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-amber-400/20 blur" />
                <span>1</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* THIRD PLACE */}
        <AnimatePresence>
          {thirdPlace && thirdPlace.rank >= visibleRankCutoff && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15, mass: 1.1 }}
              className="flex flex-col items-center w-full md:w-1/3 order-3 md:order-3"
            >
              <div className="relative mb-3 flex flex-col items-center">
                <div className={`w-14 h-14 rounded-full ${thirdPlace.color} flex items-center justify-center border-4 border-amber-700 shadow-lg text-white font-black text-lg`}>
                  {thirdPlace.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -top-6 bg-amber-700 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border border-amber-800 flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-current" /> 3RD PLACE
                </div>
              </div>
              <span className="font-display font-bold text-slate-100 text-lg text-center truncate w-full max-w-[130px] block">
                {thirdPlace.name}
              </span>
              <span className="font-mono text-indigo-400 text-sm font-bold block mb-4">
                {thirdPlace.score} p
              </span>
              
              {/* Bronze Pillar */}
              <div className="w-full h-24 bg-slate-800 rounded-t-2xl border-x-4 border-t-4 border-slate-700 flex flex-col justify-center items-center font-display font-black text-2xl text-amber-700">
                <span>3</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Runnerups list (Ranks 4+) */}
      {revealedPlayers.filter(p => p.rank > 3).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xl mx-auto w-full">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-3 text-center">Övriga placeringar</span>
          <div className="space-y-2">
            {revealedPlayers.filter(p => p.rank > 3).map((player) => (
              <div key={player.id} className="flex justify-between items-center bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-500">#{player.rank}</span>
                  <div className={`w-2 h-2 rounded-full ${player.color}`} />
                  <span className="font-sans font-bold text-slate-200">{player.name}</span>
                </div>
                <span className="font-display text-sm font-bold text-indigo-400">{player.score} p</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Podium Control Footer */}
      <div className="flex justify-center border-t border-white/10 pt-8 mt-6 pb-4 relative z-10">
        <button
          onClick={onResetGame}
          id="btn-board-reset"
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black py-5 px-12 rounded-full transition-all shadow-2xl backdrop-blur-md flex items-center gap-3 cursor-pointer text-xl uppercase tracking-wider"
        >
          <Home className="w-6 h-6" />
          Avsluta & gå till lobbyn
        </button>
      </div>
    </div>
  );
}
