// Chatbot functionality for Level Up PC
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatbotConfig {
  apiEndpoint: string;
  maxMessages: number;
  typingDelay: number;
  suggestions: string[];
}

class Chatbot {
  private config: ChatbotConfig;
  private messages: ChatMessage[] = [];
  private isTyping = false;
  private chatbotWindow: HTMLElement | null = null;
  private chatMessages: HTMLElement | null = null;
  private chatInput: HTMLInputElement | null = null;
  private chatbotToggle: HTMLElement | null = null;
  private chatbotClose: HTMLElement | null = null;

  constructor(config: ChatbotConfig) {
    this.config = config;
    this.initializeElements();
    this.bindEvents();
    this.loadWelcomeMessage();
  }

  private initializeElements(): void {
    this.chatbotWindow = document.getElementById('chatbotWindow');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput') as HTMLInputElement;
    this.chatbotToggle = document.getElementById('chatbotToggle');
    this.chatbotClose = document.getElementById('chatbotClose');

    if (!this.chatbotWindow || !this.chatMessages || !this.chatInput || !this.chatbotToggle || !this.chatbotClose) {
      console.error('Chatbot elements not found');
      return;
    }
  }

  private bindEvents(): void {
    this.chatbotToggle?.addEventListener('click', () => this.toggleChat());
    this.chatbotClose?.addEventListener('click', () => this.closeChat());
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Add event listener for send button
    const sendButton = document.querySelector('.chatbot-input button');
    sendButton?.addEventListener('click', () => this.sendMessage());

    // Add event listeners for suggestion buttons
    this.bindSuggestionEvents();
  }

