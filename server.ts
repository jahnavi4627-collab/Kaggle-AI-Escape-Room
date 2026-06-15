import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of GoogleGenAI
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in AI Studio Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// ----------------------------------------------------
// JSON Schemas for Gemini Responses
// ----------------------------------------------------

const startSchema = {
  type: Type.OBJECT,
  properties: {
    roomName: { 
      type: Type.STRING,
      description: "Atmospheric, thematic name for this starting chamber/cell (e.g. 'Cryo-Chamber-04', 'Damp Cellar', 'Eerie Foyer')."
    },
    narrative: {
      type: Type.STRING,
      description: "Suspenseful, highly atmospheric terminal-style introductory message describing waking up or establishing the scene."
    },
    roomDescription: {
      type: Type.STRING,
      description: "An overview describing noticeable key elements, objects of interest, furniture, or locked escape routes."
    },
    puzzles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objectName: { type: Type.STRING, description: "Name of the interactive object or barrier, e.g. 'heavy airlock door', 'digital wall terminal', 'bolted chest'." },
          description: { type: Type.STRING, description: "Detailed sensory look or visual clues about this puzzle object." },
          status: { type: Type.STRING, description: "e.g. 'locked', 'depressurized', 'shut', 'offline', 'jammed'" },
          requiredItem: { type: Type.STRING, description: "The exact name of the item/tool required to unlock or bypass it, e.g. 'magnetic bypass card', 'crowbar', 'fuse cartridge'. Set to empty string if it's purely a clue object or solved differently." },
          solved: { type: Type.BOOLEAN, description: "Set to false initially." }
        },
        required: ["objectName", "description", "status", "requiredItem", "solved"]
      }
    },
    inventory: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Any starting items the player has. Usually empty initially, or may contain one survival item like 'copper wire' or 'flickering lighter' based on theme."
    }
  },
  required: ["roomName", "narrative", "roomDescription", "puzzles", "inventory"]
};

const actionSchema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "Vivid narrator update describing the outcome of the player's last action in terminal-style phrasing. Give deep thematic details."
    },
    roomName: { type: Type.STRING, description: "Name of the room (supports moving to a secret compartment/chamber if unlocked)." },
    roomDescription: { type: Type.STRING, description: "Up-to-date description of the room's current state based on solved puzzles." },
    puzzles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objectName: { type: Type.STRING },
          description: { type: Type.STRING },
          status: { type: Type.STRING },
          requiredItem: { type: Type.STRING },
          solved: { type: Type.BOOLEAN }
        },
        required: ["objectName", "description", "status", "requiredItem", "solved"]
      },
      description: "Dynamic array representing current or discovered puzzle items with updated solve statuses."
    },
    inventory: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Strictly calculated inventory. Add items discovered or remove consumable single-use keys."
    },
    gameOver: {
      type: Type.BOOLEAN,
      description: "Set to true ONLY if the player successfully bypassed the final lock or barrier to escape the room."
    },
    escapedMessage: {
      type: Type.STRING,
      description: "Triumphant, narrative wrap-up message celebrating their escape. Keep blank if gameOver is false."
    }
  },
  required: ["narrative", "roomName", "roomDescription", "puzzles", "inventory", "gameOver", "escapedMessage"]
};

// ----------------------------------------------------
// API Route Handlers
// ----------------------------------------------------

