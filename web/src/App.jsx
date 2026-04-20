import { useState } from 'react';
import { SocketProvider } from './context/SocketContext.jsx';
import { useConversations, useBotActivity } from './hooks/useConversations.js';
import { useStatus } from './hooks/useStatus.js';
import StatusBar from './components/StatusBar.jsx';
import ConversationList from './components/ConversationList.jsx';
import ConversationView from './components/ConversationView.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import GlobalSettings from './components/GlobalSettings.jsx';
import QRCodeDisplay from './components/QRCodeDisplay.jsx';
import LogsView from './components/LogsView.jsx';
import PresetsManager from './components/PresetsManager.jsx';
import NewConversation from './components/NewConversation.jsx';

function Dashboard() {
  const { conversations, loading, refresh } = useConversations();
  const { status } = useStatus();
  const botActivities = useBotActivity();
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'presets' | 'global' | 'qr' | 'logs'

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

  const handleNewConversationCreated = (conversation, existed) => {
    setShowNewConversation(false);
    setSelectedId(conversation.id);
    if (!existed) refresh();
  };

  return (
    <div className="app-container">
      <StatusBar status={status} botActivities={botActivities} />

      <div className="app-nav">
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          Conversations
        </button>
        <button className={activeTab === 'presets' ? 'active' : ''} onClick={() => setActiveTab('presets')}>
          Presets
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
              botActivities={botActivities}
              onNewConversation={() => setShowNewConversation(true)}
            />
            <div className="chat-main">
              <ConversationView
                conversationId={selectedId}
                conversation={selectedConversation}
                botActivity={botActivities[selectedId]}
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

        {activeTab === 'presets' && <PresetsManager />}

        {activeTab === 'global' && <GlobalSettings status={status} />}

        {activeTab === 'qr' && (
          <QRCodeDisplay whatsappStatus={status?.whatsapp || { mode: status?.modes?.whatsappMode }} />
        )}

        {activeTab === 'logs' && <LogsView />}
      </div>

      {showNewConversation && (
        <NewConversation
          onCreated={handleNewConversationCreated}
          onClose={() => setShowNewConversation(false)}
        />
      )}
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
