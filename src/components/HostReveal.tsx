import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, Video, Award, Disc, AlertCircle } from 'lucide-react';
import YouTube, { YouTubeEvent } from 'react-youtube';
import { RoomState } from '../types';

interface HostRevealProps {
  roomState: RoomState;
  onNextQuestion: () => void;
}

export default function HostReveal({ roomState, onNextQuestion }: HostRevealProps) {
  const currentQuestion = roomState.questions[roomState.currentQuestionIndex];
  const correctOptionIndex = currentQuestion.correct_index;
  const correctOptionText = currentQuestion.options[correctOptionIndex];

  const [hasVideoError, setHasVideoError] = useState(false);

  // Map option colors and shapes
  const optionColors = ["bg-red-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];

  const handleVideoError = (event: YouTubeEvent) => {
    console.error("YouTube Player Error in Reveal:", event.data);
    setHasVideoError(true);
  };

  return (
    <div className="flex flex-col h-full gap-6 justify-between">
      {/* Top Header Reveal */}
      <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/30 rounded-full blur-[60px] pointer-events-none" />
        <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-black px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full inline-block">
          RÄTT SVAR AVSLÖJAT
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-white mt-5 mb-3 italic tracking-tight drop-shadow-md">
          {currentQuestion.artist} — {currentQuestion.title}
        </h2>
        <p className="text-indigo-200 font-medium max-w-xl mx-auto text-lg bg-black/20 py-2 px-6 rounded-full inline-block border border-white/5">
          Rätt svar var: <span className="font-black text-yellow-400">{correctOptionText}</span>
        </p>
      </div>

      {/* Main split view: Video player & Player answers statuses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
        
        {/* Dynamic Mid-view: Embedding working YouTube Video with sound to let them see it */}
        <div className="lg:col-span-7 bg-black/30 border border-white/10 rounded-[32px] p-4 flex flex-col justify-center items-center relative group min-h-[360px] overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="w-full h-full relative z-0 flex items-center justify-center rounded-[24px] overflow-hidden bg-black/50">
             {currentQuestion.cover_url ? (
                <>
                  <img src={currentQuestion.cover_url} alt="Cover" className="w-full h-full object-cover blur-sm opacity-50 absolute inset-0" />
                  <img src={currentQuestion.cover_url} alt="Cover" className="h-full object-contain relative z-10 shadow-2xl" />
                  <audio
                    src={currentQuestion.preview_url}
                    autoPlay
                    onError={() => setHasVideoError(true)}
                    className="hidden"
                  />
                </>
             ) : hasVideoError ? (
                <div className="text-center p-6 bg-rose-500/10 rounded-2xl border border-rose-500/30">
                  <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
                  <h3 className="text-xl font-bold text-rose-200">Video ej tillgänglig</h3>
                  <p className="text-rose-300 mt-2 text-sm">Videons ägare tillåter inte inbäddning. Samma gällde troligtvis tyvärr under frågan.</p>
                </div>
             ) : (
                <YouTube
                  videoId={currentQuestion.youtube_link}
                  className="w-full h-full absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:rounded-[24px]"
                  opts={{
                    playerVars: {
                      autoplay: 1,
                      start: currentQuestion.start_time || 0,
                      controls: 1,
                      origin: typeof window !== 'undefined' ? window.location.origin : ''
                    }
                  }}
                  onError={handleVideoError}
                />
             )}
          </div>
        </div>

        {/* Players response statuses for this question */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-[32px] p-8 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-indigo-300 font-bold mb-5 border-b border-white/10 pb-4">
              Resultat för denna runda
            </h3>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
              {roomState.players.length === 0 ? (
                <div className="text-indigo-400/50 text-sm py-6 text-center font-medium">
                  Inga spelare anslutna
                </div>
              ) : (
                roomState.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex justify-between items-center p-3.5 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full shadow-inner ${player.color}`} />
                      <span className="font-bold text-white truncate text-lg">{player.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {player.lastAnswerCorrect ? (
                        <div className="bg-emerald-500/20 text-emerald-300 text-sm font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="tabular-nums">+{player.lastAnswerPoints} p</span>
                        </div>
                      ) : (
                        <div className="bg-white/5 text-indigo-300/50 text-sm font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-white/5">
                          <XCircle className="w-4 h-4" />
                          <span>0 p</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-pink-500/10 p-4 rounded-2xl border border-pink-500/20 mt-6 text-xs text-pink-200 font-medium flex items-start gap-3">
            <Award className="w-5 h-5 text-pink-400 shrink-0" />
            <span className="leading-relaxed">Snabbare svar ger högre poäng (max 1000 p). Den här rundan delade ut fina bonusar!</span>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
          Runda {roomState.currentQuestionIndex + 1} avslutad
        </div>

        <button
          onClick={onNextQuestion}
          id="btn-reveal-next"
          className="bg-gradient-to-r from-emerald-400 to-teal-500 text-indigo-950 font-black py-4 px-10 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] active:scale-95 text-lg flex items-center gap-2 cursor-pointer"
        >
          Visa Ställningen
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
