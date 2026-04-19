import { useState } from 'react';
import { SocketProvider } from './context/SocketContext.jsx';
import { useConversations } from './hooks/useConversations.js';
import { useStatus } from './hooks/useStatus.js';
import StatusBar from './components/StatusBar.jsx';
import ConversationList from './components/ConversationList.jsx';
import ConversationView from './components/ConversationView.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import GlobalSettings from './components/GlobalSettings.jsx';
import QRCodeDisplay from './components/QRCodeDisplay.jsx';
import LogsView from './components/LogsView.jsx';

function Dashboard() {
  const { conversations, loading } = useConversations();
  const { status } = useStatus();
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'global' | 'qr' | 'logs'

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

  return (
    <div className="app-container">
      <StatusBar status={status} />

      <div className="app-nav">
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          Conversations
        </button>
        <button className={activeTab === 'global' ? 'active' : ''} onClick={() => setActiveTab('global')}>
          System
        </button>
        <button className={activeTab === 'qr' ? 'active' : ''} onClick={() => setActiveTab('qr')}>
          QR / WhatsApp
        </button>
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>
          Logs
        </button>
      </div>

      <div className="app-body">
        {activeTab === 'chat' && (
          <div className="chat-layout">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setShowSettings(false); }}
            />
            <div className="chat-main">
              <ConversationView
                conversationId={selectedId}
                conversation={selectedConversation}
              />
              {selectedId && (
                <button
                  className="settings-toggle"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  {showSettings ? 'Hide Settings' : 'Settings'}
                </button>
              )}
            </div>
            {showSettings && selectedId && (
              <SettingsPanel
                conversationId={selectedId}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        )}

        {activeTab === 'global' && <GlobalSettings status={status} />}

        {activeTab === 'qr' && (
          <QRCodeDisplay whatsappStatus={status?.whatsapp || { mode: status?.modes?.whatsappMode }} />
        )}

        {activeTab === 'logs' && <LogsView />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <Dashboard />
    </SocketProvider>
  );
}
