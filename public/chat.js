const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const chatView = document.getElementById('chat-view');
const aboutView = document.getElementById('about-view');

let history = [];

// ---- Reliable full-height sizing on mobile (avoids gaps when the on-screen keyboard opens/closes) ----
function setAppHeight() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${vh}px`);
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setAppHeight);
}

// ---- Menu / view switching ----
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
});

menuDropdown.querySelectorAll('.menu-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view === 'chat') {
      chatView.classList.remove('hidden');
      aboutView.classList.add('hidden');
    } else {
      chatView.classList.add('hidden');
      aboutView.classList.remove('hidden');
    }
    menuDropdown.classList.add('hidden');
  });
});

// ---- Input handling ----
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  inputEl.value = '';
  inputEl.style.height = 'auto';
  inputEl.disabled = true;
  sendBtn.disabled = true;

  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'typing';
  thinkingEl.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(thinkingEl);
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history })
    });

    const data = await response.json();
    thinkingEl.remove();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch');
    }

    appendMessage(data.reply, 'assistant');

    // Update history for Gemini (roles must be 'user' or 'model')
    history.push({ role: 'user', parts: [{ text }] });
    history.push({ role: 'model', parts: [{ text: data.reply }] });
  } catch (err) {
    thinkingEl.remove();
    appendMessage('Something went wrong — try again', 'assistant error');
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
  }
}

function appendMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;

  const rawHtml = marked.parse(text, { breaks: true });
  div.innerHTML = DOMPurify.sanitize(rawHtml);

  messagesEl.appendChild(div);

  // Typeset any LaTeX math in the message ($...$, $$...$$, \(...\), \[...\])
  if (window.renderMathInElement) {
    renderMathInElement(div, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}
