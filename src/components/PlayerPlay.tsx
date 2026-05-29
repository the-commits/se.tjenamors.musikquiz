import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Music, Timer, Sparkles, Users, Triangle, Square, Circle, Play, AlertCircle, Award } from 'lucide-react';
import { RoomState, Player } from '../types';

interface PlayerPlayProps {
  roomState: RoomState;
  playerId: string;
  onAnswer: (optionIndex: number) => void;
  lastFeedback: { isCorrect: boolean; points: number; correctIndex: number } | null;
}

export default function PlayerPlay({ roomState, playerId, onAnswer, lastFeedback }: PlayerPlayProps) {
  const player = roomState.players.find((p) => p.id === playerId);

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <AlertCircle className="w-16 h-16 text-rose-400 mb-4 animate-bounce" />
        <h2 className="text-2xl font-display font-black text-white mb-2">Hoppsan! Hittade inte spelaren</h2>
        <p className="text-slate-400 font-sans max-w-sm mb-4">
          Det verkar som att du har kopplats ifrån eller att rummet har stängts av värden.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-display font-bold py-3 px-6 rounded-xl transition-all"
        >
          Ladda om sidan och testa igen
        </button>
      </div>
    );
  }

  // Define styling options matching host styles
  const choices = [
    { icon: Triangle, color: "bg-red-500 active:bg-red-600 border-red-700 hover:scale-[1.01]" },
    { icon: Square, color: "bg-blue-500 active:bg-blue-600 border-blue-700 hover:scale-[1.01]" },
    { icon: Circle, color: "bg-amber-500 active:bg-amber-600 border-amber-700 hover:scale-[1.01]" },
    { icon: Play, rotate: 90, color: "bg-emerald-500 active:bg-emerald-600 border-emerald-700 hover:scale-[1.01]" },
  ];

  // Render player-specific layout based on room state
  switch (roomState.status) {
    
    // 1. WAITING IN LOBBY
    case 'lobby':
      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[70vh] px-4 text-center">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="w-20 h-20 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Check className="w-10 h-10 animate-pulse" />
            </div>

            <h2 className="text-4xl font-black text-white tracking-tighter mb-2 italic">Du är ansluten!</h2>
            <p className="text-indigo-200 font-medium text-base mb-6">
              Väntar på att quizmastern ska dra igång spelet...
            </p>

            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex items-center gap-3 justify-center mb-4 transition-all hover:bg-black/30">
              <div className={`w-5 h-5 rounded-full shadow-inner ${player.color}`} />
              <span className="font-bold text-xl text-white">{player.name}</span>
            </div>

            <div className="text-[10px] uppercase tracking-widest font-bold text-indigo-300 flex items-center justify-center gap-2 mt-6 bg-white/5 py-2 px-4 rounded-full border border-white/5">
              <Users className="w-4 h-4" />
              <span>Totalt {roomState.players.length} spelare i lobbyn</span>
            </div>
          </div>
        </div>
      );

    // 1.5. BUFFERING MEDIA
    case 'buffering':
      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[70vh] px-4 text-center">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-10 shadow-2xl relative"
          >
            <div className="absolute inset-0 bg-cyan-500/10 blur-[50px] rounded-[40px] pointer-events-none" />
            <div className="w-20 h-20 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Music className="w-10 h-10 animate-bounce" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2 italic shadow-sm">
              Laddar låten...
            </h2>
            <p className="text-indigo-200 font-medium text-base mb-8">
              Gör dig redo att svara!
            </p>
          </motion.div>
        </div>
      );

    // 2. COUNTDOWN FOR NEXT START
    case 'countdown':
      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[70vh] px-4 text-center">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-10 shadow-2xl relative"
          >
            <div className="absolute inset-0 bg-yellow-500/10 blur-[50px] rounded-[40px] pointer-events-none" />
            <Timer className="w-16 h-16 text-yellow-500 mx-auto mb-6 animate-[spin_5s_linear_infinite]" />
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2 italic shadow-sm">
              Runda startar!
            </h2>
            <p className="text-indigo-200 font-medium text-base mb-8">
              Fokusera på musiken på storskärmen.
            </p>
            <div className="font-black text-8xl text-pink-500 animate-ping drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]">
              {roomState.countdown}
            </div>
          </motion.div>
        </div>
      );

    // 3. QUESTION BUZZER
    case 'question':
      return (
        <div className="flex flex-col h-[85vh] justify-between p-4 gap-4">
          
          {/* Status info bar */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[28px] p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full shadow-inner ${player.color}`} />
              <span className="font-bold text-white text-base truncate max-w-[140px] block">
                {player.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2 bg-black/30 py-2 px-4 rounded-full border border-white/10 font-bold text-xs text-yellow-400 tracking-widest uppercase">
              <Timer className="w-4 h-4" />
              <span>{roomState.questionTimer}s kvar</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!player.hasAnswered ? (
              // 4 giant beautiful touch buttons
              <motion.div
                key="buzzer-list"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-2 gap-4 flex-1 items-stretch"
              >
                {choices.map((choice, i) => {
                  const Icon = choice.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => onAnswer(i)}
                      className={`rounded-[32px] border-b-[8px] text-white flex flex-col justify-center items-center shadow-xl active:translate-y-2 active:border-b-0 transition-all ${choice.color}`}
                    >
                      <Icon className="w-20 h-20 fill-current drop-shadow-md" style={{ transform: choice.rotate ? `rotate(${choice.rotate}deg)` : undefined }} />
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              // Waiting for other answers
              <motion.div
                key="waiting-others"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-8 flex-1 flex flex-col justify-center items-center text-center shadow-2xl"
              >
                <div className="w-20 h-20 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-[28px] flex items-center justify-center mb-6 animate-pulse shadow-inner">
                  <Music className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-white leading-tight mb-3 italic">Svar Registrerat!</h3>
                <p className="text-indigo-200 font-medium text-base max-w-xs">
                  Snyggt jobbat. Väntar nu på dina motspelare eller att tiden rinner ut...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );

    // 4. ROUND FEEDBACK (Correct/Incorrect)
    case 'slow_reveal':
      const isCorrect = lastFeedback?.isCorrect ?? player.lastAnswerCorrect ?? false;
      const points = lastFeedback?.points ?? player.lastAnswerPoints ?? 0;
      const question = roomState.questions[roomState.currentQuestionIndex];

      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[80vh] px-4 text-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
            className={`border rounded-[40px] p-10 shadow-2xl backdrop-blur-md relative overflow-hidden ${
              isCorrect
                ? "bg-white/5 border-emerald-500/50"
                : "bg-white/5 border-rose-500/50"
            }`}
          >
            <div className={`absolute inset-0 blur-[50px] pointer-events-none opacity-20 ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            
            <div className="relative z-10">
              {isCorrect ? (
                <div className="text-emerald-400">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce">
                    <Check className="w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-black uppercase mb-1 italic tracking-tight text-emerald-300 drop-shadow-md">Rätt Svar!</h2>
                  <div className="font-black text-2xl bg-emerald-500/20 border border-emerald-500/30 py-3 px-6 rounded-2xl inline-block my-4 shadow-inner text-white">
                    +{points} poäng
                  </div>
                  <p className="text-indigo-100 font-medium text-base my-2">
                    Snabba fingrar gav dig extra utdelning!
                  </p>
                </div>
              ) : (
                <div className="text-rose-400">
                  <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-black uppercase mb-1 italic tracking-tight text-rose-300 drop-shadow-md">Fel Svar!</h2>
                  <div className="font-black text-2xl text-white opacity-80 bg-rose-500/20 border border-rose-500/30 py-3 px-6 rounded-2xl inline-block my-4 shadow-inner">
                    0 poäng
                  </div>
                  {question && (
                    <p className="text-indigo-100 font-medium text-base my-2">
                       Rätt svar var:<br/><span className="font-black text-white text-lg mt-1 block drop-shadow-sm">{question.options[lastFeedback?.correctIndex ?? question.correct_index]}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-white/10 pt-6 mt-8 flex justify-between items-center text-[10px] uppercase tracking-widest text-indigo-300 font-bold">
                <span>Din totala poäng:</span>
                <span className="font-black text-white text-xl">{player.score} p</span>
              </div>
            </div>
          </motion.div>
        </div>
      );

    // 5. CURRENT SCOREBOARD FEEDBACK ON PHONE
    case 'scoreboard':
      // Find player rank
      const scorePositions = [...roomState.players]
        .sort((a, b) => b.score - a.score);
      const myRank = scorePositions.findIndex((p) => p.id === playerId) + 1;

      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[70vh] px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-[40px] pointer-events-none" />
            <Award className="w-16 h-16 text-cyan-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-bounce" />
            
            <h2 className="text-sm font-bold text-cyan-200 uppercase tracking-[0.2em] mb-2 font-mono">Din Placering</h2>
            <div className="font-black text-7xl text-white my-4 drop-shadow-md">
              #{myRank}
            </div>
            
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 block mb-8 bg-black/20 py-2 px-4 rounded-full border border-white/5 inline-block">
              Total poäng: <span className="text-white text-sm">{player.score} p</span>
            </span>

            <div className="bg-gradient-to-r from-pink-500/10 to-cyan-500/10 p-5 rounded-2xl border border-white/10">
              <p className="text-base text-indigo-100 font-medium leading-relaxed">
                {myRank === 1 ? "🥇 Du dominerar planen! Håll i ledningen!" :
                 myRank === 2 ? "🥈 Otroligt nära toppen! Nästa runda tar du dem!" :
                 myRank === 3 ? "🥉 Pallplats säkrad! Gör dig redo att klättra!" :
                 "🏆 Bra kämpat! Ladda fingrarna för nästa runda!"}
              </p>
            </div>
          </motion.div>
        </div>
      );

    // 6. GAME OVER ON PHONE
    case 'ended':
      return (
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-[80vh] px-4 text-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/20 to-transparent blur-[50px] pointer-events-none" />
            <Check className="w-16 h-16 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            
            <h2 className="text-4xl font-black text-white mb-3 italic tracking-tight">QUIZZET ÄR SLUT!</h2>
            <p className="text-indigo-200 font-medium text-base mb-8">
              Tack för din medverkan. Du presterade fantastiskt!
            </p>

            <div className="space-y-4 mb-8 relative z-10">
              <div className="bg-black/20 p-5 rounded-2xl border border-white/5 flex justify-between items-center shadow-inner">
                <span className="text-xs uppercase font-bold tracking-widest text-indigo-300">Total poäng:</span>
                <span className="font-black text-white text-3xl">{player.score} p</span>
              </div>
            </div>

            <div className="bg-cyan-500/10 p-5 rounded-2xl border border-cyan-500/20 relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block mb-2">
                Quizmaster budskap
              </span>
              <p className="text-sm text-cyan-100 font-medium">
                Kolla storskärmen / TV:n för den spektakulära avslöjningsceremonin och se vem som lyfter bucklan!
              </p>
            </div>
          </motion.div>
        </div>
      );

    default:
      return null;
  }
}
