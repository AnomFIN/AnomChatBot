// AnomChatBot Web GUI JavaScript

// Global state
let currentChatId = null;
let conversations = [];
let socket = null;

// API Base URL
const API_BASE = window.location.origin;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    loadStatus();
    loadConversations();
    
    // Auto-refresh status every 30 seconds
    setInterval(loadStatus, 30000);
    
    // Auto-refresh conversations every 10 seconds
    setInterval(loadConversations, 10000);
});

// WebSocket connection
function initializeWebSocket() {
    socket = io(API_BASE);
    
    socket.on('connect', function() {
        console.log('WebSocket connected');
    });
    
    socket.on('disconnect', function() {
        console.log('WebSocket disconnected');
    });
    
    socket.on('new_message', function(data) {
        console.log('New message received:', data);
        
        // If message is for current chat, add it to messages
        if (data.chat_id === currentChatId) {
            addMessageToUI(data.role, data.content, data.timestamp);
        }
        
        // Refresh conversations list
        loadConversations();
    });
    
    socket.on('status_update', function(data) {
        console.log('Status update:', data);
        updateStatusIndicators(data);
    });
}

// Load bot status
async function loadStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        updateStatusIndicators(data);
        updateStatusModal(data);
        
    } catch (error) {
        console.error('Error loading status:', error);
    }
}

// Update status indicators in header
function updateStatusIndicators(status) {
    // WhatsApp status
    const whatsappEl = document.getElementById('whatsapp-status');
    const whatsappText = document.getElementById('whatsapp-text');
    whatsappEl.classList.remove('connected', 'disconnected');
    if (status.whatsapp_status === 'connected') {
        whatsappEl.classList.add('connected');
        whatsappText.textContent = 'Connected';
    } else {
        whatsappEl.classList.add('disconnected');
        whatsappText.textContent = 'Disconnected';
    }
    
    // Telegram status
    const telegramEl = document.getElementById('telegram-status');
    const telegramText = document.getElementById('telegram-text');
    telegramEl.classList.remove('connected', 'disconnected', 'disabled');
    if (!status.telegram_enabled) {
        telegramEl.classList.add('disabled');
        telegramText.textContent = 'Disabled';
    } else if (status.telegram_status === 'connected') {
        telegramEl.classList.add('connected');
        telegramText.textContent = 'Connected';
    } else {
        telegramEl.classList.add('disconnected');
        telegramText.textContent = 'Disconnected';
    }
    
    // OpenAI status
    const openaiEl = document.getElementById('openai-status');
    const openaiText = document.getElementById('openai-text');
    openaiEl.classList.remove('connected', 'disconnected');
    openaiEl.classList.add(status.openai_status === 'connected' ? 'connected' : 'disconnected');
    openaiText.textContent = status.openai_status === 'connected' ? 'Ready' : 'Unknown';
}

// Update status modal
function updateStatusModal(status) {
    document.getElementById('bot-running-status').textContent = 
        status.bot_running ? 'Running' : 'Stopped';
    document.getElementById('active-conv-count').textContent = 
        status.active_conversations || 0;
    document.getElementById('whatsapp-status-detail').textContent = 
        status.whatsapp_status || 'Unknown';
    document.getElementById('telegram-status-detail').textContent = 
        status.telegram_enabled ? (status.telegram_status || 'Unknown') : 'Disabled';
    document.getElementById('status-timestamp').textContent = 
        new Date(status.timestamp).toLocaleString();
}

