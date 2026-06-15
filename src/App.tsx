import React, { useState, useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Lock,
  Unlock,
  Key,
  HelpCircle,
  RefreshCw,
  Compass,
  AlertTriangle,
  Play,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  Layers,
  Archive,
  Volume2,
  VolumeX,
} from "lucide-react";

interface Puzzle {
  objectName: string;
  description: string;
  status: string;
  requiredItem: string;
  solved: boolean;
}

interface LogEntry {
  id: string;
  sender: "system" | "gm" | "player" | "error";
  text: string;
  timestamp: string;
}

const PRESET_THEMES = [
  {
    id: "space",
    name: "Deep Space Station",
    icon: "🚀",
    desc: "A silent research vessel drifting in orbit with depleting oxygen reservoirs.",
    accent: "text-cyan-400 border-cyan-500/30 shadow-cyan-500/10 hover:shadow-cyan-500/20",
    glow: "glow-text-cyan",
  },
  {
    id: "haunted",
    name: "Cursed Victorian Manor",
    icon: "👻",
    desc: "A decaying mansion where the spirits demand solving ancient, cryptic riddles.",
    accent: "text-purple-400 border-purple-500/30 shadow-purple-500/10 hover:shadow-purple-500/20",
    glow: "",
  },
  {
    id: "cyber",
    name: "Neo-Tokyo Megadome",
    icon: "💾",
    desc: "A rogue AI facility. Escape before your cybernetic brain is permanently formatted.",
    accent: "text-emerald-400 border-emerald-500/30 shadow-emerald-500/10 hover:shadow-emerald-500/20",
    glow: "glow-text-emerald",
  },
  {
    id: "tomb",
    name: "Tomb of the Sun Pharaoh",
    icon: "🏺",
    desc: "An ancient desert sepulcher loaded with booby traps and mechanical gears.",
    accent: "text-amber-400 border-amber-500/30 shadow-amber-500/10 hover:shadow-amber-500/20",
    glow: "glow-text-amber",
  },
];

