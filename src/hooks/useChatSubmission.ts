import { useCallback } from 'react'
import { App, Notice } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../contexts/app-context'
import { useSettings } from '../contexts/settings-context'
import { api } from '../api'
import { ChatMessage, ChatUserMessage, ChatAssistantMessage } from '../types/chat'
import { QueryProgressState } from '../components/chat-view/QueryProgress'

interface UseChatSubmissionOptions {
  chatMessages: ChatMessage[]
  setChatMessages: (messages: ChatMessage[]) => void
  inputMessage: ChatUserMessage
  setInputMessage: (message: ChatUserMessage) => void
  queryProgress: QueryProgressState
  setQueryProgress: (state: QueryProgressState) => void
  activeStreamAbortControllersRef: React.MutableRefObject<AbortController[]>
  preventAutoScrollRef: React.MutableRefObject<boolean>
  handleScrollToBottom: () => void
  currentConversationId: string
  focusMessage: () => void
}

/**
 * Hook to handle chat submission logic
 */
export function useChatSubmission({
  chatMessages,
  setChatMessages,
  inputMessage,
  setInputMessage,
  queryProgress,
  setQueryProgress,
  activeStreamAbortControllersRef,
  preventAutoScrollRef,
  handleScrollToBottom,
  currentConversationId,
  focusMessage,
}: UseChatSubmissionOptions) {
  const app = useApp()
  const { settings } = useSettings()

  /**
   * Handle user message submission
   */
  const handleSubmit = useCallback(
    async (message: ChatUserMessage) => {
      if (queryProgress.type !== 'idle') {
        new Notice('Please wait for the current message to complete')
        return
      }

      if (!message.content?.trim()) {
        new Notice('Please enter a message')
        return
      }

      const promptContent = message.promptContent?.trim() || null

      const userMessage: ChatUserMessage = {
        ...message,
        content: message.content.trim(),
        promptContent,
      }

      // Create a new message for input
      const newInputMessage = {
        ...inputMessage,
        content: null,
        promptContent: null,
        id: uuidv4(),
      }

      setChatMessages((prev) => [...prev, userMessage])
      setInputMessage(newInputMessage)

      // Create stream response
      const abortController = new AbortController()
      activeStreamAbortControllersRef.current.push(abortController)

      setQueryProgress({
        type: 'generating',
        detail: 'Starting...',
      })

      try {
        const shouldStream = settings.enableStreaming !== false

        if (shouldStream) {
          // Stream response
          const chunks: string[] = []
          let assistantContent = ''

          await api.generateChatCompletion(
            app,
            [...chatMessages, userMessage],
            settings,
            {
              signal: abortController.signal,
              stream: true,
              onUpdate: (content) => {
                assistantContent = content
                // Add the assistant message if it doesn't exist yet
                setChatMessages((prev) => {
                  const lastMessage = prev[prev.length - 1]
                  if (
                    lastMessage?.role === 'assistant' &&
                    lastMessage.id.startsWith('stream-')
                  ) {
                    return prev.map((message, index) => {
                      if (index === prev.length - 1) {
                        return {
                          ...message,
                          content,
                        }
                      }
                      return message
                    })
                  } else {
                    return [
                      ...prev,
                      {
                        role: 'assistant',
                        id: `stream-${Date.now()}`,
                        content,
                      },
                    ]
                  }
                })

                if (!preventAutoScrollRef.current) {
                  setTimeout(() => {
                    handleScrollToBottom()
                  }, 10)
                }
              },
              onProgress: (detail) => {
                setQueryProgress({
                  type: 'generating',
                  detail,
                })
              },
            },
          )

          // Add final message
          setChatMessages((prev) => {
            const lastMessage = prev[prev.length - 1]
            if (
              lastMessage?.role === 'assistant' &&
              lastMessage.id.startsWith('stream-')
            ) {
              return prev.map((message, index) => {
                if (index === prev.length - 1) {
                  return {
                    ...message,
                    id: uuidv4(),
                    content: assistantContent,
                    metadata: {
                      conversationId: currentConversationId,
                    },
                  }
                }
                return message
              })
            } else {
              return [
                ...prev,
                {
                  role: 'assistant',
                  id: uuidv4(),
                  content: assistantContent,
                  metadata: {
                    conversationId: currentConversationId,
                  },
                },
              ]
            }
          })
        } else {
          // No streaming
          const content = await api.generateChatCompletion(
            app,
            [...chatMessages, userMessage],
            settings,
            {
              signal: abortController.signal,
              onProgress: (detail) => {
                setQueryProgress({
                  type: 'generating',
                  detail,
                })
              },
            },
          )

          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              id: uuidv4(),
              content,
              metadata: {
                conversationId: currentConversationId,
              },
            },
          ])
        }

        // Remove abort controller
        activeStreamAbortControllersRef.current = activeStreamAbortControllersRef.current.filter(
          (controller) => controller !== abortController,
        )

        if (!preventAutoScrollRef.current) {
          setTimeout(() => {
            handleScrollToBottom()
          }, 10)
        }

        // Once completed, focus the input
        setTimeout(() => {
          focusMessage()
        }, 50)
      } catch (error) {
        if (error.name === 'AbortError') {
          // User aborted
          setQueryProgress({
            type: 'idle',
          })
          
          // Remove the message if it was a stream
          setChatMessages((prev) => {
            const lastMessage = prev[prev.length - 1]
            if (
              lastMessage?.role === 'assistant' &&
              lastMessage.id.startsWith('stream-')
            ) {
              return prev.slice(0, -1)
            }
            return prev
          })
        } else {
          console.error('Error generating response:', error)
          new Notice(`Error: ${error.message}`)

          // Add error message
          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              id: uuidv4(),
              content: `Error: ${error.message}`,
              metadata: {
                conversationId: currentConversationId,
                error: true,
              },
            },
          ])
        }

        // Remove abort controller
        activeStreamAbortControllersRef.current = activeStreamAbortControllersRef.current.filter(
          (controller) => controller !== abortController,
        )
      } finally {
        setQueryProgress({
          type: 'idle',
        })
      }
    },
    [
      app,
      chatMessages,
      inputMessage,
      queryProgress.type,
      settings,
      activeStreamAbortControllersRef,
      handleScrollToBottom,
      preventAutoScrollRef,
      setChatMessages,
      setInputMessage,
      setQueryProgress,
      currentConversationId,
      focusMessage,
    ],
  )

  /**
   * Handle updating a user message
   */
  const handleUserMessageUpdate = useCallback(
    (id: string, content: string, promptContent: string | null) => {
      setChatMessages((prevChatMessages) =>
        prevChatMessages.map((message) => {
          if (message.id === id && message.role === 'user') {
            return {
              ...message,
              content,
              promptContent: promptContent?.trim() || null,
            }
          }
          return message
        }),
      )
    },
    [setChatMessages],
  )

  return {
    handleSubmit,
    handleUserMessageUpdate,
  }
} 