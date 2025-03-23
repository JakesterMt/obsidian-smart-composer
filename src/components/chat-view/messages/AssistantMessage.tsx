import React from 'react'
import { ChatAssistantMessage, ChatMessage } from '../../../types/chat'
import ReactMarkdown from '../ReactMarkdown'
import AssistantMessageActions from '../AssistantMessageActions'

export interface AssistantMessageProps {
  message: ChatAssistantMessage
  index: number
  chatMessages: ChatMessage[]
  handleApply: (blockToApply: string, chatMessages: ChatMessage[]) => void
  handleApplyEntireMessage: (message: ChatAssistantMessage) => void
  isApplying: boolean
  conversationId: string
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  index,
  chatMessages,
  handleApply,
  handleApplyEntireMessage,
  isApplying,
  conversationId,
}) => {
  return (
    <div className="smtcmp-chat-messages-assistant">
      <ReactMarkdownItem
        index={index}
        chatMessages={chatMessages}
        handleApply={handleApply}
        isApplying={isApplying}
        conversationId={conversationId}
      >
        {message.content}
      </ReactMarkdownItem>
      {message.content && (
        <AssistantMessageActions
          message={message}
          onApply={() => handleApplyEntireMessage(message)}
          conversationId={conversationId}
        />
      )}
    </div>
  )
}

function ReactMarkdownItem({
  index,
  chatMessages,
  handleApply,
  isApplying,
  children,
  conversationId,
}: {
  index: number
  chatMessages: ChatMessage[]
  handleApply: (blockToApply: string, chatMessages: ChatMessage[]) => void
  isApplying: boolean
  children: string
  conversationId: string
}) {
  return (
    <ReactMarkdown
      onApply={(blockToApply) => {
        handleApply(blockToApply, chatMessages.slice(0, index + 1))
      }}
      isApplying={isApplying}
      conversationId={conversationId}
    >
      {children}
    </ReactMarkdown>
  )
}

export default React.memo(AssistantMessage) 