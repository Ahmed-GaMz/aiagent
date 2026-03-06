// ===== Groq AI Chat – app.js =====

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL_INFO = {
  'llama-3.3-70b-versatile':  { name: 'Llama 3.3 70B',  speed: '~250 tok/s' },
  'llama-3.1-8b-instant':     { name: 'Llama 3.1 8B',   speed: '~750 tok/s' },
  'mixtral-8x7b-32768':       { name: 'Mixtral 8x7B',   speed: '~480 tok/s' },
  'gemma2-9b-it':             { name: 'Gemma 2 9B',     speed: '~500 tok/s' },
};

// ===== State =====
let apiKey = localStorage.getItem('groq_api_key') || '';
let conversations = JSON.parse(localStorage.getItem('groq_conversations') || '[]');
let activeConversationId = null;
let isStreaming = false;

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const apiKeyModal    = $('#apiKeyModal');
const apiKeyInput    = $('#apiKeyInput');
const saveApiKeyBtn  = $('#saveApiKeyBtn');
const changeApiKeyBtn= $('#changeApiKeyBtn');
const chatMessages   = $('#chatMessages');
const welcomeScreen  = $('#welcomeScreen');
const chatInput      = $('#chatInput');
const sendBtn        = $('#sendBtn');
const modelSelect    = $('#modelSelect');
const topbarModel    = $('#topbarModel');
const topbarSpeed    = $('#topbarSpeed');
const newChatBtn     = $('#newChatBtn');
const clearBtn       = $('#clearBtn');
const exportBtn      = $('#exportBtn');
const errorToast     = $('#errorToast');
const conversationList = $('#conversationList');
const menuBtn        = $('#menuBtn');
const sidebar        = $('#sidebar');
const systemPrompt   = $('#systemPrompt');
const systemPromptToggle  = $('#systemPromptToggle');
const systemPromptContent = $('#systemPromptContent');

// ===== Init =====
function init() {
  if (!apiKey) {
    apiKeyModal.classList.remove('hidden');
  } else {
    apiKeyModal.classList.add('hidden');
  }

  // Load saved settings
  const savedModel = localStorage.getItem('groq_model');
  if (savedModel && MODEL_INFO[savedModel]) {
    modelSelect.value = savedModel;
  }
  const savedPrompt = localStorage.getItem('groq_system_prompt');
  if (savedPrompt) systemPrompt.value = savedPrompt;

  updateModelDisplay();
  renderConversations();

  // Start a fresh conversation if none exist
  if (conversations.length === 0) {
    createNewConversation();
  } else {
    setActiveConversation(conversations[0].id);
  }
}

// ===== API Key =====
saveApiKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('groq_api_key', key);
  apiKeyModal.classList.add('hidden');
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveApiKeyBtn.click();
});

changeApiKeyBtn.addEventListener('click', () => {
  apiKeyInput.value = apiKey;
  apiKeyModal.classList.remove('hidden');
  apiKeyInput.focus();
});

// ===== Model =====
modelSelect.addEventListener('change', () => {
  localStorage.setItem('groq_model', modelSelect.value);
  updateModelDisplay();
});

function updateModelDisplay() {
  const info = MODEL_INFO[modelSelect.value];
  topbarModel.textContent = info.name;
  topbarSpeed.textContent = info.speed;
}

// ===== System Prompt =====
systemPromptToggle.addEventListener('click', () => {
  systemPromptToggle.classList.toggle('open');
  systemPromptContent.classList.toggle('open');
});

systemPrompt.addEventListener('input', () => {
  localStorage.setItem('groq_system_prompt', systemPrompt.value);
});

// ===== Conversations =====
function createNewConversation() {
  const conv = {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
  };
  conversations.unshift(conv);
  saveConversations();
  setActiveConversation(conv.id);
  renderConversations();
}

function setActiveConversation(id) {
  activeConversationId = id;
  renderConversations();
  renderMessages();
}

function getActiveConversation() {
  return conversations.find(c => c.id === activeConversationId);
}