export default function App() {
  const [theme, setTheme] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [gameState, setGameState] = useState<"setup" | "booting" | "playing" | "escaped" | "failed">("setup");
  const [loadingText, setLoadingText] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  
  // Game metrics
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes countdown
  const [isMuted, setIsMuted] = useState(false);
  const [typedMessage, setTypedMessage] = useState("");
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play subtle vintage terminal chirp
  const playChirp = (frequency = 1200, duration = 0.04, type: "sine" | "square" | "triangle" | "sawtooth" = "sine") => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context block safeguard
    }
  };

  // Pulse clock effect
  useEffect(() => {
    if (gameState !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState("failed");
          addLog("system", "CRITICAL FAILURE: Atmospheric support exhausted. Communication terminal offline.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  // Scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (sender: LogEntry["sender"], text: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs((prev) => [...prev, newLog]);
    
    // Play audio indicators
    if (sender === "gm") {
      playChirp(400, 0.15, "triangle");
    } else if (sender === "system") {
      playChirp(1000, 0.06, "sine");
    } else if (sender === "player") {
      playChirp(800, 0.04, "sine");
    } else if (sender === "error") {
      playChirp(150, 0.25, "sawtooth");
    }
  };

  // Trigger game start API call
  const handleStartGame = async (selectedTheme: string) => {
    if (!selectedTheme.trim()) return;
    setTheme(selectedTheme);
    setGameState("booting");
    setLogs([]);
    
    // Cyber boot effect list
    const steps = [
      "ESTABLISHING SAT-LINK CODES...",
      "SYNCHRONIZING ESCAPE PORT INTERFACES...",
      "GENERATING SPATIAL PARAMETERS...",
      "GAME-MASTER AGENT 'GEMINI v3.5-FLASH' RECRUITED...",
      "COULD NOT DETECT PREVIOUS SAVES. INITIALIZING FRESH SEEPAGE...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingText(steps[i]);
      playChirp(600 + i * 150, 0.08, "sine");
      await new Promise((res) => setTimeout(res, 850));
    }

    try {
      const response = await fetch("/api/escape-room/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedTheme }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed boot protocol.");
      }

      const data = await response.json();
      setRoomName(data.roomName || "Mysterious Chamber");
      setRoomDescription(data.roomDescription || "A dimly lit room containing potential escape path routes.");
      setPuzzles(data.puzzles || []);
      setInventory(data.inventory || []);
      setGameState("playing");
      setTimeLeft(1200); // Reset timer

      // Format initial introduction
      addLog("system", `CONNECTED SECURELY TO SIM LINK. STATUS: ONLINE.`);
      addLog("gm", `[THE MATRIX INITIALIZED - THEME: ${selectedTheme.toUpperCase()}]`);
      if (data.narrative) {
        addLog("gm", data.narrative);
      }
      addLog("gm", `\nCURRENT CHAMBER: ${data.roomName}\n\n${data.roomDescription}`);
      
      const commandsHelp = `
💡 KEY COMMANDS YOU CAN USE:
• "LOOK" / "LOOK AROUND" - Inspect the room
• "EXAMINE [object name]" - Look closer at a puzzle or terminal
• "USE [item Name] ON [object name]" - Bypass a puzzle using your inventory
• "HELP" - Show interface commands list
• "INSPECT [area]" - Examine furniture or general features to find hidden items!

Try interacting with objects described in the text or typing "lookaround" to seek secrets.
`;
      addLog("system", commandsHelp);

    } catch (e: any) {
      setGameState("setup");
      alert("Boot failure: " + e.message);
    }
  };

  // Submit player command
  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = inputValue.trim();
    if (!cmd) return;

    // Add player command to terminal logs
    addLog("player", `> ${cmd}`);
    setInputValue("");

    // Detect client-side immediate commands
    const lowerCmd = cmd.toLowerCase();
    if (lowerCmd === "help" || lowerCmd === "info") {
      addLog("system", `
--- AVAILABLE TERMINAL SYNTAX ---
1. LOOK : Get a fresh summary of active blockages and room features.
2. EXAMINE [object] : Probe specific devices (e.g. "examine rusted locker").
3. USE [item] ON [object] : Try solving mechanisms (e.g. "use crowbar on vent").
4. TAKE [item] / GRAB [item] : Grab tools you discovered in search.
5. RESET : Abandons simulation to start screen.
      `);
      return;
    }

    if (lowerCmd === "reset" || lowerCmd === "restart") {
      setGameState("setup");
      addLog("system", "Simulation ended. Returned to core terminal.");
      return;
    }

    // Prepare message history formatted for AI
    const apiHistory = logs.map(l => ({
      role: l.sender === "player" ? "player" : "gm",
      text: l.text
    }));

    try {
      playChirp(400, 0.05, "sine");
      const response = await fetch("/api/escape-room/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          roomName,
          roomDescription,
          puzzles,
          inventory,
          history: apiHistory,
          playerCommand: cmd
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Turn processing error.");
      }

      const stateUpdate = await response.json();

      // Implement changes received from state update
      if (stateUpdate.roomName) setRoomName(stateUpdate.roomName);
      if (stateUpdate.roomDescription) setRoomDescription(stateUpdate.roomDescription);
      if (stateUpdate.puzzles) setPuzzles(stateUpdate.puzzles);
      if (stateUpdate.inventory) setInventory(stateUpdate.inventory);

      // Play special unlock SFX if any puzzle has been unlocked
      const previousSolvedCount = puzzles.filter(p => p.solved).length;
      const nextSolvedCount = (stateUpdate.puzzles || []).filter((p: Puzzle) => p.solved).length;
      if (nextSolvedCount > previousSolvedCount) {
        playChirp(523.25, 0.15, "triangle"); // C5
        setTimeout(() => playChirp(659.25, 0.2, "triangle"), 100); // E5
      }

      if (stateUpdate.narrative) {
        addLog("gm", stateUpdate.narrative);
      }

      // Check for Game Escape success
      if (stateUpdate.gameOver === true) {
        setGameState("escaped");
        addLog("system", "CRITICAL OVERRIDE: Escape path fully unlocked.");
        if (stateUpdate.escapedMessage) {
          addLog("gm", `🎉 SUCCESS! ${stateUpdate.escapedMessage}`);
        }
      }

    } catch (err: any) {
      console.error(err);
      addLog("error", `[COM LINK DISRUPTED] ${err.message || "Failed to receive reply. Verify parameters or query again."}`);
    }
  };

  // Convert timer seconds to formatted MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Quick helper command trigger button
  const triggerSuggestedCommand = (command: string) => {
    setInputValue(command);
  };

  return (
    <div className="min-h-screen crt-screen crt-scanlines text-emerald-400 font-sans flex flex-col selection:bg-emerald-950 selection:text-emerald-300">
      
      {/* GLOW TOP META HEADER */}
      <header className="border-b border-emerald-900/40 bg-black/60 px-6 py-3 flex flex-wrap justify-between items-center z-25 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <h1 className="text-xl tracking-wider font-retro glow-text-emerald flex items-center gap-2">
            <TerminalIcon className="w-5 h-5" id="applet-logo-icon" />
            OMNI-ESC PROTOCOL v2.4
          </h1>
        </div>
        
        {gameState === "playing" && (
          <div className="flex items-center gap-6 text-sm">
            <div className="bg-emerald-950/50 border border-emerald-500/30 px-3 py-1 rounded flex items-center gap-2">
              <span className="text-emerald-500 font-bold uppercase tracking-tight text-xs">Simulation:</span>
              <span className="text-white font-mono text-sm uppercase">{theme}</span>
            </div>
            
            <div className="bg-red-950/40 border border-red-500/30 text-rose-400 px-4 py-1 rounded flex items-center gap-2 font-mono">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>TIME:</span>
              <span className="font-bold text-lg tracking-widest">{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              playChirp(900, 0.05, "sine");
            }}
            id="sound-toggle-btn"
            className="p-1.5 rounded border border-emerald-900/50 hover:bg-emerald-950/40 text-emerald-500 transition-all cursor-pointer flex items-center gap-2 text-xs"
            title={isMuted ? "Unmute terminal sound effects" : "Mute terminal sound effects"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? "MUTED" : "CHIRP ON"}</span>
          </button>
          
          {gameState === "playing" && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to abort the current timeline escape room?")) {
                  setGameState("setup");
                  addLog("system", "Timeline purge initialized.");
                }
              }}
              id="abort-btn"
              className="px-2.5 py-1 text-xs text-rose-400 border border-rose-900/50 rounded bg-rose-950/20 hover:bg-rose-950/60 font-mono tracking-tighter"
            >
              ABORT SIM
            </button>
          )}
        </div>
      </header>

      {/* GAME SETUP SCREEN */}
      {gameState === "setup" && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col justify-center gap-8">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-block p-4 bg-emerald-950/25 border border-emerald-500/20 rounded-full mb-2 shadow-inner">
              <Sparkles className="w-12 h-12 text-emerald-400 glow-text-emerald" />
            </div>
            <h2 className="text-4xl md:text-5xl font-retro text-emerald-300 tracking-wider font-bold uppercase glow-text-emerald">
              Interactive Escape Reactor
            </h2>
            <p className="text-emerald-500/80 max-w-md mx-auto text-sm leading-relaxed">
              Step through the analog portal. Name any narrative setting or puzzle theme, 
              and the Gemini Game Master will synthesize a dangerous sequence of linked barriers you must escape.
            </p>
          </div>

          {/* PRESENTS SECTIONS */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-emerald-500 font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              SELECT CORE ESCAPE ENVIRONMENT PRESET
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    playChirp(880, 0.08, "triangle");
                    handleStartGame(preset.name);
                  }}
                  id={`preset-btn-${preset.id}`}
                  className={`p-4 bg-black/40 border rounded-lg text-left transition-all hover:bg-emerald-950/20 group cursor-pointer flex gap-4 items-start ${preset.accent}`}
                >
                  <span className="text-3xl p-1 bg-black/60 rounded border border-emerald-900/30 select-none group-hover:scale-110 transition-transform">
                    {preset.icon}
                  </span>
                  <div>
                    <h4 className="font-bold tracking-wide text-white group-hover:text-emerald-300 transition-colors">
                      {preset.name}
                    </h4>
                    <p className="text-xs text-slate-400/90 mt-1 line-clamp-2 leading-relaxed">
                      {preset.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center py-2 flex items-center justify-center gap-3">
            <span className="h-px bg-emerald-900/40 flex-1" />
            <span className="text-xs text-emerald-500/55 font-mono">OR GENERATE CUSTOM UNIVERSE</span>
            <span className="h-px bg-emerald-900/40 flex-1" />
          </div>

          {/* CUSTOM THEME INPUT */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customTheme.trim()) {
                handleStartGame(customTheme.trim());
              }
            }}
            className="bg-black/60 border border-emerald-500/20 p-5 rounded-lg space-y-3"
          >
            <label className="block text-xs uppercase tracking-wider text-emerald-400 font-mono">
              Custom Escape Theme / Narrative Scenario:
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500/60 font-mono text-sm select-none">
                  &gt;
                </span>
                <input
                  type="text"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="e.g. Submerged Nuclear Submarine, Toy Factory Attic, Cthulhu Crypt..."
                  id="custom-theme-input"
                  className="w-full bg-black border border-emerald-500/30 rounded px-4 py-2.5 pl-8 text-emerald-200 placeholder:text-emerald-900 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!customTheme.trim()}
                id="custom-boot-btn"
                className="px-6 py-2.5 rounded bg-emerald-500 text-black hover:bg-emerald-400 font-bold tracking-wider hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer font-retro text-lg"
              >
                <Play className="w-4 h-4 fill-black" />
                INIT ENGINE
              </button>
            </div>
          </form>

          {/* INSTRUCTIONS */}
          <section className="bg-emerald-950/10 border border-emerald-500/10 rounded-lg p-4 text-xs text-slate-400/95 leading-relaxed space-y-2">
            <h4 className="font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              TIMELINE PROTOCOL GUIDES
            </h4>
            <p>
              This systems model allows text sandbox operations using real natural language processing. 
              The Game Master coordinates your choices against logical lock dependencies. E.g. finding 
              a <span className="text-emerald-400 font-mono">"magnetic bypass key"</span> will enable you to solve the <span className="text-rose-400 font-mono">"digital terminal lock"</span> puzzle in the chamber. Write commands like <span className="font-mono text-cyan-300">"inspect drawer"</span> or <span className="font-mono text-cyan-300">"use battery on computer"</span> to alter state blocks dynamically.
            </p>
          </section>

        </main>
      )}

      {/* BOOTING LOADING STATE */}
      {gameState === "booting" && (
        <main className="flex-1 flex flex-col justify-center items-center gap-6 p-6">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-950 border-t-emerald-400 animate-spin" />
          <div className="font-mono flex flex-col items-center gap-2 max-w-md text-center">
            <span className="text-xs uppercase tracking-widest text-emerald-500 opacity-60">System Boot Sequences</span>
            <span className="text-lg font-bold tracking-wider text-emerald-300 animate-pulse">{loadingText}</span>
          </div>
        </main>
      )}

      {/* MAIN GAMING SPACE */}
      {(gameState === "playing" || gameState === "escaped" || gameState === "failed") && (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 w-full relative">
          
          {/* SIDEBAR - INVENTORY / PUZZLE MONITOR */}
          <div className="w-full lg:w-80 bg-black/70 border-b lg:border-b-0 lg:border-r border-emerald-900/40 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto retro-scroll">
            
            {/* CURRENT LOCATION info */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded">
              <span className="text-xs uppercase tracking-wider text-emerald-500/70 font-semibold block mb-1">CURRENT ROOM SITE:</span>
              <span className="text-emerald-300 font-bold font-retro text-xl block tracking-wide">{roomName || "Scanning..."}</span>
              <p className="text-xs text-emerald-500/80 mt-2 italic leading-relaxed border-t border-emerald-950 pt-2">
                &ldquo;{roomDescription || "Searching for spatial indicators..."}&rdquo;
              </p>
            </div>

            {/* PERSISTENT INVENTORY PANEL */}
            <section className="space-y-2 flex-1">
              <div className="flex justify-between items-center bg-emerald-950/10 px-2 py-1 rounded">
                <h4 className="text-xs uppercase tracking-widest font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-emerald-400" />
                  INVENTORY CARGO ({inventory.length})
                </h4>
                <span className="text-[10px] text-slate-500 uppercase">Interactive slots</span>
              </div>

              {inventory.length === 0 ? (
                <div className="border border-dashed border-emerald-900/30 rounded-lg p-5 text-center bg-black/20">
                  <span className="text-xs text-emerald-950 uppercase select-none block font-mono">Empty Inventory Slot</span>
                  <span className="text-[10px] text-emerald-700 mt-1 block">Search room components (e.g. examine furniture) to pick up clues!</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {inventory.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => triggerSuggestedCommand(`use ${item} on `)}
                      id={`inv-item-${index}`}
                      className="group cursor-pointer px-3 py-2 bg-emerald-950/35 border border-emerald-500/20 rounded flex items-center justify-between hover:bg-emerald-900/40 hover:border-emerald-400/40 transition-all text-xs"
                      title={`Click shortcut to auto-insert 'use ${item} on'`}
                    >
                      <div className="flex items-center gap-2 text-white">
                        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-mono">{item}</span>
                      </div>
                      <span className="text-[9px] text-emerald-500 bg-emerald-950 border border-emerald-500/20 px-1 py-0.5 rounded opacity-60 group-hover:opacity-100">
                        USE ITEM
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* DYNAMIC ACTIVE PUZZLES / DEPENDENCY TARGET MONITOR */}
            <section className="space-y-2 mt-2">
              <div className="bg-emerald-950/10 px-2 py-1 rounded flex justify-between items-center">
                <h4 className="text-xs uppercase tracking-widest font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  BLOCKAGES ENFORCED
                </h4>
                <span className="text-[9px] text-slate-500">Logical State</span>
              </div>

              {puzzles.length === 0 ? (
                <div className="p-3 border border-dashed border-emerald-950 text-center rounded text-xs text-emerald-700 italic">
                  No explicit room parameters cataloged.
                </div>
              ) : (
                <div className="space-y-2">
                  {puzzles.map((puz, index) => (
                    <div
                      key={index}
                      onClick={() => triggerSuggestedCommand(`examine ${puz.objectName}`)}
                      className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                        puz.solved
                          ? "bg-emerald-950/10 border-emerald-500/20 text-slate-400"
                          : "bg-black/40 border-rose-950/60 hover:border-rose-800/40"
                      }`}
                      title={`Click to inspect ${puz.objectName}`}
                    >
                      <div className="flex items-center justify-between font-mono mb-1">
                        <span className="text-white font-bold truncate max-w-[150px]">{puz.objectName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {puz.solved ? (
                            <span className="text-[9px] px-1 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 rounded flex items-center gap-0.5 uppercase">
                              <Unlock className="w-2.5 h-2.5" /> bypassed
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.5 bg-rose-950/50 text-rose-400 border border-rose-500/20 rounded flex items-center gap-0.5 uppercase">
                              <Lock className="w-2.5 h-2.5" /> LOCKED
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                        {puz.description}
                      </p>
                      
                      {/* Enforced constraint clue label */}
                      {!puz.solved && puz.requiredItem && (
                        <div className="mt-1.5 pt-1.5 border-t border-emerald-950/50 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-rose-400 font-semibold text-[8px] uppercase">PREREQUISITE FOR INVENTORY:</span>
                          <span className="px-1 py-0.2 bg-black text-amber-400 font-mono border border-emerald-950 rounded">
                            {puz.requiredItem}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* MAIN TERMINAL SCREEN CONTAINER */}
          <div className="flex-1 flex flex-col min-h-0 bg-black/90">
            
            {/* TERMINAL LOGS SCROLL BOX */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 retro-scroll font-mono text-sm">
              
              {/* VINTAGE CARRIER BADGE OVERLAY */}
              <div className="bg-emerald-950/10 border border-emerald-500/20 rounded p-3 mb-4 space-y-1 text-xs">
                <div className="text-emerald-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1">
                  <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  REACTIVE LOG STREAM FEED
                </div>
                <p className="text-slate-400">
                  Escape timeline activated. Type commands below to run actions. Utilize environment helpers or items at your discretion.
                </p>
              </div>

              {logs.map((log) => {
                let badgeColor = "bg-emerald-950 text-emerald-400 border-emerald-500/20";
                let senderLabel = "SYSTEM";
                let textStyle = "text-emerald-300";

                if (log.sender === "gm") {
                  badgeColor = "bg-slate-900 text-white border-emerald-500/20 font-bold";
                  senderLabel = "GAME MASTER";
                  textStyle = "text-emerald-300 font-medium whitespace-pre-wrap leading-relaxed";
                } else if (log.sender === "player") {
                  badgeColor = "bg-cyan-950 text-cyan-400 border-cyan-500/20";
                  senderLabel = "PLAYER";
                  textStyle = "text-cyan-200 font-bold tracking-wide";
                } else if (log.sender === "error") {
                  badgeColor = "bg-rose-950 text-rose-400 border-rose-500/20";
                  senderLabel = "COM ERROR";
                  textStyle = "text-rose-300 italic";
                }

                return (
                  <div key={log.id} className="space-y-1.5 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${badgeColor}`}>
                        {senderLabel}
                      </span>
                      <span className="text-[10px] text-emerald-700/80">{log.timestamp}</span>
                    </div>
                    <div className={`pl-2 border-l border-emerald-950/80 ${textStyle}`}>
                      {log.text}
                    </div>
                  </div>
                );
              })}

              {/* GAME WON OVERLAYS */}
              {gameState === "escaped" && (
                <div className="bg-emerald-950/20 border-2 border-emerald-400 p-6 rounded-lg text-center space-y-4 max-w-lg mx-auto animate-fadeIn shadow-2xl my-6">
                  <div className="text-emerald-400 text-5xl font-retro tracking-widest glow-text-emerald">
                     ESCAPED INDEED 
                  </div>
                  <p className="text-white text-sm">
                    Reactor solved and timelines cleared of chronological loops! The exit is clear. The simulation is completed.
                  </p>
                  <button
                    onClick={() => {
                      playChirp(880, 0.1, "sine");
                      setGameState("setup");
                    }}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase rounded cursor-pointer font-retro tracking-wider text-xl"
                  >
                    BEGIN NEW SIMULATION
                  </button>
                </div>
              )}

              {/* GAME LOST OVERLAYS */}
              {gameState === "failed" && (
                <div className="bg-red-950/30 border-2 border-red-500 p-6 rounded-lg text-center space-y-4 max-w-lg mx-auto animate-fadeIn shadow-2xl my-6">
                  <div className="text-rose-500 text-5xl font-retro tracking-widest uppercase">
                    ☠ SYSTEM TERMINATED
                  </div>
                  <p className="text-rose-300 text-sm">
                    Atmospheric support drained. The Chamber sealed permanently. Reset simulator feed to recover another clone timeline.
                  </p>
                  <button
                    onClick={() => {
                      playChirp(400, 0.15, "triangle");
                      setGameState("setup");
                    }}
                    className="px-6 py-2 bg-rose-500 hover:bg-rose-400 text-black font-bold uppercase rounded cursor-pointer font-retro tracking-wider text-xl"
                  >
                    RETRY SIMULATOR
                  </button>
                </div>
              )}

              <div ref={terminalEndRef} />
            </div>

            {/* COMMAND SUGGESTIONS QUICK-TAPS */}
            {gameState === "playing" && (
              <div className="px-4 py-2 border-t border-emerald-950/30 bg-black/60 flex flex-wrap items-center gap-2 text-xs shrink-0 select-none">
                <span className="text-emerald-600/90 font-semibold uppercase tracking-tight text-[10px]">Quick Commands:</span>
                <button
                  onClick={() => triggerSuggestedCommand("lookaround")}
                  className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-900/60 rounded text-slate-300 cursor-pointer text-[11px]"
                >
                  Look Around
                </button>
                <button
                  onClick={() => triggerSuggestedCommand("examine ")}
                  className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-900/60 rounded text-slate-300 cursor-pointer text-[11px]"
                >
                  Examine...
                </button>
                <button
                  onClick={() => triggerSuggestedCommand("help")}
                  className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-900/60 rounded text-slate-300 cursor-pointer text-[11px]"
                >
                  Help List
                </button>
                {inventory.length > 0 && (
                  <div className="relative inline-flex items-center gap-1 text-[10px] text-amber-500 ml-auto border-l border-emerald-950/80 pl-2">
                    <span className="italic">Use shortcut:</span>
                    <span className="text-emerald-400">Click item in sidebar!</span>
                  </div>
                )}
              </div>
            )}

            {/* BOTTOM INPUT BAR */}
            <div className="p-4 border-t border-emerald-900/40 bg-black shrink-0 relative">
              {gameState !== "playing" ? (
                <div className="text-center py-2.5 font-mono text-emerald-700 text-xs italic uppercase">
                  Terminal link state is offline. Initiate simulation above to interact.
                </div>
              ) : (
                <form onSubmit={handleSendCommand} className="flex gap-3">
                  <div className="relative flex-1 flex items-center">
                    <span className="absolute left-3 text-emerald-400 font-mono text-base font-bold animate-pulse">
                      &gt;
                    </span>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type action here (e.g. examine broken desk, lookaround, use key on cabinet)..."
                      id="terminal-command-input"
                      className="w-full bg-emerald-950/15 border border-emerald-500/40 rounded py-2.5 pl-8 pr-4 text-emerald-200 placeholder:text-emerald-900/80 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-mono text-sm"
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="submit"
                    id="submit-command-btn"
                    className="px-6 bg-emerald-950 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black font-semibold font-mono text-xs tracking-wider uppercase transition-all rounded shadow-md cursor-pointer shrink-0"
                  >
                    SEND CMD
                  </button>
                </form>
              )}
            </div>

          </div>

        </main>
      )}

      {/* FOOTER BAR */}
      <footer className="border-t border-emerald-900/40 bg-black/60 px-6 py-2 flex justify-between items-center text-[10px] text-slate-500 select-none font-mono shrink-0">
        <div>SYSTEM: ONLINE | REACTOR_CORE: ENGAGED</div>
        <div>POWERED BY GOOGLE RECURSION LABS &times; GEMINI AI</div>
      </footer>
    </div>
  );
}