// API Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// START A NEW ROOM GAME
app.post("/api/escape-room/start", async (req, res) => {
  try {
    const { theme } = req.body;
    if (!theme) {
      return res.status(400).json({ error: "Escape room theme is required." });
    }

    const ai = getAI();
    const prompt = `
You are the Game Master for a text-based, retro terminal Escape Room Simulator. 
The player has selected the following escape room theme: "${theme}".

Generate a rich, cohesive escape room starting state.
Design a critical path of 3 to 4 sequential steps to escape. E.g.:
- Key/Tool discovery: "rusted keys" or "magnetic card" can be found under/inside simple props not listed as direct puzzles (e.g. inside a desk or under a pillow).
- Interactive barrier puzzles: For instance, a glowing computer terminal (offline), a heavy metal vault (needs 'magnetic card'), and a loose vent grate (needs 'screwdriver').
- Progression chain: Searching desk reveals 'rusty key' -> Unlocking rusty chest reveals 'battery pack' -> Installing battery in computer allows hacking electronic lock.

Make the narrative extremely atmospheric, scary, mysterious, or high-tech based on the theme.
Respond with JSON matching the start layout schema. Do not output anything except the JSON structure.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: startSchema,
        temperature: 1.0,
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini.");
    }

    const gameData = JSON.parse(response.text);
    return res.json(gameData);

  } catch (error: any) {
    console.error("Error starting game:", error);
    return res.status(500).json({ error: error.message || "Failed to initialize game room." });
  }
});

// SUBMIT PLAYER COMMAND / INTERACTION
app.post("/api/escape-room/action", async (req, res) => {
  try {
    const { theme, roomName, roomDescription, puzzles, inventory, history, playerCommand } = req.body;

    if (!playerCommand) {
      return res.status(400).json({ error: "No player command received." });
    }

    const ai = getAI();
    const parsedCommand = playerCommand.trim().toLowerCase();

    const prompt = `
You are the Game Master for a text-based Escape Room Simulator.
Theme: "${theme}"

The active room details:
- Room Name: ${roomName}
- Room Description: ${roomDescription}
- Player Inventory: [${(inventory || []).map((i: string) => `"${i}"`).join(", ")}]

Interactive Puzzles & Barriers with their required item solutions:
${(puzzles || []).map((p: any) => `- "${p.objectName}": status is "${p.status}". Solved: ${p.solved}. Required Item check: "${p.requiredItem || 'None'}"`).join("\n")}

Player's Last Few Exchanges (Context):
${(history || []).slice(-6).map((h: any) => `${h.role === "player" ? "Player" : "GM"}: ${h.text}`).join("\n")}

The player inputs the command: "${playerCommand}"

Evaluate their action according to these strict rules:
1. Examine Room/Objects: If they inspect the room or search safe areas (e.g. "examine bookshelf", "look under bed"), describe what they find. Under logical furniture or floorboards, they might find clues, tools, or keys. Introduce any item found in the narrative and add it to the "inventory" list.
2. ENFORCE PUZZLE LOGIC EXACTLY:
   - If they try to unlock, bypass, open, or solve any active puzzle/barrier (e.g. "unlock vault", "use key on locker", "open heavy locker"):
     Check the player's inventory list for the 'requiredItem' listed above for that specific object.
     - IF they DO NOT possess the 'requiredItem' in their player inventory, they CANNOT solve it. Describe a fail screen or terminal rejection message (e.g., "The scanner chirps with a high-pitched buzz: Access Denied. Keycard required."), and do NOT set solved to true.
     - IF they DO possess the 'requiredItem', they can successfully solved/unlock it. Describe the mechanism working (e.g. 'The gears grind open'). Set 'solved' to true and update the object status (e.g. 'unlocked' or 'solved').
     - Consuming items: If they use a key or power cartridge which is logical to get destroyed/consumed during use, you may optionally remove it from their 'inventory'. Reusable items (like screwdrivers or flashlight) should remain.
3. Be helpful but challenging. If they ask a meta-command or do something irrelevant, answer in-character as the cold or tense Game Master (e.g. "Nothing of interest there. The clock is ticking.").
4. ESCAPE DETERMINATION: If the room's final core barrier (usually the exit/door/gateway) is solved, set "gameOver" to true and write a detailed, victorious "escapedMessage".

Respond strictly with valid JSON based on the action resolution schema. Do not output anything except the JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: actionSchema,
        temperature: 0.8,
      }
    });

    if (!response.text) {
      throw new Error("No response from Game Master.");
    }

    const stateUpdate = JSON.parse(response.text);
    return res.json(stateUpdate);

  } catch (error: any) {
    console.error("Error resolving action:", error);
    return res.status(500).json({ error: error.message || "Failed to process turn." });
  }
});

// ----------------------------------------------------
// UI Server Bundlers Setup & Vite Integration
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mounting Vite Dev Server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server mounted.");
  } else {
    // Serving built files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express-Vite Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
