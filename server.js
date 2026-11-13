import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";


dotenv.config();

import { pool, HttpError } from "./server/db.js";
import productsRouter from "./server/routes/products.js";
import combosRouter from "./server/routes/combos.js";
import checkoutRouter from "./server/routes/checkout.js";
import pedidosRouter from "./server/routes/pedidos.js";
import helmet from "helmet";
import authRouter from "./server/routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "dist")));
app.use(helmet({ contentSecurityPolicy: false }));   // cabeceras seguras (sin CSP para no romper Vite)
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));

// ==========================
// API (MySQL)
// ==========================
app.use("/api", productsRouter);
app.use("/api", combosRouter);
app.use("/api", checkoutRouter);
app.use("/api", pedidosRouter);
app.use("/api", authRouter);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

// ==========================
// CHAT OPENAI
// ==========================
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function getFallbackResponse(message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("precio")) return "Puedes ver los precios actualizados en la sección 'Lista de Precios'.";
  if (msg.includes("procesador")) return "Tenemos procesadores Intel y AMD de última generación. ¿Para gaming o trabajo?";
  if (msg.includes("gpu") || msg.includes("gráfica")) return "Contamos con tarjetas NVIDIA y AMD. ¿Qué presupuesto manejas?";
  return "Hola 👋 Soy el asistente de Level Up PC. ¿Qué componente estás buscando hoy?";
}

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").slice(0, 500);
  if (!message) return res.status(400).json({ error: "Falta el campo 'message'." });
  if (!client) return res.json({ reply: getFallbackResponse(message) });

  try {
    const response = await client.chat.completions.create({
      model: process.env.CHATBOT_MODEL || "gpt-4o-mini",
      max_tokens: Number(process.env.CHATBOT_MAX_TOKENS || 300),
      temperature: Number(process.env.CHATBOT_TEMPERATURE || 0.7),
      messages: [
        { role: "system", content: "Eres el asistente virtual de Level Up PC, tienda de hardware gamer. Responde en español, breve y útil." },
        { role: "user", content: message },
      ],
    });
    return res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("❌ Error con la API de OpenAI:", error.message);
    return res.json({ reply: getFallbackResponse(message) });
  }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

// ==========================
// Manejo central de errores
// ==========================
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error("❌ Error no controlado:", err.code || "", err.message);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, async () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("🗄️  MySQL conectado");
  } catch (e) {
    console.error("⚠️  No se pudo conectar a MySQL:", e.message, "\n   Revisa DB_* en .env y ejecuta npm run db:setup && npm run db:seed");
  }
});
