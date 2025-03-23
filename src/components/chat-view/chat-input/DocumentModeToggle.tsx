import { FileText, MessageCircle } from 'lucide-react'

export function DocumentModeToggle({ 
  isActive, 
  onClick
}: { 
  isActive: boolean
  onClick: () => void 
}) {
  return (
    <button 
      className="smtcmp-mode-toggle-button"
      onClick={onClick}
      title={isActive 
        ? "Switch to Chat Mode: Conversational assistant for questions and targeted edits" 
        : "Switch to Document Mode: Creates well-structured comprehensive documents"
      }
    >
      <div className="smtcmp-mode-toggle-icon">
        {isActive ? <FileText size={14} /> : <MessageCircle size={14} />}
      </div>
      <div>{isActive ? 'Document' : 'Chat'}</div>
    </button>
  )
} 