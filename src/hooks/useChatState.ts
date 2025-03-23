import { useState, useRef, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { App, Notice } from 'obsidian'
import { useApp } from '../contexts/app-context'
import { useSettings } from '../contexts/settings-context'
import { ChatMessage, ChatUserMessage } from '../types/chat'
import { 
  MentionableBlock, 
  MentionableBlockData, 
  MentionableCurrentFile 
} from '../types/mentionable'
import { QueryProgressState } from '../components/chat-view/QueryProgress'
import { ChatUserInputRef } from '../components/chat-view/chat-input/ChatUserInput'
import { 
  getMentionableKey, 
  serializeMentionable 
} from '../utils/mentionable'

/**
 * Creates a new empty user message with the current file as context
 */
export const getNewInputMessage = (app: App): ChatUserMessage => {
  return {
    role: 'user',
    content: null,
    promptContent: null,
    id: uuidv4(),
    mentionables: [
      {
        type: 'current-file',
        file: app.workspace.getActiveFile(),
      },
    ],
  }
}

interface UseChatStateOptions {
  selectedBlock?: MentionableBlockData
}

/**
 * Hook to manage the core chat state
 */
export function useChatState(options: UseChatStateOptions = {}) {
  const app = useApp()
  const { settings } = useSettings()
  const { selectedBlock } = options
  
  // Core state
  const [inputMessage, setInputMessage] = useState<ChatUserMessage>(() => {
    const newMessage = getNewInputMessage(app)
    if (selectedBlock) {
      newMessage.mentionables = [
        ...newMessage.mentionables,
        {
          type: 'block',
          ...selectedBlock,
        },
      ]
    }
    return newMessage
  })

  const [addedBlockKey, setAddedBlockKey] = useState<string | null>(
    selectedBlock
      ? getMentionableKey(
          serializeMentionable({
            type: 'block',
            ...selectedBlock,
          }),
        )
      : null,
  )

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string>(uuidv4())
  const [queryProgress, setQueryProgress] = useState<QueryProgressState>({
    type: 'idle',
  })

  // Refs
  const preventAutoScrollRef = useRef(false)
  const lastProgrammaticScrollRef = useRef<number>(0)
  const activeStreamAbortControllersRef = useRef<AbortController[]>([])
  const chatUserInputRefs = useRef<Map<string, ChatUserInputRef>>(new Map())
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  /**
   * Register a chat user input ref
   */
  const registerChatUserInputRef = useCallback((
    id: string,
    ref: ChatUserInputRef | null,
  ) => {
    if (ref) {
      chatUserInputRefs.current.set(id, ref)
    } else {
      chatUserInputRefs.current.delete(id)
    }
  }, [])

  /**
   * Handle scrolling to the bottom of the chat
   */
  const handleScrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      const scrollContainer = chatMessagesRef.current
      if (scrollContainer.scrollTop !== scrollContainer.scrollHeight) {
        lastProgrammaticScrollRef.current = Date.now()
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  /**
   * Abort all active stream controllers
   */
  const abortActiveStreams = useCallback(() => {
    for (const abortController of activeStreamAbortControllersRef.current) {
      abortController.abort()
    }
    activeStreamAbortControllersRef.current = []
  }, [])

  /**
   * Start a new chat session
   */
  const handleNewChat = useCallback((newSelectedBlock?: MentionableBlockData) => {
    setCurrentConversationId(uuidv4())
    setChatMessages([])
    const newInputMessage = getNewInputMessage(app)
    if (newSelectedBlock) {
      const mentionableBlock: MentionableBlock = {
        type: 'block',
        ...newSelectedBlock,
      }
      newInputMessage.mentionables = [
        ...newInputMessage.mentionables,
        mentionableBlock,
      ]
      setAddedBlockKey(
        getMentionableKey(serializeMentionable(mentionableBlock)),
      )
    }
    setInputMessage(newInputMessage)
    setFocusedMessageId(newInputMessage.id)
    setQueryProgress({
      type: 'idle',
    })
    abortActiveStreams()
  }, [app, abortActiveStreams])

  /**
   * Add a selection to the current chat
   */
  const addSelectionToChat = useCallback((newSelectedBlock: MentionableBlockData) => {
    const mentionable: Omit<MentionableBlock, 'id'> = {
      type: 'block',
      ...newSelectedBlock,
    }

    setAddedBlockKey(getMentionableKey(serializeMentionable(mentionable)))

    if (focusedMessageId === inputMessage.id) {
      setInputMessage((prevInputMessage) => {
        const mentionableKey = getMentionableKey(
          serializeMentionable(mentionable),
        )
        // Check if mentionable already exists
        if (
          prevInputMessage.mentionables.some(
            (m) =>
              getMentionableKey(serializeMentionable(m)) === mentionableKey,
          )
        ) {
          return prevInputMessage
        }
        return {
          ...prevInputMessage,
          mentionables: [...prevInputMessage.mentionables, mentionable],
        }
      })
    } else {
      setChatMessages((prevChatHistory) =>
        prevChatHistory.map((message) => {
          if (message.id === focusedMessageId && message.role === 'user') {
            const mentionableKey = getMentionableKey(
              serializeMentionable(mentionable),
            )
            // Check if mentionable already exists
            if (
              message.mentionables.some(
                (m) =>
                  getMentionableKey(serializeMentionable(m)) ===
                  mentionableKey,
              )
            ) {
              return message
            }
            return {
              ...message,
              mentionables: [...message.mentionables, mentionable],
            }
          }
          return message
        }),
      )
    }
  }, [focusedMessageId, inputMessage.id])

  /**
   * Focus the current active message
   */
  const focusMessage = useCallback(() => {
    if (!focusedMessageId) return
    chatUserInputRefs.current.get(focusedMessageId)?.focus()
  }, [focusedMessageId])

  // Handle scroll events
  useEffect(() => {
    const scrollContainer = chatMessagesRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      // If the scroll event happened very close to our programmatic scroll, ignore it
      if (Date.now() - lastProgrammaticScrollRef.current < 50) {
        return
      }

      preventAutoScrollRef.current =
        scrollContainer.scrollHeight -
          scrollContainer.scrollTop -
          scrollContainer.clientHeight >
        20
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [chatMessages])

  // Initialize focusedMessageId
  useEffect(() => {
    setFocusedMessageId(inputMessage.id)
  }, [])

  // Handle active file change
  const handleActiveLeafChange = useCallback(() => {
    const activeFile = app.workspace.getActiveFile()
    if (!activeFile) return

    const mentionable: Omit<MentionableCurrentFile, 'id'> = {
      type: 'current-file',
      file: activeFile,
    }

    if (!focusedMessageId) return
    if (inputMessage.id === focusedMessageId) {
      setInputMessage((prevInputMessage) => ({
        ...prevInputMessage,
        mentionables: [
          mentionable,
          ...prevInputMessage.mentionables.filter(
            (mentionable) => mentionable.type !== 'current-file',
          ),
        ],
      }))
    } else {
      setChatMessages((prevChatHistory) =>
        prevChatHistory.map((message) =>
          message.id === focusedMessageId && message.role === 'user'
            ? {
                ...message,
                mentionables: [
                  mentionable,
                  ...message.mentionables.filter(
                    (mentionable) => mentionable.type !== 'current-file',
                  ),
                ],
              }
            : message,
        ),
      )
    }
  }, [app.workspace, focusedMessageId, inputMessage.id])

  useEffect(() => {
    app.workspace.on('active-leaf-change', handleActiveLeafChange)
    return () => {
      app.workspace.off('active-leaf-change', handleActiveLeafChange)
    }
  }, [app.workspace, handleActiveLeafChange])

  return {
    // State
    inputMessage,
    setInputMessage,
    addedBlockKey,
    setAddedBlockKey,
    chatMessages,
    setChatMessages,
    focusedMessageId,
    setFocusedMessageId,
    currentConversationId,
    setCurrentConversationId,
    queryProgress,
    setQueryProgress,

    // Refs
    preventAutoScrollRef,
    lastProgrammaticScrollRef,
    activeStreamAbortControllersRef,
    chatUserInputRefs,
    chatMessagesRef,

    // Methods
    registerChatUserInputRef,
    handleScrollToBottom,
    abortActiveStreams,
    handleNewChat,
    addSelectionToChat,
    focusMessage,
  }
} 