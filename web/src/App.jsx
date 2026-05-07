// Less noise. More signal. AnomFIN.
import { useState, useEffect, useMemo } from 'react';
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
import OutgoingMessagesPanel from './components/OutgoingMessagesPanel.jsx';
import { getGlobalSettings } from './api/client.js';

function Dashboard() {
  const { conversations, loading, refresh } = useConversations();
  const { status } = useStatus();
  const botActivities = useBotActivity();
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'presets' | 'global' | 'qr' | 'logs'
  const [branding, setBranding] = useState(() => normalizeBrandingSettings({}));
  const [showSidebar, setShowSidebar] = useState(() => {
    const saved = localStorage.getItem('anomchatbot-sidebar-visible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

  useEffect(() => {
    localStorage.setItem('anomchatbot-sidebar-visible', JSON.stringify(showSidebar));
  }, [showSidebar]);

  useEffect(() => {
    getGlobalSettings()
      .then(data => setBranding(normalizeBrandingSettings(data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      // Toggle sidebar with Ctrl+\ or Cmd+\
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);

  const toggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[branding]', {
      hasLogo: Boolean(branding.topBarLogoDataUrl),
      hasBackground: Boolean(branding.chatBackgroundDataUrl),
    });
  }, [branding.topBarLogoDataUrl, branding.chatBackgroundDataUrl]);

  const chatBackgroundStyle = useMemo(() => (
    branding.chatBackgroundDataUrl
      ? { '--chat-background-image': `url(${branding.chatBackgroundDataUrl})` }
      : undefined
  ), [branding.chatBackgroundDataUrl]);

  const handleBrandingSettingsChange = (settings) => {
    setBranding(normalizeBrandingSettings(settings));
  };

  const handleNewConversationCreated = (conversation, existed) => {
    setShowNewConversation(false);
    setSelectedId(conversation.id);
    if (!existed) refresh();
  };

  return (
    <div className="app-container">
      <StatusBar status={status} botActivities={botActivities} branding={branding} />

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
          <div className={`chat-layout ${!showSidebar ? 'sidebar-hidden' : ''}`}>
            <OutgoingMessagesPanel onSelectConversation={(id) => { setSelectedId(id); setShowSettings(false); }} />
            {showSidebar && (
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setShowSettings(false); }}
                botActivities={botActivities}
                onNewConversation={() => setShowNewConversation(true)}
              />
            )}
            <div className={`chat-main chat-shell ${branding.chatBackgroundDataUrl ? 'has-chat-background' : ''}`} style={chatBackgroundStyle}>
              {branding.chatBackgroundDataUrl && (
                <>
                  <div className="chat-background-layer" aria-hidden="true" />
                  <div className="chat-background-overlay" aria-hidden="true" />
                </>
              )}
              <div className="chat-content">
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                title={showSidebar ? 'Hide sidebar (Ctrl+\\)' : 'Show sidebar (Ctrl+\\)'}
              >
                {showSidebar ? '‹' : '›'}
              </button>
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

        {activeTab === 'global' && <GlobalSettings status={status} onBrandingChange={handleBrandingSettingsChange} />}

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


function normalizeBrandingSettings(settings) {
  return {
    topBarLogoDataUrl: settings?.branding_top_bar_logo || null,
    chatBackgroundDataUrl: settings?.branding_chat_background || null,
  };
}