function saveConversations() {
  localStorage.setItem('groq_conversations', JSON.stringify(conversations));
}

function renderConversations() {
  conversationList.innerHTML = '';
  conversations.forEach(conv => {
    const el = document.createElement('div');
    el.className = 'conversation-item' + (conv.id === activeConversationId ? ' active' : '');
    el.textContent = conv.title;
    el.addEventListener('click', () => setActiveConversation(conv.id));
    conversationList.appendChild(el);
  });
}

// ===== Messages =====
function renderMessages() {
  const conv = getActiveConversation();
  chatMessages.innerHTML = '';

  if (!conv || conv.messages.length === 0) {
    chatMessages.appendChild(createWelcomeScreen());
    return;
  }

  conv.messages.forEach(msg => {
    chatMessages.appendChild(createMessageEl(msg.role, msg.content, msg.meta));
  });

  scrollToBottom();
}

function createWelcomeScreen() {
  const div = document.createElement('div');
  div.className = 'welcome-screen';
  div.id = 'welcomeScreen';
  div.innerHTML = `
    <div class="welcome-icon">⚡</div>
    <h1 class="welcome-title">Groq AI Chat</h1>
    <p class="welcome-subtitle">
      Lightning-fast AI responses powered by Groq's LPU inference engine.
      Choose a model and start chatting — or try one of the prompts below.
    </p>
    <div class="quick-prompts">
      <div class="quick-prompt" data-prompt="Explain quantum computing in simple terms, like I'm 10 years old.">
        <div class="quick-prompt-icon">🧪</div>
        <div class="quick-prompt-text">Explain quantum computing simply</div>
      </div>
      <div class="quick-prompt" data-prompt="Write a Python function that implements binary search with detailed comments.">
        <div class="quick-prompt-icon">💻</div>
        <div class="quick-prompt-text">Write a binary search in Python</div>
      </div>
      <div class="quick-prompt" data-prompt="Create a detailed meal plan for a week with healthy, budget-friendly recipes.">
        <div class="quick-prompt-icon">🍳</div>
        <div class="quick-prompt-text">Create a weekly meal plan</div>
      </div>
      <div class="quick-prompt" data-prompt="What are the top 10 most impactful AI breakthroughs of the last 5 years? Explain each briefly.">
        <div class="quick-prompt-icon">🤖</div>
        <div class="quick-prompt-text">Top 10 AI breakthroughs</div>
      </div>
    </div>
  `;

  // Bind quick prompts
  div.querySelectorAll('.quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.prompt;
      sendMessage();
    });
  });

  return div;
}

