// Chat elements (defined and initialized in init to work across all pages)
let chatToggle = null;
let chatWindow = null;
let chatClose = null;
let chatMessages = null;
let chatInput = null;
let chatSend = null;

// Resolve API endpoint:
// - Prefer env base URL injected by Vite: import.meta.env.VITE_API_BASE_URL
// - Then global override (window.CHAT_API_URL)
// - Then same-origin `/api/chat`
// - Finally localhost fallback
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
    : null;

const SAME_ORIGIN = (typeof window !== "undefined" && window.location && window.location.origin)
  ? window.location.origin.replace(/\/$/, "")
  : "";
const API_URL = (
  (ENV_BASE ? `${ENV_BASE}/api/chat` : null)
  || window.CHAT_API_URL
  || (SAME_ORIGIN ? `${SAME_ORIGIN}/api/chat` : null)
  || "http://localhost:3001/api/chat"
);

function bindOpenClose() {
  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      if (chatWindow) {
        chatWindow.classList.add("open");
        chatWindow.classList.add("active"); // support both CSS variants
      }
    });
  }

  if (chatClose) {
    chatClose.addEventListener("click", () => {
      if (chatWindow) {
        chatWindow.classList.remove("open");
        chatWindow.classList.remove("active");
      }
    });
  }
}

// Add message to chat box
function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("chat-msg", sender);
  msg.textContent = text;
  if (chatMessages) {
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Local fallback responses (mirrors server's getFallbackResponse)
function getFallbackResponse(message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("precio")) return "Puedes ver los precios actualizados en la sección 'Lista de Precios'.";
  if (msg.includes("procesador") || msg.includes("cpu")) return "Tenemos procesadores Intel y AMD de última generación. ¿Para gaming o trabajo?";
  if (msg.includes("gpu") || msg.includes("gráfica") || msg.includes("grafica")) return "Contamos con tarjetas NVIDIA y AMD. ¿Qué presupuesto manejas?";
  return "Hola 👋 Soy el asistente de Level Up PC. ¿Qué componente estás buscando hoy?";
}

// Send message to IA
async function sendMessage() {
  if (!chatInput) return;
  const message = chatInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  chatInput.value = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    // If server responds with error status, fallback gracefully
    if (!res.ok) {
      const safeFallback = getFallbackResponse(message);
      addMessage(safeFallback, "bot");
      console.warn("Chatbot: respuesta no OK desde servidor", res.status);
      return;
    }

    const data = await res.json();
    addMessage(
      data.reply || data.message || data.response || getFallbackResponse(message),
      "bot"
    );


  } catch (error) {
    console.error("Chatbot: error de conexión", error);
    // Show helpful fallback instead of raw error
    addMessage(getFallbackResponse(message), "bot");
  }
}

function bindMessaging() {
  if (chatSend) {
    chatSend.addEventListener("click", sendMessage);
  }
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }
}

function initChatbot() {
  // Query elements after DOM is ready to avoid timing issues
  chatToggle = document.getElementById("chatbotToggle");
  chatWindow = document.getElementById("chatbotWindow");
  chatClose = document.getElementById("chatbotClose");
  chatMessages = document.getElementById("chatMessages");
  chatInput = document.getElementById("chatInput");
  chatSend = document.getElementById("chatSend") || document.getElementById("sendChat");

  bindOpenClose();
  bindMessaging();
}

// Initialize immediately if DOM already parsed, else on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatbot);
} else {
  initChatbot();
}