// Load conversations
async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE}/api/conversations`);
        conversations = await response.json();
        
        renderConversations(conversations);
        
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// Render conversations list
function renderConversations(convs) {
    const listEl = document.getElementById('conversations-list');
    
    if (convs.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>No conversations yet</p>
                <small>Conversations will appear here when you receive messages</small>
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = convs.map(conv => `
        <div class="conversation-item ${conv.chat_id === currentChatId ? 'active' : ''}" 
             onclick="selectConversation('${conv.chat_id}', '${escapeHtml(conv.contact_name)}')">
            <div class="conversation-header">
                <span class="conversation-name">${escapeHtml(conv.contact_name)}</span>
                <span class="conversation-time">${formatTime(conv.last_message)}</span>
            </div>
            <div class="conversation-preview">
                ${conv.message_count} messages
                ${conv.ai_enabled ? '<span class="conversation-badge">AI Active</span>' : ''}
            </div>
        </div>
    `).join('');
}

// Filter conversations
function filterConversations() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filtered = conversations.filter(conv => 
        conv.contact_name.toLowerCase().includes(searchTerm)
    );
    renderConversations(filtered);
}

// Select a conversation
async function selectConversation(chatId, contactName) {
    currentChatId = chatId;
    
    // Update UI
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('contact-name').textContent = contactName;
    
    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Load messages
    await loadMessages(chatId);
}

// Load messages for a conversation
async function loadMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
        
        const response = await fetch(`${API_BASE}/api/messages/${chatId}`);
        const messages = await response.json();
        
        // Render messages
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="loading-messages">No messages yet. Start the conversation!</div>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => `
                <div class="message ${msg.role}">
                    <div class="message-bubble">
                        <div class="message-content">${escapeHtml(msg.content)}</div>
                        <span class="message-timestamp">${formatTime(msg.timestamp)}</span>
                    </div>
                </div>
            `).join('');
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Update contact status
        document.getElementById('contact-status').textContent = 
            `${messages.length} messages`;
        
    } catch (error) {
        console.error('Error loading messages:', error);
        document.getElementById('messages-container').innerHTML = 
            '<div class="loading-messages">Error loading messages. Please try again.</div>';
    }
}

// Add message to UI (for real-time updates)
function addMessageToUI(role, content, timestamp) {
    const messagesContainer = document.getElementById('messages-container');
    
    // Remove loading/empty state
    const loadingEl = messagesContainer.querySelector('.loading-messages');
    if (loadingEl) {
        loadingEl.remove();
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${escapeHtml(content)}</div>
            <span class="message-timestamp">${formatTime(timestamp)}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
async function sendMessage() {
    if (!currentChatId) {
        alert('Please select a conversation first');
        return;
    }
    
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) {
        return;
    }
    
    try {
        // Disable input
        input.disabled = true;
        document.querySelector('.btn-send').disabled = true;
        
        // Send to API
        const response = await fetch(`${API_BASE}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: currentChatId,
                message: message
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add message to UI
            addMessageToUI('assistant', message, new Date().toISOString());
            
            // Clear input
            input.value = '';
        } else {
            alert('Failed to send message: ' + (result.error || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again.');
    } finally {
        // Re-enable input
        input.disabled = false;
        document.querySelector('.btn-send').disabled = false;
        input.focus();
    }
}

// Handle message input keydown
function handleMessageKeydown(event) {
    // Send on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Close chat
function closeChat() {
    currentChatId = null;
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('chat-screen').style.display = 'none';
    
    // Clear active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Show settings modal
function showSettings() {
    loadConfig();
    document.getElementById('settings-modal').classList.add('active');
}

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const config = await response.json();
        
        document.getElementById('telegram-enabled').checked = config.telegram_enabled;
        
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Save settings
async function saveSettings() {
    try {
        const telegramEnabled = document.getElementById('telegram-enabled').checked;
        
        const response = await fetch(`${API_BASE}/api/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_enabled: telegramEnabled
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Settings saved successfully! Please restart the bot for changes to take effect.');
            closeModal('settings-modal');
            loadStatus();
        } else {
            alert('Failed to save settings');
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings. Please try again.');
    }
}

// Update Telegram status
function updateTelegramStatus() {
    const enabled = document.getElementById('telegram-enabled').checked;
    // Could trigger an immediate API call here if needed
}

// Show modal
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
    
    // Format as date
    return date.toLocaleDateString();
}

// Make functions available globally
window.loadConversations = loadConversations;
window.selectConversation = selectConversation;
window.loadMessages = loadMessages;
window.sendMessage = sendMessage;
window.handleMessageKeydown = handleMessageKeydown;
window.closeChat = closeChat;
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.updateTelegramStatus = updateTelegramStatus;
window.showModal = showModal;
window.closeModal = closeModal;
window.loadStatus = loadStatus;
window.filterConversations = filterConversations;
