import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Volume2, Users, Flame, HelpCircle, Triangle, Square, Circle, Play, AlertCircle, Sparkles } from 'lucide-react';
import YouTube, { YouTubeEvent } from 'react-youtube';
import { RoomState } from '../types';

interface HostQuestionProps {
  roomState: RoomState;
  onRevealAnswer: () => void;
  onReportUnplayable?: (youtubeLink: string) => void;
  onMediaReady?: () => void;
}

export default function HostQuestion({ roomState, onRevealAnswer, onReportUnplayable, onMediaReady }: HostQuestionProps) {
  const currentQuestion = roomState.questions[roomState.currentQuestionIndex];
  const timerRatio = roomState.questionTimer / roomState.questionDuration;

  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    // Reset error when question changes
    setHasVideoError(false);
  }, [currentQuestion]);

  // Automatic timeout for buffering stage to detect unplayable/hanging videos
  useEffect(() => {
    let timeoutId: any = null;
    if (roomState.status === 'buffering') {
      timeoutId = setTimeout(() => {
        console.warn("Buffering timeout reached for song:", currentQuestion?.title);
        setHasVideoError(true);
        if (onReportUnplayable && currentQuestion?.youtube_link) {
          onReportUnplayable(currentQuestion.youtube_link);
        }
      }, 15000); // 15 seconds timeout to verify playability
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [roomState.status, currentQuestion, onReportUnplayable]);

  const playerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = (roomState.status === 'buffering');
    }
    if (roomState.status === 'question') {
      if (playerRef.current) {
        if (playerRef.current.unMute) {
          playerRef.current.unMute();
        }
        if (playerRef.current.muted !== undefined) {
          playerRef.current.muted = false;
        }
        if (playerRef.current.playVideo) {
          playerRef.current.playVideo();
        } else if (playerRef.current.play) {
          playerRef.current.play();
        }
      }
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(e => console.error("Failed to play audio:", e));
      }
    }
  }, [roomState.status]);

  const handleYouTubeReady = (event: any) => {
    playerRef.current = event.target;
    if (roomState.status === 'buffering') {
      event.target.mute();
    } else {
      event.target.unMute();
    }
  };

  const handlePlay = (event: any) => {
    // Save reference for later resuming
    if (event && event.target) {
      playerRef.current = event.target;
    }
    if (roomState.status === 'buffering') {
      if (event.target.pauseVideo) event.target.pauseVideo();
      else if (event.target.pause) event.target.pause();
      
      if (onMediaReady) onMediaReady();
    }
  };

  const handleVideoError = (event: YouTubeEvent) => {
    console.error("YouTube Player Error:", event.data);
    setHasVideoError(true);
    if (onReportUnplayable && currentQuestion?.youtube_link) {
      onReportUnplayable(currentQuestion.youtube_link);
    }
  };

  const shapes = [
    { icon: Triangle, color: "bg-red-500 hover:bg-red-600 border-red-700", text: "Röd triangel" },
    { icon: Square, color: "bg-blue-500 hover:bg-blue-600 border-blue-700", text: "Blå fyrkant" },
    { icon: Circle, color: "bg-amber-500 hover:bg-amber-600 border-amber-700", text: "Gul cirkel" },
    { icon: Play, rotate: 95, color: "bg-emerald-500 hover:bg-emerald-600 border-emerald-700", text: "Grön pil" },
  ];

  if (roomState.status === 'buffering') {
    return (
      <div className="flex flex-col h-full items-center justify-center relative min-h-[50vh] text-center select-none w-full">
        {/* Background Audio Player testing in background */}
        {currentQuestion && currentQuestion.preview_url ? (
          <audio
            ref={audioRef}
            src={currentQuestion.preview_url}
            autoPlay
            muted={true}
            onError={() => {
              console.error("Audio Player Error in buffering");
              setHasVideoError(true);
              if (onReportUnplayable && currentQuestion?.youtube_link) {
                onReportUnplayable(currentQuestion.youtube_link);
              }
            }}
            onPlay={handlePlay}
            className="hidden"
          />
        ) : currentQuestion && (
          <div className="absolute -top-[9999px] -left-[9999px] w-4 h-4 opacity-0 pointer-events-none -z-10">
            <YouTube
              videoId={currentQuestion.youtube_link}
              opts={{
                height: '10',
                width: '10',
                playerVars: {
                  autoplay: 1,
                  start: currentQuestion.start_time || 0,
                  controls: 0,
                  disablekb: 1,
                  origin: typeof window !== 'undefined' ? window.location.origin : ''
                }
              }}
              onReady={handleYouTubeReady}
              onPlay={handlePlay}
              onError={handleVideoError}
            />
          </div>
        )}

        {/* Gorgeous Loading Splash Screen Card */}
        <div className="max-w-xl w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-[40px] p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-24 h-24 bg-gradient-to-tr from-pink-500/20 to-cyan-500/20 text-indigo-200 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl relative animate-pulse">
            <Sparkles className="w-12 h-12 text-pink-400 animate-spin" style={{ animationDuration: '4s' }} />
          </div>

          <span className="text-[10px] uppercase tracking-widest text-pink-300 font-black bg-pink-500/20 px-4 py-1.5 rounded-full inline-block mb-3">
            Fråga {roomState.currentQuestionIndex + 1} av {roomState.questions.length}
          </span>
          <h2 className="text-4xl font-black text-white mt-1 mb-4 leading-tight">
            Genererar fråga...
          </h2>
          <p className="text-indigo-200 font-semibold text-lg max-w-sm mx-auto leading-relaxed">
            Testar spelbarhet och förbereder media innan låten spelas högt.
          </p>

          {/* Pulse Loading indicator */}
          <div className="flex gap-2.5 justify-center items-center h-16 mt-8">
            <div className="w-3.5 h-3.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 justify-between relative">
      {/* Background Audio Player */}
      {currentQuestion && currentQuestion.preview_url ? (
        <audio
          ref={audioRef}
          src={currentQuestion.preview_url}
          autoPlay
          muted={false}
          onError={() => setHasVideoError(true)}
          onPlay={handlePlay}
          className="hidden"
        />
      ) : currentQuestion && (
        <div className="absolute -top-[9999px] -left-[9999px] w-4 h-4 opacity-1 pointer-events-none -z-10">
          <YouTube
            videoId={currentQuestion.youtube_link}
            opts={{
              height: '10',
              width: '10',
              playerVars: {
                autoplay: 1,
                start: currentQuestion.start_time || 0,
                controls: 0,
                disablekb: 1,
                origin: typeof window !== 'undefined' ? window.location.origin : ''
              }
            }}
            onReady={handleYouTubeReady}
            onPlay={handlePlay}
            onError={handleVideoError}
          />
        </div>
      )}

      {/* Header section with Timer & Question Info */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Progress Circular Timer */}
        <div className="col-span-12 md:col-span-3 flex justify-center">
          <div className="relative w-40 h-40 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-xl">
            {/* SVG Timer circle */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-md">
              <circle
                cx="80"
                cy="80"
                r="72"
                className="stroke-white/5 fill-none"
                strokeWidth="8"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="72"
                className={`fill-none transition-colors duration-300 ${
                  roomState.questionTimer < 7 ? 'stroke-pink-500' : 'stroke-cyan-400'
                }`}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="452.38"
                animate={{
                  strokeDashoffset: 452.38 * (1 - timerRatio),
                }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </svg>
            <div className="text-center relative z-10">
              <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold block mb-1">TID KVAR</span>
              <span className={`text-6xl font-black tabular-nums leading-none block ${
                roomState.questionTimer < 7 ? 'text-pink-400 animate-pulse' : 'text-white'
              }`}>
                {roomState.questionTimer}
              </span>
            </div>
          </div>
        </div>

        {/* Question Panel */}
        <div className="col-span-12 md:col-span-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-[40px] p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[10px] uppercase tracking-widest text-pink-300 font-black bg-pink-500/20 px-4 py-1.5 rounded-full inline-block mb-3">
            Fråga {roomState.currentQuestionIndex + 1} av {roomState.questions.length}
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-1 mb-6 leading-tight select-none">
            Vilken artist och låt <span className="text-yellow-400 italic">spelas nu?</span>
          </h2>

          {hasVideoError && (
             <div className="mb-4 p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl flex items-center justify-center gap-3 animate-pulse">
                <AlertCircle className="w-6 h-6 text-rose-400" />
                <span className="text-rose-100 font-bold text-sm">Videofel: Ljudet kan inte spelas (upphovsrätt/region). Quizmastern får nynna!</span>
             </div>
          )}
          
          {/* Wave animations mimicking audio activity */}
          <div className="flex gap-1.5 justify-center items-center h-12 overflow-hidden select-none">
            {[...Array(24)].map((_, i) => {
              const heights = [24, 12, 32, 16, 40, 8, 20, 14, 36, 12, 30, 10, 24, 18, 14, 22, 28, 14, 38, 12, 26, 16, 32, 10];
              return (
                <motion.div
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-cyan-400 to-pink-500 rounded-full opacity-80"
                  animate={{
                    height: [heights[i], heights[(i + 5) % heights.length], heights[i]],
                  }}
                  transition={{
                    duration: 0.8 + (i % 3) * 0.2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Answers Counts */}
        <div className="col-span-12 md:col-span-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-[40px] p-6 text-center shadow-lg flex flex-col justify-center h-full">
          <span className="text-[10px] uppercase tracking-widest text-indigo-300 block font-bold mb-1">SVAR INKOMNA</span>
          <span className="text-6xl font-black text-yellow-400 tabular-nums my-1 block">{roomState.answersCount}</span>
          <span className="text-sm text-indigo-200 mt-2 font-medium">
            av {roomState.players.length} anslutna
          </span>
        </div>
      </div>

      {/* Gorgeous rotating Vinyl element panel */}
      <div className="flex justify-center my-6 relative">
        <div className="relative">
          {/* Vinyl Ring */}
          <div className="w-56 h-56 bg-zinc-950 rounded-full border-8 border-zinc-900 flex items-center justify-center shadow-2xl relative overflow-hidden animate-[spin_8s_linear_infinite]">
            <div className="w-52 h-52 rounded-full border border-zinc-800 flex items-center justify-center">
              <div className="w-44 h-44 rounded-full border border-zinc-700 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full border border-zinc-800 flex items-center justify-center">
                  {/* Outer center label */}
                  <div className="w-24 h-24 bg-indigo-950 rounded-full border border-zinc-900 flex items-center justify-center">
                    <HelpCircle className="w-10 h-10 text-indigo-400 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Playing Music Icon pin */}
          <div className="absolute -top-4 right-1/4 w-12 h-20 origin-top rotate-12 transition-transform duration-500">
            <div className="w-2 h-16 bg-slate-400 rounded-md relative flex items-end">
              <div className="w-4 h-4 bg-slate-300 rounded shadow absolute -bottom-1 -left-1 rotate-45" />
            </div>
            <div className="w-5 h-5 bg-slate-600 rounded-full absolute -top-1 left-0 shadow-md border-2 border-slate-500" />
          </div>
        </div>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {shapes.map((shape, i) => {
          const optText = currentQuestion?.options[i] || `Alternativ ${i + 1}`;
          const Icon = shape.icon;
          
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: "spring" }}
              className={`p-6 rounded-[30px] flex items-center justify-between border-b-[6px] text-white text-2xl font-black select-none ${shape.color} shadow-2xl backdrop-blur-sm`}
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 shadow-inner backdrop-blur-md">
                  <Icon className="w-8 h-8 fill-current" style={{ transform: shape.rotate ? `rotate(${shape.rotate}deg)` : undefined }} />
                </div>
                <span className="tracking-tight">{optText}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Host Controls */}
      <div className="flex justify-between items-center mt-2">
        <div className="text-xs text-indigo-300/50 uppercase tracking-widest font-bold">Musik quiz pågår</div>
        <button
          onClick={onRevealAnswer}
          id="btn-reveal"
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-8 rounded-full transition-all text-sm uppercase tracking-widest flex items-center gap-2 active:scale-95 cursor-pointer shadow-lg"
        >
          Avslöja svar direkt
        </button>
      </div>
    </div>
  );
}
