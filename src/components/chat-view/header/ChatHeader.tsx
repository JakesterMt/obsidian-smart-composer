import React from 'react'
import { History, Import, Plus, Save } from 'lucide-react'
import { DocumentModeToggle } from '../chat-input/DocumentModeToggle'
import { ChatListDropdown } from '../ChatListDropdown'
import { SmartComposerSettings } from '../../../settings/schema/setting.types'

export interface ChatHeaderProps {
  currentConversationId: string
  chatList: Array<{ id: string; title: string }>
  settings: SmartComposerSettings
  onNewChat: () => void
  onLoadConversation: (conversationId: string) => Promise<void>
  onDeleteConversation: (conversationId: string) => Promise<void>
  onUpdateConversationTitle: (conversationId: string, newTitle: string) => Promise<void>
  onSaveConversation: () => void
  onImportChat: () => void
  onToggleDocumentMode: () => void
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentConversationId,
  chatList,
  settings,
  onNewChat,
  onLoadConversation,
  onDeleteConversation,
  onUpdateConversationTitle,
  onSaveConversation,
  onImportChat,
  onToggleDocumentMode,
}) => {
  return (
    <div className="smtcmp-chat-header">
      <div className="smtcmp-chat-header-left">
        <h1 className="smtcmp-chat-header-title">Chat</h1>
        <DocumentModeToggle 
          isActive={settings.documentMode} 
          onClick={onToggleDocumentMode} 
        />
      </div>
      <div className="smtcmp-chat-header-buttons">
        <button
          className="smtcmp-chat-header-button"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <Plus size={16} />
        </button>
        <ChatListDropdown
          chatList={chatList}
          currentConversationId={currentConversationId}
          onSelect={onLoadConversation}
          onDelete={onDeleteConversation}
          onUpdateTitle={onUpdateConversationTitle}
          className="smtcmp-chat-header-button"
        >
          <History size={16} />
        </ChatListDropdown>
        <button
          className="smtcmp-chat-header-button"
          onClick={onSaveConversation}
          aria-label="Save conversation"
        >
          <Save size={16} />
        </button>
        <button
          className="smtcmp-chat-header-button"
          onClick={onImportChat}
          aria-label="Import chat"
        >
          <Import size={16} />
        </button>
      </div>
    </div>
  )
}

export default React.memo(ChatHeader) 