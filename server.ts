import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

dotenv.config();

let db: Database;
// Initialize SQLite DB
async function initDb() {
  db = await open({
    filename: "./songs.db",
    driver: sqlite3.Database,
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      youtube_link TEXT PRIMARY KEY,
      playable INTEGER DEFAULT 1
    )
  `);
}
initDb();

// Define Types inside the Server directly or import them
interface Question {
  id: string | number;
  artist: string;
  title: string;
  youtube_link?: string;
  preview_url?: string;
  cover_url?: string;
  start_time: number;
  options: string[];
  correct_index: number;
}

interface Player {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  lastAnswerCorrect: boolean | null;
  lastAnswerPoints: number;
  color: string;
}

type RoomStatus =
  | "lobby"
  | "buffering"
  | "countdown"
  | "question"
  | "slow_reveal"
  | "scoreboard"
  | "ended";

interface Room {
  code: string;
  status: RoomStatus;
  players: Player[];
  questions: Question[];
  backupQuestions: Question[];
  currentQuestionIndex: number;
  questionTimer: number;
  questionDuration: number;
  answersCount: number;
  countdown: number;
  // Sockets
  hostSocket: WebSocket | null;
  playerSockets: Map<string, WebSocket>; // playerId -> WebSocket
  timerIntervalId: NodeJS.Timeout | null;
  preset?: string;
}

const SONGS_PER_GAME = 10;
const MAX_SONGS_PER_LIST = 50;
const SONGS_PER_GEN = 25;

const playlistsPath = path.join(process.cwd(), "playlists.json");
let playlistsData: any = { default: [], swedish: [], millennium: [] };
try {
  playlistsData = JSON.parse(fs.readFileSync(playlistsPath, "utf8"));
} catch (e) {
  console.warn("Could not load playlists.json", e);
}

const DEFAULT_QUESTIONS: Question[] = playlistsData.default || [];

const PRESET_QUZZES: Record<string, Question[]> = {
  swedish: playlistsData.swedish || [],
  millennium: playlistsData.millennium || [],
};

const rooms = new Map<string, Room>();

const cachedPlaylistsPath = path.join(process.cwd(), "cached_playlists.json");
let lastGenerationTime = 0;

function loadCachedPlaylists(): Record<string, any> {
  try {
    if (fs.existsSync(cachedPlaylistsPath)) {
      const cache = JSON.parse(fs.readFileSync(cachedPlaylistsPath, "utf8"));
      let migrated = false;
      for (const [key, val] of Object.entries(cache)) {
        if (Array.isArray(val)) {
          cache[key] = {
            theme: key,
            questions: val,
            playCount: 0,
          };
          migrated = true;
        }
      }
      if (migrated) {
        saveCachedPlaylists(cache);
        console.log(
          "[Cache Migration] Successfully migrated legacy array playlists to object format in cached_playlists.json",
        );
      }
      return cache;
    }
  } catch (e) {
    console.error("Failed to load cached_playlists.json", e);
  }
  return {};
}

function saveCachedPlaylists(data: Record<string, any>) {
  try {
    fs.writeFileSync(
      cachedPlaylistsPath,
      JSON.stringify(data, null, 2),
      "utf8",
    );
  } catch (e) {
    console.error("Failed to save cached_playlists.json", e);
  }
}

async function getOrCreatePresetQuestions(
  presetId: string,
): Promise<Question[]> {
  try {
    const themeMap: Record<string, string> = {
      hiphop90: "90-tals Hiphop",
      epadunk: "Epa-dunk",
    };

    const theme = themeMap[presetId];
    if (!theme) return [];

    const cacheKey = presetId;
    const cache = loadCachedPlaylists();
    const cachedEntry = cache[cacheKey];

    if (cachedEntry) {
      return Array.isArray(cachedEntry) ? cachedEntry : cachedEntry.questions;
    }

    const client = getGeminiClient();
    if (!client) {
      return [];
    }

    console.log(
      `[AI Auto-Generation] Generating default preset "${theme}" on the fly...`,
    );
    const prompt = `Skapa ett svenskt musikquiz med temat "${theme}" bestående av exakt ${MAX_SONGS_PER_LIST} frågor. 
Varje fråga måste representera en känd, mycket populär låt.
För varje låt, ge en giltig YouTube-video (video ID, t.ex. 'unfzfe8f9NI' för ABBA Mamma Mia) och en starttid i sekunder där intro eller refräng börjar (t.ex. 30).
Ge exakt 4 svarsalternativ där ett är rätt.

Du måste svara strikt i JSON-format enligt detta schema:
En array av objekt med följande tvingade fält:
{
  "artist": "Grupp eller artist",
  "title": "Låttitel",
  "youtube_link": "A valid 11-char YouTube ID",
  "start_time": siffra (i sekunder, t.ex. 25),
  "options": [4 stycken alternativerkombinationer, t.ex. "Låt - Artist" både låt och artist måste vara med. Det rätta svaret måste vara ett av alternativen!],
  "correct_index": index för det rätta alternativet i arrayen (0-3)
}`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              artist: { type: Type.STRING },
              title: { type: Type.STRING },
              youtube_link: { type: Type.STRING },
              start_time: { type: Type.INTEGER },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correct_index: { type: Type.INTEGER },
            },
            required: [
              "artist",
              "title",
              "youtube_link",
              "start_time",
              "options",
              "correct_index",
            ],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text from Gemini");
    const newQuestions = JSON.parse(text);

    const enrichedQuestions = await Promise.all(
      newQuestions.map(async (q: any, idx: number) => {
        const enriched = await enrichWithItunes(q);
        enriched.id = `ai_${idx}_${Date.now()}`;
        const cached = await downloadAndCacheMedia(enriched);
        return cached;
      }),
    );

    const validQuestions = enrichedQuestions.filter((q) => q.youtube_link);

    // Save to cache
    cache[cacheKey] = {
      theme: theme,
      questions: validQuestions,
      playCount: 0,
    };
    saveCachedPlaylists(cache);

    return validQuestions;
  } catch (err) {
    console.error(
      `Failed to get or create preset questions for ${presetId}:`,
      err,
    );
    return [];
  }
}

const PLAYER_COLORS = [
  "bg-violet-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
];

// Lazy-initialize Gemini API
let genAI: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY_API;
  if (!genAI && apiKey) {
    genAI = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAI;
}

async function enrichWithItunes(q: Question): Promise<Question> {
  try {
    const query = encodeURIComponent(`${q.artist} ${q.title}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`,
    );
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      if (track.previewUrl) {
        q.preview_url = track.previewUrl;
      }
      if (track.artworkUrl100) {
        // Get a slightly larger cover if possible
        q.cover_url = track.artworkUrl100.replace("100x100bb", "600x600bb");
      }
    }
  } catch (error) {
    console.error("Failed to fetch iTunes data for", q.artist, q.title);
  }
  return q;
}

const mediaDir = path.join(process.cwd(), "media");
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

function pruneMediaCacheIfNeeded() {
  try {
    const files = fs.readdirSync(mediaDir);
    const fileStats = files.map((file) => {
      const filePath = path.join(mediaDir, file);
      const stat = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: stat.size,
        mtime: stat.mtimeMs,
      };
    });

    let totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);
    const MAX_CACHE_SIZE = 256 * 1024 * 1024; // 256 MB

    if (totalSize > MAX_CACHE_SIZE) {
      console.log(
        `[Media Cache Pruning] Cache size (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds limit of 256 MB. Pruning...`,
      );
      // Sort files by last modified time (oldest first)
      fileStats.sort((a, b) => a.mtime - b.mtime);

      for (const f of fileStats) {
        if (totalSize <= MAX_CACHE_SIZE) break;
        try {
          fs.unlinkSync(f.path);
          totalSize -= f.size;
          console.log(
            `[Media Cache Pruning] Deleted oldest cache file: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`,
          );
        } catch (err) {
          console.error(
            `[Media Cache Pruning] Failed to delete file ${f.path}:`,
            err,
          );
        }
      }
      console.log(
        `[Media Cache Pruning] Pruning complete. New cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      );
    }
  } catch (err) {
    console.error("[Media Cache Pruning] Error pruning media cache:", err);
  }
}

