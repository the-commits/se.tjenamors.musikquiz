import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { RoomState } from '../types';

interface MediaPreloaderProps {
  roomState: RoomState;
  onReportUnplayable: (youtubeLink: string) => void;
}

export default function MediaPreloader({ roomState, onReportUnplayable }: MediaPreloaderProps) {
  // If lobby, preload index 0. Otherwise preload index currentQuestionIndex + 1.
  const targetIndex = roomState.status === 'lobby' ? 0 : roomState.currentQuestionIndex + 1;
  
  if (targetIndex >= roomState.questions.length) {
    return null;
  }

  const nextQuestion = roomState.questions[targetIndex];
  if (!nextQuestion) {
    return null;
  }

  return (
    <PreloadItem
      key={nextQuestion.id}
      question={nextQuestion}
      onReportUnplayable={onReportUnplayable}
    />
  );
}

interface PreloadItemProps {
  key?: string | number;
  question: any;
  onReportUnplayable: (youtubeLink: string) => void;
}

function PreloadItem({ question, onReportUnplayable }: PreloadItemProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reportedRef = useRef<boolean>(false);

  const reportUnplayable = () => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    console.warn(`[Preloader] Song unplayable: ${question.title} (${question.youtube_link})`);
    if (question.youtube_link) {
      onReportUnplayable(question.youtube_link);
    }
  };

  useEffect(() => {
    // Start timeout for 15 seconds to load
    timeoutRef.current = setTimeout(() => {
      console.warn(`[Preloader] Loading timeout for: ${question.title}`);
      reportUnplayable();
    }, 15000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [question.id]);

  const handlePlay = (event: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Pause immediately
    if (event.target.pauseVideo) {
      event.target.pauseVideo();
    } else if (event.target.pause) {
      event.target.pause();
    }
    console.log(`[Preloader] Successfully loaded and verified song: ${question.title}`);
  };

  const handleYouTubeReady = (event: any) => {
    // Mute immediately to avoid any out-loud audio burst during preloading
    event.target.mute();
  };

  const handleYouTubeError = (event: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    reportUnplayable();
  };

  if (question.preview_url) {
    return (
      <audio
        src={question.preview_url}
        autoPlay
        muted
        onPlay={handlePlay}
        onError={handleYouTubeError}
        className="hidden"
      />
    );
  }

  if (question.youtube_link) {
    return (
      <div className="absolute -top-[9999px] -left-[9999px] w-4 h-4 opacity-0 pointer-events-none -z-10">
        <YouTube
          videoId={question.youtube_link}
          opts={{
            height: '10',
            width: '10',
            playerVars: {
              autoplay: 1,
              start: question.start_time || 0,
              controls: 0,
              disablekb: 1,
              origin: typeof window !== 'undefined' ? window.location.origin : ''
            }
          }}
          onReady={handleYouTubeReady}
          onPlay={handlePlay}
          onError={handleYouTubeError}
        />
      </div>
    );
  }

  return null;
}