function createMessageEl(role, content, meta = {}) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;

  const avatar = role === 'user' ? '👤' : '⚡';
  const timeStr = meta.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let metaHTML = `<div class="message-meta">${timeStr}`;
  if (meta.tokens) {
    metaHTML += ` · ${meta.tokens} tokens`;
  }
  if (meta.speed) {
    metaHTML += ` · ${meta.speed} tok/s`;
  }
  if (meta.duration) {
    metaHTML += ` · ${meta.duration}s`;
  }
  metaHTML += '</div>';

  msg.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-bubble">${role === 'user' ? escapeHTML(content) : renderMarkdown(content)}</div>
      ${metaHTML}
    </div>
  `;
  return msg;
}

function addTypingIndicator() {
  const msg = document.createElement('div');
  msg.className = 'message assistant';
  msg.id = 'typingMsg';
  msg.innerHTML = `
    <div class="message-avatar">⚡</div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  chatMessages.appendChild(msg);
  scrollToBottom();
  return msg;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== Send Message =====
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isStreaming) return;
  if (!apiKey) {
    apiKeyModal.classList.remove('hidden');
    return;
  }

  const conv = getActiveConversation();
  if (!conv) return;

  // Remove welcome screen
  const welcome = chatMessages.querySelector('.welcome-screen');
  if (welcome) welcome.remove();

  // Add user message
  const userMeta = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  conv.messages.push({ role: 'user', content: text, meta: userMeta });
  chatMessages.appendChild(createMessageEl('user', text, userMeta));
  scrollToBottom();

  // Update title from first message
  if (conv.messages.length === 1) {
    conv.title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
    renderConversations();
  }

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Show typing indicator
  const typingEl = addTypingIndicator();
  isStreaming = true;

  try {
    // Build messages array
    const messages = [];
    const sysPrompt = systemPrompt.value.trim();
    if (sysPrompt) {
      messages.push({ role: 'system', content: sysPrompt });
    }
    // Include conversation history (last 20 messages for context)
    const historySlice = conv.messages.slice(-20);
    historySlice.forEach(m => {
      messages.push({ role: m.role, content: m.content });
    });

    const startTime = performance.now();

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelSelect.value,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let totalTokens = 0;

    // Replace typing indicator with actual message bubble
    typingEl.querySelector('.message-bubble').innerHTML = '';
    const bubble = typingEl.querySelector('.message-bubble');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            bubble.innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          }
          // Capture usage info
          if (parsed.x_groq?.usage) {
            totalTokens = parsed.x_groq.usage.completion_tokens || 0;
          }
          if (parsed.usage) {
            totalTokens = parsed.usage.completion_tokens || 0;
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const speed = totalTokens > 0 ? Math.round(totalTokens / parseFloat(elapsed)) : null;

    const assistantMeta = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tokens: totalTokens || undefined,
      speed: speed || undefined,
      duration: elapsed,
    };

    // Update meta display
    const metaEl = typingEl.querySelector('.message-meta');
    if (metaEl) {
      let metaText = assistantMeta.time;
      if (assistantMeta.tokens) metaText += ` · ${assistantMeta.tokens} tokens`;
      if (assistantMeta.speed) metaText += ` · ${assistantMeta.speed} tok/s`;
      if (assistantMeta.duration) metaText += ` · ${assistantMeta.duration}s`;
      metaEl.textContent = metaText;
    }

    // Save assistant message
    conv.messages.push({ role: 'assistant', content: fullContent, meta: assistantMeta });
    saveConversations();

  } catch (err) {
    typingEl.remove();
    showToast(err.message);
    console.error('Groq API error:', err);
  } finally {
    isStreaming = false;
    updateSendButton();
  }
}

// ===== Input Handling =====
chatInput.addEventListener('input', () => {
  // Auto-resize
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  updateSendButton();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

function updateSendButton() {
  sendBtn.disabled = !chatInput.value.trim() || isStreaming;
}

// ===== Toolbar =====
newChatBtn.addEventListener('click', createNewConversation);

clearBtn.addEventListener('click', () => {
  const conv = getActiveConversation();
  if (!conv) return;
  conv.messages = [];
  conv.title = 'New Chat';
  saveConversations();
  renderConversations();
  renderMessages();
});

exportBtn.addEventListener('click', () => {
  const conv = getActiveConversation();
  if (!conv || conv.messages.length === 0) return;

  const exportData = {
    title: conv.title,
    model: modelSelect.value,
    exportedAt: new Date().toISOString(),
    messages: conv.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `groq-chat-${conv.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ===== Sidebar Toggle (mobile) =====
menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && e.target !== menuBtn) {
      sidebar.classList.remove('open');
    }
  }
});

// ===== Quick prompts (initial welcome, bound via delegation) =====
document.addEventListener('click', (e) => {
  const qp = e.target.closest('.quick-prompt');
  if (qp && qp.dataset.prompt) {
    chatInput.value = qp.dataset.prompt;
    sendMessage();
  }
});

// ===== Toast =====
function showToast(message) {
  errorToast.textContent = '❌ ' + message;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), 5000);
}

// ===== Markdown Renderer =====
function renderMarkdown(text) {
  if (!text) return '';

  let html = text;

  // Code blocks (```lang\ncode\n```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHTML(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs – wrap remaining text blocks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Start =====
init();