async function downloadAndCacheMedia(q: Question): Promise<Question> {
  if (!q.preview_url) return q;
  if (q.preview_url.startsWith("/media/")) return q;

  try {
    const sanitizedId = String(q.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    let ext = ".m4a";
    if (q.preview_url.includes(".mp3")) ext = ".mp3";
    const filename = `${sanitizedId}${ext}`;
    const destPath = path.join(mediaDir, filename);

    if (fs.existsSync(destPath)) {
      q.preview_url = `/media/${filename}`;
      return q;
    }

    console.log(
      `[Media Cache] Downloading preview for: ${q.artist} - ${q.title}...`,
    );
    const res = await fetch(q.preview_url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));

    // Check and prune cache if size exceeds 256 MB
    pruneMediaCacheIfNeeded();

    q.preview_url = `/media/${filename}`;
    console.log(`[Media Cache] Successfully cached to ${q.preview_url}`);
  } catch (err) {
    console.error(
      `[Media Cache] Failed to download media for ${q.artist} - ${q.title}:`,
      err,
    );
  }
  return q;
}

async function cacheAllBuiltInPlaylistsMedia() {
  console.log(
    "[Media Cache] Pre-caching built-in playlists media in background...",
  );
  for (const q of DEFAULT_QUESTIONS) {
    await downloadAndCacheMedia(q);
  }
  for (const [name, list] of Object.entries(PRESET_QUZZES)) {
    for (const q of list) {
      await downloadAndCacheMedia(q);
    }
  }
  console.log("[Media Cache] Finished pre-caching built-in playlists media.");
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function broadcastToRoom(room: Room, message: any) {
  const payload = JSON.stringify(message);

  // Send to host
  if (room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN) {
    room.hostSocket.send(payload);
  }

  // Send to all players
  for (const [playerId, socket] of room.playerSockets.entries()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

function sendRoomState(room: Room) {
  // Load caches to check sizes of dynamic defaults
  const cache = loadCachedPlaylists();

  const getDynamicDefaultCount = (presetId: string, defaultValue: number) => {
    const entry = cache[presetId];
    if (entry) {
      const q = Array.isArray(entry) ? entry : entry.questions;
      return q ? q.length : defaultValue;
    }
    return defaultValue;
  };

  const getDynamicDefaultPlayCount = (presetId: string) => {
    const entry = cache[presetId];
    if (entry && !Array.isArray(entry)) {
      return entry.playCount || 0;
    }
    return 0;
  };

  const defaultPresets: any[] = [
    {
      id: "default",
      name: "🔥 Hits",
      description: "Blandade populära låtar.",
      actualSongCount: DEFAULT_QUESTIONS.length,
      playCount: getDynamicDefaultPlayCount("default"),
      isDefault: true,
    },
    {
      id: "swedish",
      name: "🇸🇪 Svenskt",
      description: "Svenska klassiker o hits.",
      actualSongCount: PRESET_QUZZES.swedish.length,
      playCount: getDynamicDefaultPlayCount("swedish"),
      isDefault: true,
    },
    {
      id: "millennium",
      name: "💿 2000-tal",
      description: "Nostalgi från tidigt 00-tal.",
      actualSongCount: PRESET_QUZZES.millennium.length,
      playCount: getDynamicDefaultPlayCount("millennium"),
      isDefault: true,
    },
    {
      id: "hiphop90",
      name: "🎤 90-tals Hiphop",
      description: "Klassisk hiphop från 90-talet.",
      actualSongCount: getDynamicDefaultCount("hiphop90", MAX_SONGS_PER_LIST),
      playCount: getDynamicDefaultPlayCount("hiphop90"),
      isDefault: true,
    },
    {
      id: "epadunk",
      name: "🚗 Epa-dunk",
      description: "Riktigt bra epa-dunk och festmusik.",
      actualSongCount: getDynamicDefaultCount("epadunk", MAX_SONGS_PER_LIST),
      playCount: getDynamicDefaultPlayCount("epadunk"),
      isDefault: true,
    },
  ];

  // Extract custom presets (excluding the dynamic default ones)
  const customPresets: any[] = [];
  const defaultKeys = new Set([
    "default",
    "swedish",
    "millennium",
    "hiphop90",
    "epadunk",
  ]);
  for (const [key, entry] of Object.entries(cache)) {
    if (defaultKeys.has(key)) continue;

    const questions = Array.isArray(entry) ? entry : entry.questions || [];
    const playCount = Array.isArray(entry) ? 0 : entry.playCount || 0;
    const theme = Array.isArray(entry) ? key : entry.theme || key;

    // Capitalize display name cleanly
    const displayName = theme.charAt(0).toUpperCase() + theme.slice(1);

    customPresets.push({
      id: `custom_${key}`,
      name: `✨ ${displayName}`,
      description: `AI-skapad spellista.`,
      actualSongCount: questions.length,
      playCount: playCount,
      isDefault: false,
    });
  }

  // Combine all lists
  const allPresets = [...defaultPresets, ...customPresets];

  // Rank all playlists:
  // 1. Play count (number of times it has been played)
  // 2. Most songs (up to 50)
  // 3. Defaults have priority if counts are equal (keep isDefault sorted higher)
  allPresets.sort((a, b) => {
    if (b.playCount !== a.playCount) {
      return b.playCount - a.playCount;
    }
    if (b.actualSongCount !== a.actualSongCount) {
      return b.actualSongCount - a.actualSongCount;
    }
    const aDef = a.isDefault ? 1 : 0;
    const bDef = b.isDefault ? 1 : 0;
    return bDef - aDef;
  });

  // Limit to top 3 presets presented in the lobby and display SONGS_PER_GAME (10) as their song count
  const presentedPresets = allPresets.slice(0, 3).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    songCount: SONGS_PER_GAME,
    playCount: preset.playCount,
    isDefault: preset.isDefault,
  }));

  // Map internal state to RoomState matching client types
  const statePayload = {
    code: room.code,
    status: room.status,
    players: room.players,
    presets: presentedPresets,
    questions:
      room.status === "lobby"
        ? room.questions.map((q) => ({ id: q.id }) as any)
        : room.questions.map((q) => ({
            id: q.id,
            artist: q.artist,
            title: q.title,
            youtube_link: q.youtube_link,
            preview_url: q.preview_url,
            cover_url: q.cover_url,
            start_time: q.start_time,
            options: q.options,
            // Hide correct index if we are currently mid-question to prevent cheating
            correct_index:
              room.status === "slow_reveal" ||
              room.status === "scoreboard" ||
              room.status === "ended"
                ? q.correct_index
                : -1,
          })),
    currentQuestionIndex: room.currentQuestionIndex,
    questionTimer: room.questionTimer,
    questionDuration: room.questionDuration,
    answersCount: room.answersCount,
    countdown: room.countdown,
  };

  broadcastToRoom(room, {
    type: "room_state",
    state: statePayload,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/media", express.static(path.join(process.cwd(), "media")));

  // API endpoint to generate quiz questions using AI
  app.post("/api/quiz/generate", async (req, res) => {
    try {
      const { theme } = req.body;
      if (!theme) {
        return res
          .status(400)
          .json({ error: "Ett tema krävs för AI-generering." });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.status(403).json({
          error: "API genereringen är inte aktivt",
        });
      }

      const cacheKey = theme.trim().toLowerCase();
      const cache = loadCachedPlaylists();
      const cachedEntry = cache[cacheKey];
      const existingQuestions = cachedEntry
        ? Array.isArray(cachedEntry)
          ? cachedEntry
          : cachedEntry.questions || []
        : [];

      // If the cache already has MAX_SONGS_PER_LIST or more songs, return cached questions immediately.
      // This bypasses both the Gemini call and the cooldown check!
      if (existingQuestions.length >= MAX_SONGS_PER_LIST) {
        console.log(
          `[Cache Hit] Serving fully loaded playlist for theme: ${theme} (count: ${existingQuestions.length})`,
        );
        return res.json({ questions: existingQuestions });
      }

      // Check Cooldown
      const now = Date.now();
      const cooldownMs = 120 * 60 * 1000;
      if (now - lastGenerationTime < cooldownMs) {
        // If cooldown is active, but we already have at least SONGS_PER_GAME songs cached for this theme,
        // we can bypass the cooldown error and serve the cached questions!
        if (existingQuestions.length >= SONGS_PER_GAME) {
          console.log(
            `[Cache Cooldown Bypass] Serving existing cached playlist for theme: ${theme} (count: ${existingQuestions.length}) due to active cooldown.`,
          );
          return res.json({ questions: existingQuestions });
        }

        const remainingMs = cooldownMs - (now - lastGenerationTime);
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        return res.status(429).json({
          error: `AI:n återhämtar sig med en Jack & Coke för att orka nästa generering. Försök igen om ${minutes} minuter och ${seconds} sekunder.`,
        });
      }

      // Calculate how many songs to fetch. We aim to fetch SONGS_PER_GEN.
      const fetchAmount = SONGS_PER_GEN;
      console.log(
        `[AI Generation] Fetching ${fetchAmount} songs for theme "${theme}" (existing cached count: ${existingQuestions.length})`,
      );

      // Prepare list of existing songs to avoid duplicates
      const existingSongsStr = existingQuestions
        .map((q) => `${q.artist} - ${q.title}`)
        .join(", ");
      const avoidInstructions = existingSongsStr
        ? `\nVIKTIGT: Undvik att generera följande låtar som redan finns i spellistan: ${existingSongsStr}`
        : "";

      const prompt = `Skapa ett svenskt musikquiz med temat "${theme}" bestående av exakt ${fetchAmount} frågor. 
Varje fråga måste representera en känd, mycket populär låt.${avoidInstructions}
Varje fråga måste representera en unik låt (inte samma som de som listas ovan).
För varje låt, ge en giltig YouTube-video (video ID, t.ex. 'unfzfe8f9NI' för ABBA Mamma Mia) och en starttid i sekunder där intro eller refräng börjar (t.ex. 30).
Ge exakt 4 svarsalternativ där ett är rätt.

Du måste svara strikt i JSON-format enligt detta schema:
En array av objekt med följande tvingade fält:
{
  "artist": "Grupp eller artist",
  "title": "Låttitel",
  "youtube_link": "A valid 11-char YouTube ID",
  "start_time": siffra (i sekunder, t.ex. 25),
  "options": [4 stycken alternativerkombinationer, t.ex. "Låt - Artist" både låt och artist måste vara med. Det rätta svaret måste vara ett av alternativen!],
  "correct_index": index för det rätta alternativet i arrayen (0-3)
}`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                artist: { type: Type.STRING },
                title: { type: Type.STRING },
                youtube_link: {
                  type: Type.STRING,
                  description:
                    "11-char YouTube Video ID. PREFER LYRIC VIDEOS or AUDIO ONLY (non-official) to ensure they allow embedding. Avoid VEVO if possible.",
                },
                start_time: {
                  type: Type.INTEGER,
                  description: "Start time offset in seconds",
                },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactly 4 options, including the correct one",
                },
                correct_index: {
                  type: Type.INTEGER,
                  description: "0-3 index of correct answer in options array",
                },
              },
              required: [
                "artist",
                "title",
                "youtube_link",
                "start_time",
                "options",
                "correct_index",
              ],
            },
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Ingen text genererad av Gemini");
      }

      const newQuestions = JSON.parse(text);

      // Enrich with iTunes and filter duplicates/invalid
      const enrichedQuestions = await Promise.all(
        newQuestions.map(async (q: any, idx: number) => {
          const enriched = await enrichWithItunes(q);
          enriched.id = `ai_${idx}_${Date.now()}`;
          const cached = await downloadAndCacheMedia(enriched);
          return cached;
        }),
      );

      // Merge existing and new, avoiding duplicates by YouTube Link or Title/Artist matching
      const mergedQuestions = [...existingQuestions];
      for (const newQ of enrichedQuestions) {
        const isDuplicate = mergedQuestions.some(
          (eq) =>
            eq.youtube_link === newQ.youtube_link ||
            (eq.artist.toLowerCase() === newQ.artist.toLowerCase() &&
              eq.title.toLowerCase() === newQ.title.toLowerCase()),
        );
        if (!isDuplicate && newQ.youtube_link) {
          mergedQuestions.push(newQ);
        }
      }

      // Check min size: "alltid ha minst SONGS_PER_GAME låtar i listan"
      if (mergedQuestions.length < SONGS_PER_GAME) {
        throw new Error(
          `Kunde inte generera tillräckligt många unika låtar (har bara ${mergedQuestions.length}, kräver minst ${SONGS_PER_GAME}).`,
        );
      }

      // Cap at MAX_SONGS_PER_LIST options: "tills en lista har 50 alternativ"
      if (mergedQuestions.length > MAX_SONGS_PER_LIST) {
        mergedQuestions.splice(MAX_SONGS_PER_LIST);
      }

      // Save updated list to cache in unified object format
      const currentPlayCount =
        cachedEntry && !Array.isArray(cachedEntry)
          ? cachedEntry.playCount || 0
          : 0;
      cache[cacheKey] = {
        theme: theme,
        questions: mergedQuestions,
        playCount: currentPlayCount,
      };
      saveCachedPlaylists(cache);

      // Successfully generated, update lastGenerationTime
      lastGenerationTime = Date.now();
      console.log(
        `[AI Generation Success] Playlist for theme "${theme}" now has ${mergedQuestions.length} songs. Cooldown triggered.`,
      );

      res.json({ questions: mergedQuestions });
    } catch (err: any) {
      console.error("AI Generation error:", err);
      res.status(500).json({
        error: "Kunde inte generera quiz med AI. Fallback till standardval.",
        details: err.message,
      });
    }
  });

  // Serve static files in production
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Websocket game coordination
  wss.on("connection", (ws) => {
    let currentRoomCode: string | null = null;
    let playerId: string | null = null;
    let isHostConnection = false;

    ws.on("message", async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        switch (message.type) {
          case "host_create": {
            isHostConnection = true;
            const code = generateRoomCode();
            let finalQuestions = DEFAULT_QUESTIONS;

            if (message.preset && PRESET_QUZZES[message.preset]) {
              finalQuestions = PRESET_QUZZES[message.preset];
            } else if (
              message.preset &&
              (message.preset === "hiphop90" || message.preset === "epadunk")
            ) {
              finalQuestions = await getOrCreatePresetQuestions(message.preset);
            } else if (message.preset && message.preset.startsWith("custom_")) {
              const cacheKey = message.preset.replace("custom_", "");
              const cache = loadCachedPlaylists();
              const cachedEntry = cache[cacheKey];
              if (cachedEntry) {
                finalQuestions = Array.isArray(cachedEntry)
                  ? cachedEntry
                  : cachedEntry.questions;
              }
            } else if (
              message.customQuestions &&
              Array.isArray(message.customQuestions) &&
              message.customQuestions.length > 0
            ) {
              finalQuestions = message.customQuestions;
            }

            // Preset questions are pre-enriched in playlists.json. Custom ones are enriched during generation.
            if (!message.customQuestions) {
              // Filter out known unplayable songs
              const unplayableRows = await db.all(
                "SELECT youtube_link FROM songs WHERE playable = 0",
              );
              const unplayableSet = new Set(
                unplayableRows.map((r) => r.youtube_link),
              );
              finalQuestions = finalQuestions.filter(
                (q) => !q.youtube_link || !unplayableSet.has(q.youtube_link),
              );
            }

            // Shuffle questions and options
            finalQuestions = shuffleArray(finalQuestions).map((q: Question) => {
              const newQ = { ...q };
              if (newQ.options && newQ.options.length > 0) {
                const correctOptionStr = newQ.options[newQ.correct_index];
                newQ.options = shuffleArray(newQ.options);
                newQ.correct_index = newQ.options.indexOf(correctOptionStr);
              }
              return newQ;
            });

            const newRoom: Room = {
              code,
              status: "lobby",
              players: [],
              questions: finalQuestions,
              backupQuestions: [],
              currentQuestionIndex: 0,
              questionTimer: 25,
              questionDuration: message.duration || 25,
              answersCount: 0,
              countdown: 5,
              hostSocket: ws,
              playerSockets: new Map(),
              timerIntervalId: null,
              preset: message.preset,
            };

            rooms.set(code, newRoom);
            currentRoomCode = code;

            ws.send(
              JSON.stringify({
                type: "host_created",
                roomCode: code,
                questions: finalQuestions,
              }),
            );

            sendRoomState(newRoom);
            break;
          }

          case "host_report_unplayable": {
            if (!isHostConnection || !currentRoomCode) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const youtubeLink = message.youtube_link;
            if (youtubeLink) {
              console.log(
                `[Host Report] Song unplayable, marking in DB: ${youtubeLink}`,
              );
              // Insert or update DB
              await db.run(
                "INSERT OR REPLACE INTO songs (youtube_link, playable) VALUES (?, 0)",
                [youtubeLink],
              );

              // Find the current question and replace it with the next one from backup if available
              if (room.backupQuestions && room.backupQuestions.length > 0) {
                const replacement = room.backupQuestions.shift()!;
                room.questions[room.currentQuestionIndex] = replacement;
                console.log(
                  `[Host Report] Replaced question with: ${replacement.title}`,
                );
                // Re-broadcast state so the client reloads the YouTube iframe
                sendRoomState(room);
              } else {
                // No backup questions available. Skip this song by removing it from the active questions array.
                console.log(
                  `[Host Report] No backup questions available. Skipping unplayable song: ${room.questions[room.currentQuestionIndex]?.title || youtubeLink}`,
                );
                room.questions.splice(room.currentQuestionIndex, 1);

                if (room.currentQuestionIndex >= room.questions.length) {
                  // No more songs left, end the game!
                  room.status = "ended";

                  // Increment play count of the preset since the game is finished
                  if (room.preset) {
                    const presetId = room.preset;
                    const isCustom = presetId.startsWith("custom_");
                    const cacheKey = isCustom
                      ? presetId.replace("custom_", "")
                      : presetId;

                    const cache = loadCachedPlaylists();
                    if (!cache[cacheKey]) {
                      cache[cacheKey] = {
                        playCount: 0,
                      };
                    }

                    const entry = cache[cacheKey];
                    if (entry && !Array.isArray(entry)) {
                      entry.playCount = (entry.playCount || 0) + 1;
                      saveCachedPlaylists(cache);
                      console.log(
                        `[Play Count] Incremented playCount for preset "${presetId}" (cacheKey: "${cacheKey}") to ${entry.playCount}`,
                      );
                    }
                  }
                }
                sendRoomState(room);
              }
            }
            break;
          }

          case "player_join": {
            const { roomCode, name, playerId: requestedPlayerId } = message;
            const room = rooms.get(roomCode?.toUpperCase());

            if (!room) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Hittade inte rummet. Kontrollera PIN-koden!",
                }),
              );
              return;
            }

            currentRoomCode = room.code;
            playerId =
              requestedPlayerId ||
              `p_${Math.random().toString(36).substr(2, 9)}`;

            // Check if player is already in room (reconnection)
            let player = room.players.find((p) => p.id === playerId);
            if (!player) {
              // Create new player
              player = {
                id: playerId!,
                name: name || "Anonym",
                score: 0,
                hasAnswered: false,
                lastAnswerCorrect: null,
                lastAnswerPoints: 0,
                color:
                  PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
              };
              room.players.push(player);
            }

            // Save player socket
            room.playerSockets.set(playerId!, ws);

            ws.send(
              JSON.stringify({
                type: "join_success",
                playerId: playerId!,
                roomCode: room.code,
              }),
            );

            sendRoomState(room);
            break;
          }

          case "host_start_game": {
            const room = rooms.get(currentRoomCode || "");
            if (!room || !isHostConnection) return;

            let requestedCount = parseInt(message.songCount) || SONGS_PER_GAME;
            if (requestedCount < 1) requestedCount = SONGS_PER_GAME;

            const listSize = room.questions.length;
            const finalCount = Math.min(
              requestedCount,
              listSize,
              MAX_SONGS_PER_LIST,
            );

            // Slice the stored questions
            const questionsToPlay = room.questions.slice(0, finalCount);
            const backupQuestions = room.questions.slice(finalCount);

            room.questions = questionsToPlay;
            room.backupQuestions = backupQuestions;

            room.status = "buffering";
            room.currentQuestionIndex = 0;
            room.answersCount = 0;

            // Clean up old timers
            if (room.timerIntervalId) {
              clearInterval(room.timerIntervalId);
              room.timerIntervalId = null;
            }

            sendRoomState(room);
            break;
          }

          case "host_media_ready": {
            const room = rooms.get(currentRoomCode || "");
            if (!room || !isHostConnection || room.status !== "buffering")
              return;

            // Only show 5-second countdown for the very first question
            if (room.currentQuestionIndex === 0) {
              room.status = "countdown";
              room.countdown = 5;
              if (room.timerIntervalId) clearInterval(room.timerIntervalId);
              sendRoomState(room);
              room.timerIntervalId = setInterval(() => {
                room.countdown--;
                if (room.countdown <= 0) {
                  clearInterval(room.timerIntervalId!);
                  room.timerIntervalId = null;
                  startQuestion(room);
                } else {
                  sendRoomState(room);
                }
              }, 1000);
            } else {
              startQuestion(room);
            }
            break;
          }

          case "player_submit_answer": {
            const room = rooms.get(currentRoomCode || "");
            if (!room || !playerId) return;

            const player = room.players.find((p) => p.id === playerId);
            if (!player || player.hasAnswered || room.status !== "question")
              return;

            const { answerIndex } = message;
            const currentQuestion = room.questions[room.currentQuestionIndex];
            const isCorrect = answerIndex === currentQuestion.correct_index;

            let points = 0;
            if (isCorrect) {
              // Speed factor bonus
              const remainingRatio = room.questionTimer / room.questionDuration;
              points = Math.max(200, Math.round(1000 * remainingRatio));
            }

            player.hasAnswered = true;
            player.lastAnswerCorrect = isCorrect;
            player.lastAnswerPoints = points;
            player.score += points;

            room.answersCount++;

            // Send feedback to this specific player immediately
            ws.send(
              JSON.stringify({
                type: "answer_result",
                isCorrect,
                points,
                correctIndex: currentQuestion.correct_index,
              }),
            );

            // If all players have answered, transit immediately
            const activeConnectedPlayersCount = Array.from(
              room.playerSockets.keys(),
            ).length;
            if (
              room.answersCount >= room.players.length ||
              room.answersCount >= activeConnectedPlayersCount
            ) {
              endQuestion(room);
            } else {
              sendRoomState(room);
            }
            break;
          }

          case "host_reveal_answer": {
            const room = rooms.get(currentRoomCode || "");
            if (!room || !isHostConnection) return;
            endQuestion(room);
            break;
          }

          case "host_next_question": {
            const room = rooms.get(currentRoomCode || "");
            if (!room || !isHostConnection) return;

            if (room.status === "slow_reveal") {
              // Transition to Scoreboard page for this question
              if (room.currentQuestionIndex >= room.questions.length - 1) {
                room.status = "ended";

                // Increment play count of the preset when the game is finished!
                if (room.preset) {
                  const presetId = room.preset;
                  const isCustom = presetId.startsWith("custom_");
                  const cacheKey = isCustom
                    ? presetId.replace("custom_", "")
                    : presetId;

                  const cache = loadCachedPlaylists();
                  if (!cache[cacheKey]) {
                    cache[cacheKey] = {
                      playCount: 0,
                    };
                  }

                  const entry = cache[cacheKey];
                  if (entry && !Array.isArray(entry)) {
                    entry.playCount = (entry.playCount || 0) + 1;
                    saveCachedPlaylists(cache);
                    console.log(
                      `[Play Count] Incremented playCount for preset "${presetId}" (cacheKey: "${cacheKey}") to ${entry.playCount}`,
                    );
                  }
                }
              } else {
                room.status = "scoreboard";
              }
              sendRoomState(room);
            } else if (room.status === "scoreboard") {
              // Transition to next question
              room.currentQuestionIndex++;
              if (room.currentQuestionIndex >= room.questions.length) {
                room.status = "ended";

                // Increment play count of the preset when the game is finished!
                if (room.preset) {
                  const presetId = room.preset;
                  const isCustom = presetId.startsWith("custom_");
                  const cacheKey = isCustom
                    ? presetId.replace("custom_", "")
                    : presetId;

                  const cache = loadCachedPlaylists();
                  if (!cache[cacheKey]) {
                    cache[cacheKey] = {
                      playCount: 0,
                    };
                  }

                  const entry = cache[cacheKey];
                  if (entry && !Array.isArray(entry)) {
                    entry.playCount = (entry.playCount || 0) + 1;
                    saveCachedPlaylists(cache);
                    console.log(
                      `[Play Count] Incremented playCount for preset "${presetId}" (cacheKey: "${cacheKey}") to ${entry.playCount}`,
                    );
                  }
                }

                sendRoomState(room);
              } else {
                room.status = "buffering";
                room.answersCount = 0;

                // Clear state for all players
                room.players.forEach((p) => {
                  p.hasAnswered = false;
                  p.lastAnswerCorrect = null;
                  p.lastAnswerPoints = 0;
                });

                if (room.timerIntervalId) {
                  clearInterval(room.timerIntervalId);
                  room.timerIntervalId = null;
                }

                sendRoomState(room);
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("WS error:", err);
      }
    });

    ws.on("close", () => {
      if (isHostConnection && currentRoomCode) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          // Delay clean up slightly in case host refreshes
          setTimeout(() => {
            const updatedRoom = rooms.get(currentRoomCode!);
            if (
              updatedRoom &&
              (!updatedRoom.hostSocket ||
                updatedRoom.hostSocket.readyState !== WebSocket.OPEN)
            ) {
              if (updatedRoom.timerIntervalId)
                clearInterval(updatedRoom.timerIntervalId);
              // Broadcast room_closed to all players so they get booted back to the start screen
              broadcastToRoom(updatedRoom, { type: "room_closed" });
              rooms.delete(currentRoomCode!);
            }
          }, 3000);
        }
      } else if (playerId && currentRoomCode) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          room.playerSockets.delete(playerId);
          // Keep player record in database but show them disconnected?
          // We can just keep it so if they reconnect they resume
          sendRoomState(room);
        }
      }
    });
  });

  function startQuestion(room: Room) {
    room.status = "question";
    room.questionTimer = room.questionDuration;
    room.answersCount = 0;

    room.players.forEach((p) => {
      p.hasAnswered = false;
      p.lastAnswerCorrect = null;
      p.lastAnswerPoints = 0;
    });

    sendRoomState(room);

    if (room.timerIntervalId) clearInterval(room.timerIntervalId);
    room.timerIntervalId = setInterval(() => {
      room.questionTimer--;
      if (room.questionTimer <= 0) {
        endQuestion(room);
      } else {
        sendRoomState(room);
      }
    }, 1000);
  }

  function endQuestion(room: Room) {
    if (room.timerIntervalId) {
      clearInterval(room.timerIntervalId);
      room.timerIntervalId = null;
    }

    room.status = "slow_reveal";

    // Fill in no-answers for slow players, and explicit feedback so they don't get stuck
    room.players.forEach((p) => {
      if (!p.hasAnswered) {
        p.hasAnswered = true;
        p.lastAnswerCorrect = false;
        p.lastAnswerPoints = 0;

        const socket = room.playerSockets.get(p.id);
        if (socket && socket.readyState === 1) {
          // WebSocket.OPEN
          socket.send(
            JSON.stringify({
              type: "player_feedback",
              isCorrect: false,
              points: 0,
              correctIndex:
                room.questions[room.currentQuestionIndex].correct_index,
            }),
          );
        }
      }
    });

    sendRoomState(room);
  }

  // Vite development integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("index.html", { root: "dist" });
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Musikquiz full-stack server listening on http://localhost:${PORT}`,
    );
    // Pre-cache built-in playlists media in background
    cacheAllBuiltInPlaylistsMedia().catch((err) => {
      console.error("Failed to pre-cache built-in playlists media:", err);
    });
  });
}

startServer();
