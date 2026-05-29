import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Users, Music, AlertTriangle, Sparkles, RefreshCw, HelpCircle, ArrowRight } from 'lucide-react';
import { RoomState, SocketMessage, Question } from './types';

// Component imports
import HostLobby from './components/HostLobby';
import HostQuestion from './components/HostQuestion';
import HostReveal from './components/HostReveal';
import HostScoreboard from './components/HostScoreboard';
import PlayerJoin from './components/PlayerJoin';
import PlayerPlay from './components/PlayerPlay';

export default function App() {
  // Navigation / Role selection states
  // 'landing' | 'host' | 'player'
  const [role, setRole] = useState<'landing' | 'host' | 'player'>('landing');

  // Connection & Room state
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerId, setPlayerId] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('default');

  // Feedback for the immediate guess click
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; points: number; correctIndex: number } | null>(null);

  // Connection refs
  const socketRef = useRef<WebSocket | null>(null);

  // Generate or regain a Player ID
  useEffect(() => {
    let pId = sessionStorage.getItem('musikquiz_player_id');
    if (!pId) {
      pId = `p_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('musikquiz_player_id', pId);
    }
    setPlayerId(pId);

    // Deep-linking QR scan handler: Check for ?join=ABCD query
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setRoomCodeInput(joinCode.toUpperCase());
      setRole('player');
    }
  }, []);

  // Sync state correctly if role turns to landing
  const resetLocalConnection = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setRoomState(null);
    setRole('landing');
    setLastFeedback(null);
    setErrorText(null);
  };

  const initWebSocket = (onOpenCallback: (ws: WebSocket) => void) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      onOpenCallback(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'room_state':
            setRoomState(message.state);
            // Clear feedback for next rounds
            if (message.state.status === 'countdown') {
              setLastFeedback(null);
            }
            break;
          
          case 'host_created':
            // Host successfully set up
            break;

          case 'join_success':
            sessionStorage.setItem('musikquiz_player_id', message.playerId);
            setPlayerId(message.playerId);
            setErrorText(null);
            break;

          case 'error':
            setErrorText(message.message);
            // If we failed to join, push back to login
            if (role === 'player' && !roomState) {
              // disconnect
              ws.close();
            }
            break;

          case 'answer_result':
          case 'player_feedback':
            setLastFeedback({
              isCorrect: message.isCorrect,
              points: message.points,
              correctIndex: message.correctIndex
            });
            break;

          case 'room_closed':
            resetLocalConnection();
            break;
        }
      } catch (err) {
        console.error("Client WS error processing message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    socketRef.current = ws;
  };

  // Host Action: Create room
  const handleHostCreate = (preset = 'default', customQuestions?: Question[]) => {
    setSelectedPreset(preset === 'default' && customQuestions ? 'custom' : preset);
    initWebSocket((ws) => {
      ws.send(JSON.stringify({
        type: 'host_create',
        preset,
        customQuestions,
        duration: 25 // 25 seconds timers
      }));
    });
  };

  // Host Action: Trigger start sequence
  const handleHostStartGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'host_start_game' }));
    }
  };

  // Host Action: Reveal question answer immediately
  const handleHostRevealAnswer = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'host_reveal_answer' }));
    }
  };

  // Host Action: Slide to next question
  const handleHostNextQuestion = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'host_next_question' }));
    }
  };

  // Host Action: Report unplayable song to DB and switch immediately
  const handleHostReportUnplayable = (youtubeLink: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'host_report_unplayable', youtube_link: youtubeLink }));
    }
  };

  // Host Action: Choose visual presets and regenerate game list
  const handleSelectPreset = (presetName: string) => {
    handleHostCreate(presetName);
  };

  // Host Action: Submit AI themed questions prompt
  const handleGenerateAIQuiz = async (theme: string) => {
    setAiGenerationError(null);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, amount: 6 })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte generera frågor.");
      }
      if (data.questions && Array.isArray(data.questions)) {
        // Re-create host room with these questions
        handleHostCreate('custom', data.questions);
      } else {
        throw new Error("Genererade frågor var felformaterade.");
      }
    } catch (err: any) {
      setAiGenerationError(err.message || "Ett oväntat fel inträffade vid AI-generering.");
    }
  };

  // Player Action: Join room
  const handlePlayerJoin = (roomCode: string, name: string) => {
    setErrorText(null);
    initWebSocket((ws) => {
      ws.send(JSON.stringify({
        type: 'player_join',
        roomCode,
        name,
        playerId
      }));
    });
  };

  // Player Action: Tap colored choice buttons
  const handlePlayerSubmitAnswer = (optionIndex: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'player_submit_answer',
        answerIndex: optionIndex
      }));
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col font-sans relative overflow-hidden selection:bg-pink-500/30 selection:text-white">
      {/* Absolute glow design grids */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-80 h-80 bg-cyan-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none" />
      
      {/* Global Navbar */}
      <header className="header-navbar h-20 lg:h-24 px-6 lg:px-12 flex justify-between items-center z-30 sticky top-0 border-b border-white/10 bg-white/5 backdrop-blur-md select-none">
        <div className="flex items-center gap-3 cursor-pointer" onClick={resetLocalConnection}>
          <div 
            className="logo-container w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden transform -rotate-6"
          >
            <Music className="w-5 h-5 lg:w-6 lg:h-6 text-white drop-shadow-md" />
          </div>
          <span className="font-display text-2xl lg:text-3xl font-black tracking-tighter italic shadow-sm">
            MUSIKQUIZ
          </span>
        </div>

        {roomState && (
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] lg:text-xs uppercase tracking-widest font-bold opacity-70">Spelkod</span>
              <span className="text-2xl lg:text-4xl font-black text-yellow-400 tabular-nums leading-none">
                {roomState.code}
              </span>
            </div>
            <button
              onClick={resetLocalConnection}
              className="text-xs font-sans text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-full border border-rose-500/30 active:scale-95 transition-all cursor-pointer font-bold shrink-0 uppercase tracking-widest"
            >
              Lämna
            </button>
          </div>
        )}
      </header>

      {/* Main Play Arena container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 relative z-10 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* LANDING PAGE ROUTE */}
          {role === 'landing' && !roomState && (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center justify-center h-full select-none"
            >
              {/* Marketing and greeting intro */}
              <div className="text-left py-4">
                <div className="inline-flex items-center gap-1.5 bg-pink-500/20 border border-pink-500/30 px-4 py-2 rounded-full text-xs text-pink-300 font-bold uppercase tracking-widest mb-4 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>Redo att krossa dina vänner?</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-display font-black text-white tracking-tighter leading-[1.05] mb-4 italic">
                  Tjenamors <span className="text-yellow-400">Musikquiz!</span>
                </h1>
                <p className="text-indigo-200 font-medium text-lg leading-relaxed mb-6">
                  Spela musik direkt från storskärmen. Kompisarna ansluter snabbt med mobilen genom att bara skanna en QR-kod, gissar låtar och tävlar om herraväldet.
                </p>
                <div className="text-indigo-400 opacity-80 text-xs font-bold border-t border-white/10 pt-4 mt-6 uppercase tracking-widest">
                  YouTube-strömmar • Realtidssynk • AI-generator
                </div>
              </div>

              {/* Roles Selector Panel */}
              <div className="flex flex-col gap-4">
                {/* HOST CARD */}
                <button
                  onClick={() => {
                    setRole('host');
                    handleHostCreate('default');
                  }}
                  id="btn-role-host"
                  className="bg-white/5 backdrop-blur-md border border-white/10 text-left p-8 rounded-[40px] hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] transition-all duration-300 outline-none focus:ring-2 focus:ring-yellow-400 group cursor-pointer shadow-xl"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                      <Music className="w-7 h-7 fill-current" />
                    </div>
                    <ArrowRight className="w-6 h-6 text-indigo-400 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
                  </div>
                  <h3 className="text-2xl font-black text-white mt-6 mb-2 tracking-tight">
                    Starta som Värd (Host)
                  </h3>
                  <p className="text-indigo-200 font-medium">
                    Visa på TV:n eller en storskärm. Välj en spellista eller skapa ett personligt AI-quiz.
                  </p>
                </button>

                {/* PLAYER CARD */}
                <button
                  onClick={() => {
                    setRole('player');
                  }}
                  id="btn-role-player"
                  className="bg-white/5 backdrop-blur-md border border-white/10 text-left p-8 rounded-[40px] hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] transition-all duration-300 outline-none focus:ring-2 focus:ring-pink-400 group cursor-pointer shadow-xl"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-pink-500/20 rounded-2xl flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                      <Users className="w-7 h-7" />
                    </div>
                    <ArrowRight className="w-6 h-6 text-indigo-400 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
                  </div>
                  <h3 className="text-2xl font-black text-white mt-6 mb-2 tracking-tight">
                    Gå med som Spelare
                  </h3>
                  <p className="text-indigo-200 font-medium">
                    Motsvarar din handkontroll. Spelare ansluter här för att gissa och tävla.
                  </p>
                </button>
              </div>
            </motion.div>
          )}

          {/* HOST SCREEN SCHEMES */}
          {role === 'host' && roomState && (
            <motion.div
              key="host-views-parent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {roomState.status === 'lobby' && (
                <HostLobby
                  roomState={roomState}
                  onStartGame={handleHostStartGame}
                  onSelectPreset={handleSelectPreset}
                  onGenerateAIQuiz={handleGenerateAIQuiz}
                  aiGenerationError={aiGenerationError}
                  selectedPreset={selectedPreset}
                />
              )}

              {roomState.status === 'countdown' && (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[50vh] select-none">
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="font-display font-black text-slate-400 text-2xl uppercase tracking-widest block mb-4"
                  >
                    Gör er redo! Spelet startar om...
                  </motion.div>
                  <motion.div
                    key={roomState.countdown}
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="text-8xl md:text-9xl font-display font-black text-indigo-400"
                  >
                    {roomState.countdown}
                  </motion.div>
                </div>
              )}

              {roomState.status === 'question' && (
                <HostQuestion
                  roomState={roomState}
                  onRevealAnswer={handleHostRevealAnswer}
                  onReportUnplayable={handleHostReportUnplayable}
                />
              )}

              {roomState.status === 'slow_reveal' && (
                <HostReveal
                  roomState={roomState}
                  onNextQuestion={handleHostNextQuestion}
                  onReportUnplayable={handleHostReportUnplayable}
                />
              )}

              {roomState.status === 'scoreboard' && (
                <HostScoreboard
                  roomState={roomState}
                  onNextQuestion={handleHostNextQuestion}
                  onResetGame={resetLocalConnection}
                />
              )}

              {roomState.status === 'ended' && (
                <HostScoreboard
                  roomState={roomState}
                  onNextQuestion={handleHostNextQuestion}
                  onResetGame={resetLocalConnection}
                />
              )}
            </motion.div>
          )}

          {/* PLAYER SCREEN SCHEMES */}
          {role === 'player' && (
            <motion.div
              key="player-views-parent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {!roomState ? (
                <PlayerJoin
                  onJoin={handlePlayerJoin}
                  error={errorText}
                  initialRoomCode={roomCodeInput}
                />
              ) : (
                <PlayerPlay
                  roomState={roomState}
                  playerId={playerId}
                  onAnswer={handlePlayerSubmitAnswer}
                  lastFeedback={lastFeedback}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Global minimal footer */}
      <footer className="border-t border-white/10 bg-white/5 py-6 px-6 text-center text-xs uppercase tracking-widest font-bold text-indigo-400/80 select-none z-10">
        Tjenamors Musikquiz! &copy; {new Date().getFullYear()} &mdash; Skapad för fantastisk stämning på festen!
      </footer>
    </div>
  );
}
