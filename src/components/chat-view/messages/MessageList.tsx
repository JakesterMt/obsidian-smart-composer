import React from 'react'
import { CircleStop } from 'lucide-react'
import { ChatAssistantMessage, ChatMessage } from '../../../types/chat'
import { ChatUserInputRef } from '../chat-input/ChatUserInput'
import { QueryProgressState } from '../QueryProgress'
import { ReactMarkdownProps } from '../ReactMarkdown'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'
import QueryProgress from '../QueryProgress'

export interface MessageListProps {
  chatMessages: ChatMessage[]
  focusedMessageId: string | null
  queryProgress: QueryProgressState
  isSubmitting: boolean
  currentConversationId: string
  registerChatUserInputRef: (id: string, ref: ChatUserInputRef | null) => void
  setFocusedMessageId: (id: string | null) => void
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  handleSubmit: (messages: ChatMessage[], useVaultSearch: boolean) => void
  handleApply: (blockToApply: string, chatMessages: ChatMessage[]) => void
  handleApplyEntireMessage: (message: ChatAssistantMessage) => void
  abortActiveStreams: () => void
  isApplying: boolean
}

const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
  (
    {
      chatMessages,
      focusedMessageId,
      queryProgress,
      isSubmitting,
      currentConversationId,
      registerChatUserInputRef,
      setFocusedMessageId,
      setChatMessages,
      handleSubmit,
      handleApply,
      handleApplyEntireMessage,
      abortActiveStreams,
      isApplying,
    },
    ref
  ) => {
    return (
      <div className="smtcmp-chat-messages" ref={ref}>
        {chatMessages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage
              key={message.id}
              message={message}
              index={index}
              chatMessages={chatMessages}
              registerChatUserInputRef={registerChatUserInputRef}
              setFocusedMessageId={setFocusedMessageId}
              setChatMessages={setChatMessages}
              handleSubmit={handleSubmit}
            />
          ) : (
            <AssistantMessage
              key={message.id}
              message={message as ChatAssistantMessage}
              index={index}
              chatMessages={chatMessages}
              handleApply={handleApply}
              handleApplyEntireMessage={handleApplyEntireMessage}
              isApplying={isApplying}
              conversationId={currentConversationId}
            />
          )
        )}
        <QueryProgress state={queryProgress} />
        {isSubmitting && (
          <button onClick={abortActiveStreams} className="smtcmp-stop-gen-btn">
            <CircleStop size={16} />
            <div>Stop Generation</div>
          </button>
        )}
      </div>
    )
  }
)

MessageList.displayName = 'MessageList'

export default React.memo(MessageList) 