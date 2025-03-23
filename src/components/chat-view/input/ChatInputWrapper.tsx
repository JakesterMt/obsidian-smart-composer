import React from 'react'
import { ChatMessage, ChatUserMessage } from '../../../types/chat'
import ChatUserInput, { ChatUserInputRef } from '../chat-input/ChatUserInput'
import { editorStateToPlainText } from '../chat-input/utils/editor-state-to-plain-text'
import { Mentionable } from '../../../types/mentionable'

interface ChatInputWrapperProps {
  inputMessage: ChatUserMessage
  chatMessages: ChatMessage[]
  registerChatUserInputRef: (id: string, ref: ChatUserInputRef | null) => void
  setInputMessage: React.Dispatch<React.SetStateAction<ChatUserMessage>>
  setFocusedMessageId: (id: string | null) => void
  handleSubmit: (messages: ChatMessage[], useVaultSearch: boolean) => void
  handleScrollToBottom: () => void
  preventAutoScrollRef: React.MutableRefObject<boolean>
  addedBlockKey: string | null
  autoFocus?: boolean
}

const ChatInputWrapper: React.FC<ChatInputWrapperProps> = ({
  inputMessage,
  chatMessages,
  registerChatUserInputRef,
  setInputMessage,
  setFocusedMessageId,
  handleSubmit,
  handleScrollToBottom,
  preventAutoScrollRef,
  addedBlockKey,
  autoFocus,
}) => {
  const handleChange = React.useCallback(
    (content: any) => {
      setInputMessage((prevInputMessage) => ({
        ...prevInputMessage,
        content,
      }))
    },
    [setInputMessage]
  )

  const handleInputSubmit = React.useCallback(
    (content: any, useVaultSearch: boolean) => {
      if (editorStateToPlainText(content).trim() === '') return
      handleSubmit([...chatMessages, { ...inputMessage, content }], useVaultSearch)
      preventAutoScrollRef.current = false
      handleScrollToBottom()
    },
    [chatMessages, handleSubmit, handleScrollToBottom, inputMessage, preventAutoScrollRef]
  )

  const handleSetMentionables = React.useCallback(
    (mentionables: Mentionable[]) => {
      setInputMessage((prevInputMessage) => ({
        ...prevInputMessage,
        mentionables,
      }))
    },
    [setInputMessage]
  )

  return (
    <ChatUserInput
      key={inputMessage.id} // this is needed to clear the editor when the user submits a new message
      ref={(ref) => registerChatUserInputRef(inputMessage.id, ref)}
      initialSerializedEditorState={inputMessage.content}
      onChange={handleChange}
      onSubmit={handleInputSubmit}
      onFocus={() => {
        setFocusedMessageId(inputMessage.id)
      }}
      mentionables={inputMessage.mentionables}
      setMentionables={handleSetMentionables}
      autoFocus={autoFocus}
      addedBlockKey={addedBlockKey}
    />
  )
}

export default React.memo(ChatInputWrapper) 