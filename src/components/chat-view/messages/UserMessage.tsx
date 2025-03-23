import React from 'react'
import ChatUserInput, { ChatUserInputRef } from '../chat-input/ChatUserInput'
import { ChatMessage, ChatUserMessage } from '../../../types/chat'
import { editorStateToPlainText } from '../chat-input/utils/editor-state-to-plain-text'
import SimilaritySearchResults from '../SimilaritySearchResults'

interface UserMessageProps {
  message: ChatUserMessage
  index: number
  chatMessages: ChatMessage[]
  registerChatUserInputRef: (id: string, ref: ChatUserInputRef | null) => void
  setFocusedMessageId: (id: string | null) => void
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  handleSubmit: (messages: ChatMessage[], useVaultSearch: boolean) => void
}

const UserMessage: React.FC<UserMessageProps> = ({
  message,
  index,
  chatMessages,
  registerChatUserInputRef,
  setFocusedMessageId,
  setChatMessages,
  handleSubmit,
}) => {
  return (
    <div className="smtcmp-chat-messages-user">
      <ChatUserInput
        ref={(ref) => registerChatUserInputRef(message.id, ref)}
        initialSerializedEditorState={message.content}
        onChange={(content) => {
          setChatMessages((prevChatHistory) =>
            prevChatHistory.map((msg) =>
              msg.role === 'user' && msg.id === message.id
                ? {
                    ...msg,
                    content,
                  }
                : msg,
            ),
          )
        }}
        onSubmit={(content, useVaultSearch) => {
          if (editorStateToPlainText(content).trim() === '') return
          handleSubmit(
            [
              ...chatMessages.slice(0, index),
              {
                role: 'user',
                content: content,
                promptContent: null,
                id: message.id,
                mentionables: message.mentionables,
              },
            ],
            useVaultSearch,
          )
        }}
        onFocus={() => {
          setFocusedMessageId(message.id)
        }}
        mentionables={message.mentionables}
        setMentionables={(mentionables) => {
          setChatMessages((prevChatHistory) =>
            prevChatHistory.map((msg) =>
              msg.id === message.id ? { ...msg, mentionables } : msg,
            ),
          )
        }}
      />
      {message.similaritySearchResults && (
        <SimilaritySearchResults
          similaritySearchResults={message.similaritySearchResults}
        />
      )}
    </div>
  )
}

export default React.memo(UserMessage) 