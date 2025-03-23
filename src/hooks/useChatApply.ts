import { useCallback } from 'react'
import { Editor, Notice } from 'obsidian'
import { useApp } from '../contexts/app-context'
import { ChatAssistantMessage } from '../types/chat'
import { extractSmartBlocks } from '../utils/smartblock'

interface UseChatApplyOptions {
  abortActiveStreams: () => void
}

/**
 * Hook to handle chat application logic
 */
export function useChatApply({ abortActiveStreams }: UseChatApplyOptions) {
  const app = useApp()

  /**
   * Apply an entire message to the editor
   */
  const handleApplyEntireMessage = useCallback(
    (message: ChatAssistantMessage) => {
      const editor = app.workspace.activeEditor?.editor

      if (!editor) {
        new Notice('No active editor')
        return
      }

      // Extract the text content (without smtcmp_block tags)
      const content = message.content
      const processedContent = content.replace(
        /<smtcmp_block>([\s\S]*?)<\/smtcmp_block>/g,
        '$1',
      )

      submitMutation(editor, processedContent)
    },
    [app.workspace.activeEditor?.editor],
  )

  /**
   * Apply a smart block to the editor
   */
  const handleApplySmartBlock = useCallback(
    (message: ChatAssistantMessage, blockIndex: number) => {
      const editor = app.workspace.activeEditor?.editor

      if (!editor) {
        new Notice('No active editor')
        return
      }

      const content = message.content
      const smartBlocks = extractSmartBlocks(content)

      if (blockIndex >= smartBlocks.length) {
        new Notice(`Smart block at index ${blockIndex} not found`)
        return
      }

      const smartBlock = smartBlocks[blockIndex]
      submitMutation(editor, smartBlock)
    },
    [app.workspace.activeEditor?.editor],
  )

  /**
   * Apply a mutation to the editor
   */
  const submitMutation = useCallback(
    (editor: Editor, content: string) => {
      // Get editor selection
      const selection = editor.getSelection()

      // Abort any active streams
      abortActiveStreams()

      // Apply the mutation
      applyMutation(editor, selection, content)
    },
    [abortActiveStreams],
  )

  /**
   * Apply a mutation to the editor
   */
  const applyMutation = useCallback((
    editor: Editor,
    selection: string,
    content: string,
  ) => {
    // Get current selection
    const cursorFrom = editor.getCursor('from')
    const cursorTo = editor.getCursor('to')

    // Apply the mutation
    editor.transaction({
      changes: [
        {
          from: cursorFrom,
          to: cursorTo,
          text: content,
        },
      ],
    })

    // Place cursor at end of inserted content
    const endPosition = {
      line: 0,
      ch: 0,
    }

    const lines = content.split('\n')
    endPosition.line = cursorFrom.line + lines.length - 1
    if (lines.length === 1) {
      endPosition.ch = cursorFrom.ch + content.length
    } else {
      endPosition.ch = lines[lines.length - 1].length
    }

    editor.setCursor(endPosition)
  }, [])

  /**
   * Handle applying content to a document
   */
  const handleApplyToDocument = useCallback(
    (assistantContent: string) => {
      const editor = app.workspace.activeEditor?.editor
      if (!editor) {
        new Notice('No active editor to apply content to')
        return
      }

      // Create a temporary message to apply
      const tempMessage: ChatAssistantMessage = {
        role: 'assistant',
        id: 'temp-apply-message',
        content: assistantContent,
        metadata: {},
      }

      // Small delay to allow UI to update
      setTimeout(() => {
        handleApplyEntireMessage(tempMessage)
      }, 50)
    },
    [app.workspace.activeEditor?.editor, handleApplyEntireMessage],
  )

  return {
    handleApplyEntireMessage,
    handleApplySmartBlock,
    handleApplyToDocument,
    submitMutation,
    applyMutation,
  }
} 