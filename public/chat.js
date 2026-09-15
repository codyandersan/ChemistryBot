const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let history = [];

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
  messagesEl.scrollTop = messagesEl.scrollHeight;

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
    inputEl.focus();
  }
}

function appendMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  
  // Basic markdown parsing for inline code and line breaks
  const formattedText = text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
    
  div.innerHTML = formattedText;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