  private bindSuggestionEvents(): void {
    const suggestions = document.querySelectorAll('.suggestion-btn');
    suggestions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const message = (e.target as HTMLElement).textContent;
        if (message) {
          this.chatInput!.value = message;
          this.sendMessage();
        }
      });
    });
  }

  private toggleChat(): void {
    if (!this.chatbotWindow) return;
    
    const isVisible = this.chatbotWindow.style.display === 'block';
    
    if (isVisible) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  private openChat(): void {
    if (!this.chatbotWindow) return;
    
    this.chatbotWindow.style.display = 'block';
    this.chatbotWindow.classList.add('active');
    this.hideBadge();
    
    // Focus input when opening
    setTimeout(() => {
      this.chatInput?.focus();
    }, 100);
  }

  private closeChat(): void {
    if (!this.chatbotWindow) return;
    
    this.chatbotWindow.style.display = 'none';
    this.chatbotWindow.classList.remove('active');
  }

  private hideBadge(): void {
    const badge = document.getElementById('chatBadge');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  private async sendMessage(): Promise<void> {
    if (!this.chatInput || !this.chatMessages) return;
    
    const messageText = this.chatInput.value.trim();
    if (!messageText) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    this.addMessage(userMessage);
    this.chatInput.value = '';

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send message to backend
      const botResponse = await this.getBotResponse(messageText);
      
      // Remove typing indicator and add bot response
      this.hideTypingIndicator();
      
      const botMessage: ChatMessage = {
        id: this.generateId(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };

      this.addMessage(botMessage);
      this.updateSuggestions(messageText);
      
    } catch (error) {
      this.hideTypingIndicator();
      this.handleError();
    }
  }

  private async getBotResponse(message: string): Promise<string> {
    try {
      // Simular respuesta inteligente basada en la pregunta
      return this.generateIntelligentResponse(message);
    } catch (error) {
      console.error('Error getting bot response:', error);
      // Return a helpful fallback message
      return this.getFallbackResponse(message);
    }
  }

  private generateIntelligentResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Detectar el tipo de pregunta y generar una respuesta relevante
    if (lowerMessage.includes('procesador') || lowerMessage.includes('cpu')) {
      return 'En Level Up PC tenemos una excelente selección de procesadores Intel y AMD. Para gaming, te recomendaría los Intel Core i5/i7 o AMD Ryzen 5/7. Para trabajo profesional, los Intel Core i9 o AMD Ryzen 9 son ideales. ¿Cuál es tu presupuesto y qué uso le darás?';
    }
    
    if (lowerMessage.includes('gráfica') || lowerMessage.includes('gpu') || lowerMessage.includes('tarjeta gráfica')) {
      return 'Contamos con las últimas tarjetas gráficas NVIDIA RTX y AMD Radeon. Para gaming en 1080p, una RTX 4060 o RX 7600 es excelente. Para 1440p, te recomendaría una RTX 4070 o RX 7800 XT. ¿Qué resolución y tipo de juegos te interesan?';
    }
    
    if (lowerMessage.includes('precio') || lowerMessage.includes('precios') || lowerMessage.includes('cuánto cuesta')) {
      return 'Nuestros precios son muy competitivos y varían según la marca y especificaciones. Visita nuestra sección de productos para ver precios actualizados. También ofrecemos promociones y descuentos frecuentemente. ¿Hay algo específico que te interese?';
    }
    
    if (lowerMessage.includes('ram') || lowerMessage.includes('memoria')) {
      return 'Tenemos memorias RAM DDR4 y DDR5 de las mejores marcas como Corsair, Kingston y G.Skill. Para gaming, 16GB es el mínimo recomendado, pero 32GB es ideal. Para trabajo profesional, considera 32GB o más. ¿Qué capacidad necesitas?';
    }
    
    if (lowerMessage.includes('almacenamiento') || lowerMessage.includes('disco') || lowerMessage.includes('ssd')) {
      return 'Ofrecemos SSD NVMe M.2 de alta velocidad y discos duros tradicionales. Para el sistema operativo, un SSD NVMe de 500GB-1TB es ideal. Para almacenamiento adicional, puedes combinar con un HDD de 2TB-4TB. ¿Cuánto espacio necesitas?';
    }
    
    if (lowerMessage.includes('fuente') || lowerMessage.includes('power supply')) {
      return 'Las fuentes de poder son cruciales para la estabilidad de tu PC. Tenemos fuentes certificadas 80+ Bronze, Gold y Platinum de marcas como Corsair, EVGA y Seasonic. El wattage depende de tus componentes. ¿Qué componentes planeas usar?';
    }
    
    if (lowerMessage.includes('gabinete') || lowerMessage.includes('case')) {
      return 'Tenemos gabinetes para todos los gustos y presupuestos: desde opciones económicas hasta cases gaming premium con RGB. Considera el tamaño (ATX, micro-ATX), flujo de aire y estética. ¿Tienes preferencia de tamaño o estilo?';
    }
    
    if (lowerMessage.includes('marca') || lowerMessage.includes('marcas')) {
      return 'Trabajamos con las mejores marcas del mercado: Intel, AMD, NVIDIA, ASUS, MSI, Gigabyte, Corsair, Logitech, Razer, HyperX, y muchas más. Cada marca tiene sus fortalezas. ¿Qué tipo de componente te interesa?';
    }
    
    if (lowerMessage.includes('garantía') || lowerMessage.includes('garantia')) {
      return 'Todos nuestros productos vienen con garantía del fabricante (usualmente 1-3 años). Además, ofrecemos garantía extendida en muchos productos. Los procesadores y placas madre suelen tener 3 años, mientras que tarjetas gráficas y RAM tienen garantías más variables. ¿Sobre qué producto quieres saber?';
    }
    
    if (lowerMessage.includes('envío') || lowerMessage.includes('envio') || lowerMessage.includes('entrega')) {
      return 'Ofrecemos envío express a todo el país. Los pedidos usualmente se entregan en 1-3 días hábiles dependiendo de tu ubicación. También tenemos opción de recoger en tienda si estás cerca. ¿En qué ciudad estás ubicado?';
    }
    
    if (lowerMessage.includes('compatibilidad') || lowerMessage.includes('compatible')) {
      return 'La compatibilidad es muy importante al armar una PC. Los factores principales son: socket del procesador con la placa madre, tipo de RAM (DDR4/DDR5), tamaño de la tarjeta gráfica con el gabinete, y potencia de la fuente. ¿Qué componentes estás considerando?';
    }
    
    if (lowerMessage.includes('recomienda') || lowerMessage.includes('recomendación') || lowerMessage.includes('recomendacion')) {
      return 'Para darte la mejor recomendación, necesito saber: ¿cuál es tu presupuesto?, ¿para qué usarás la PC? (gaming, trabajo, edición de video, etc.), ¿y prefieres rendimiento máximo o mejor valor? Con esta información puedo sugerirte la combinación ideal.';
    }
    
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenas') || lowerMessage.includes('hey')) {
      return '¡Hola! Bienvenido a Level Up PC 👋 Soy tu asistente virtual y estoy aquí para ayudarte a encontrar los mejores componentes para tu PC. Puedo asistirte con información sobre productos, precios, recomendaciones, compatibilidad y mucho más. ¿En qué puedo ayudarte hoy?';
    }
    
    if (lowerMessage.includes('adiós') || lowerMessage.includes('gracias') || lowerMessage.includes('bye')) {
      return '¡Gracias por visitar Level Up PC! Si tienes más preguntas sobre componentes de PC, precios o necesitas ayuda para armar tu computadora ideal, no dudes en volver. ¡Que tengas un excelente día! 🖥️';
    }
    
    // Respuesta genérica pero útil para preguntas no específicas
    return 'Gracias por tu pregunta. En Level Up PC somos especialistas en componentes de PC. Puedo ayudarte con información sobre procesadores, tarjetas gráficas, memoria RAM, almacenamiento, fuentes de poder, gabinetes y más. También puedo asesorarte sobre compatibilidad, precios y recomendaciones según tu presupuesto. ¿Sobre qué tema necesitas información?';
  }

  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Check for common questions and provide helpful responses
    if (lowerMessage.includes('precio') || lowerMessage.includes('precios')) {
      return 'Para ver nuestros precios actualizados, puedes hacer clic en "Lista de Precios" en el menú principal o visitar directamente nuestras categorías de productos. ¿Hay algo específico que te interese?';
    }
    
    if (lowerMessage.includes('procesador') || lowerMessage.includes('cpu')) {
      return 'Tenemos una excelente selección de procesadores Intel y AMD. Puedes visitar nuestra página de procesadores haciendo clic en "Categorías" > "Procesadores". ¿Buscas algo para gaming o trabajo profesional?';
    }
    
    if (lowerMessage.includes('gráfica') || lowerMessage.includes('gpu')) {
      return 'Contamos con las últimas tarjetas gráficas NVIDIA RTX y AMD Radeon. Visita nuestra sección de tarjetas gráficas para ver todos los modelos disponibles. ¿Qué tipo de rendimiento estás buscando?';
    }
    
    if (lowerMessage.includes('garantía') || lowerMessage.includes('garantia')) {
      return 'Todos nuestros productos vienen con garantía del fabricante. Además, ofrecemos garantía extendida en muchos productos. ¿Te gustaría saber más sobre la garantía de un producto específico?';
    }
    
    if (lowerMessage.includes('envío') || lowerMessage.includes('envio')) {
      return 'Ofrecemos envío express a todo el país. Los pedidos usualmente se entregan en 1-3 días hábiles. ¿En qué ciudad estás ubicado?';
    }
    
    if (lowerMessage.includes('marca') || lowerMessage.includes('marcas')) {
      return 'Trabajamos con las mejores marcas del mercado: Intel, AMD, NVIDIA, ASUS, MSI, Corsair, Logitech y Razer. ¿Hay alguna marca en particular que te interese?';
    }
    
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenas')) {
      return '¡Hola! Bienvenido a Level Up PC. Soy tu asistente virtual y estoy aquí para ayudarte a encontrar los mejores componentes para tu PC. ¿En qué puedo asistirte hoy?';
    }
    
    if (lowerMessage.includes('adiós') || lowerMessage.includes('gracias')) {
      return '¡Gracias por visitar Level Up PC! Si tienes más preguntas, no dudes en volver. ¡Que tengas un excelente día!';
    }

    // Default helpful response
    return '¡Hola! Soy el asistente virtual de Level Up PC. Puedo ayudarte con:\n\n' +
           '- Información sobre productos y precios\n' +
           '- Recomendaciones de componentes\n' +
           '- Detalles de garantía y envío\n' +
           '- Información sobre marcas disponibles\n\n' +
           'En qué puedo asistirte hoy?';
}

  private addMessage(message: ChatMessage): void {
    if (!this.chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender}`;
    messageElement.innerHTML = `
      <div class="message-content">${this.escapeHtml(message.text)}</div>
      <div class="message-time">${this.formatTime(message.timestamp)}</div>
    `;

    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();

    // Limit messages to prevent memory issues
    if (this.messages.length >= this.config.maxMessages) {
      this.messages.shift();
      // Remove first message element
      const firstMessage = this.chatMessages.firstChild;
      if (firstMessage) {
        this.chatMessages.removeChild(firstMessage);
      }
    }

    this.messages.push(message);
  }

  private showTypingIndicator(): void {
    if (!this.chatMessages) return;

    const typingElement = document.createElement('div');
    typingElement.className = 'message bot typing';
    typingElement.id = 'typingIndicator';
    typingElement.innerHTML = `
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    this.chatMessages.appendChild(typingElement);
    this.scrollToBottom();
    this.isTyping = true;
  }

  private hideTypingIndicator(): void {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
    this.isTyping = false;
  }

  private scrollToBottom(): void {
    if (!this.chatMessages) return;
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private updateSuggestions(message: string): void {
    const suggestionsContainer = document.getElementById('chatSuggestions');
    if (!suggestionsContainer) return;

    const lowerMessage = message.toLowerCase();
    let suggestions: string[] = [];

    // Provide contextual suggestions based on the conversation
    if (lowerMessage.includes('procesador') || lowerMessage.includes('cpu')) {
      suggestions = ['¿Intel o AMD?', '¿Qué diferencia hay entre i5 y i7?', '¿Cuál es mejor para gaming?'];
    } else if (lowerMessage.includes('gráfica') || lowerMessage.includes('gpu')) {
      suggestions = ['¿RTX o RX?', '¿Cuánto VRAM necesito?', '¿Para qué resolución?'];
    } else if (lowerMessage.includes('precio') || lowerMessage.includes('precios')) {
      suggestions = ['¿Tienen promociones?', '¿Cuál es el mejor valor?', '¿Hay descuentos?'];
    } else if (lowerMessage.includes('ram') || lowerMessage.includes('memoria')) {
      suggestions = ['¿DDR4 o DDR5?', '¿16GB o 32GB?', '¿Qué marca es mejor?'];
    } else if (lowerMessage.includes('almacenamiento') || lowerMessage.includes('ssd')) {
      suggestions = ['¿SSD o HDD?', '¿Qué capacidad?', '¿NVMe vale la pena?'];
    } else if (lowerMessage.includes('gabinete')) {
      suggestions = ['¿ATX o micro-ATX?', '¿Con ventana?', '¿Buen flujo de aire'];
    } else {
      // Default suggestions - más variadas
      suggestions = [
        '¿Qué procesador me recomiendas?',
        '¿Cuánta RAM necesito?',
        '¿SSD o disco duro?',
        '¿Qué fuente de poder comprar?'
      ];
    }

    suggestionsContainer.innerHTML = suggestions.map(suggestion => 
      `<button class="suggestion-btn">${suggestion}</button>`
    ).join('');

    // Re-bind events for new suggestion buttons
    this.bindSuggestionEvents();
  }

  private handleError(): void {
    const errorMessage: ChatMessage = {
      id: this.generateId(),
      text: 'Lo siento, estoy teniendo problemas para conectarme con el servidor. Por favor, intenta de nuevo en un momento o contacta a nuestro equipo de soporte.',
      sender: 'bot',
      timestamp: new Date()
    };
    this.addMessage(errorMessage);
  }

  private loadWelcomeMessage(): void {
    // Show welcome message after a short delay
    setTimeout(() => {
      if (this.messages.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: this.generateId(),
          text: '¡Hola! Bienvenido a Level Up PC 👋\n\n' +
                'Soy tu asistente virtual y estoy aquí para ayudarte a encontrar los mejores componentes para tu PC. ' +
                'Puedo asistirte con:\n\n' +
                '- Información sobre productos y precios\n' +
                '- Recomendaciones personalizadas\n' +
                '- Detalles de garantía y envío\n' +
                '- Información sobre marcas y disponibilidad\n\n' +
                'En qué puedo ayudarte hoy?',
          sender: 'bot',
          timestamp: new Date()
        };
        this.addMessage(welcomeMessage);
        this.updateSuggestions('');
      }
    }, 1000);
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const chatbotConfig: ChatbotConfig = {
    apiEndpoint: 'http://localhost:3000/api/chat',
    maxMessages: 50,
    typingDelay: 1000,
    suggestions: [
      '¿Cuáles son sus mejores procesadores?',
      '¿Qué tarjeta gráfica me recomiendan?',
      '¿Cuáles son sus precios?',
      '¿Qué marcas manejan?'
    ]
  };

  new Chatbot(chatbotConfig);
});