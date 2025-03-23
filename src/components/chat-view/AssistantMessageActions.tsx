import * as Tooltip from '@radix-ui/react-tooltip'
import { Check, CopyIcon, PlusCircle, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Notice, TFile, TFolder, normalizePath } from 'obsidian'

import { ChatAssistantMessage } from '../../types/chat'
import { calculateLLMCost } from '../../utils/price-calculator'
import { useApp } from '../../contexts/app-context'
import { useSettings } from '../../contexts/settings-context'
import { getNewDocumentFolderPath } from '../../utils/obsidian'
import { FolderSelectionModal } from '../modals/FolderSelectionModal'

import LLMResponseInfoPopover from './LLMResponseInfoPopover'

function CopyButton({ message }: { message: ChatAssistantMessage }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button>
            {copied ? (
              <Check
                size={12}
                className="smtcmp-assistant-message-actions-icon--copied"
              />
            ) : (
              <CopyIcon onClick={handleCopy} size={12} />
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="smtcmp-tooltip-content">
            Copy message
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

function ApplyAllButton({ 
  message, 
  onApply 
}: { 
  message: ChatAssistantMessage
  onApply: (content: string) => void
}) {
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApply(message.content)
    } finally {
      setTimeout(() => {
        setApplying(false)
      }, 1500)
    }
  }

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button onClick={applying ? undefined : handleApply} disabled={applying}>
            {applying ? (
              <Check
                size={12}
                className="smtcmp-assistant-message-actions-icon--copied"
              />
            ) : (
              <Wand2 size={12} />
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="smtcmp-tooltip-content">
            {applying ? "Applying..." : "Apply entire response"}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

function CreateDocumentButton({ message, conversationId }: { message: ChatAssistantMessage, conversationId: string }) {
  const [creating, setCreating] = useState(false)
  const app = useApp()
  const { settings } = useSettings()

  const handleCreateDocument = async () => {
    setCreating(true)
    try {
      // Generate a filename based on current timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const suggestedFilename = `assistant-response-${timestamp}.md`
      
      // Get the default folder path from settings or active file
      const defaultFolderPath = getNewDocumentFolderPath(app, settings.newDocumentFolderPath)
      
      // Open folder selection modal
      const folderSelectionModal = new FolderSelectionModal(
        app,
        defaultFolderPath.endsWith('/') ? defaultFolderPath.slice(0, -1) : defaultFolderPath,
        () => {} // Will be overridden by openAndGetFolder
      )
      
      try {
        // Wait for user to select a folder
        const selectedFolder = await folderSelectionModal.openAndGetFolder()
        
        // Get the selected folder path
        const folderPath = selectedFolder.path === '' 
          ? '' // Root folder
          : `${selectedFolder.path}/`
        
        // Create full path
        const fullPath = normalizePath(`${folderPath}${suggestedFilename}`)
        
        // Check if file already exists
        const existingFile = app.vault.getAbstractFileByPath(fullPath)
        if (existingFile instanceof TFile) {
          new Notice(`File already exists: ${fullPath}`)
          return
        }
        
        // Get the content
        let content = message.content
        
        // Parse topic tags if they exist
        let tags: string[] = []
        const topicsMatch = content.match(/Topics:\s*(.*?)(?:\n|$)/i)
        if (topicsMatch && topicsMatch[1]) {
          // Extract tags from the Topics line
          tags = topicsMatch[1].split(',').map(tag => tag.trim())
          
          // Remove the Topics line from the content
          content = content.replace(/Topics:\s*(.*?)(?:\n|$)/i, '')
        }
        
        // Use the conversation ID passed as a prop
        // No need to try to retrieve it from the chat view
        
        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0]
        
        // Add YAML frontmatter metadata
        const processedContent = `---
tags: [${tags.join(', ')}]
chatId: ${conversationId}
created: ${currentDate}
lastUpdated: ${currentDate}
---

${content.trim()}
`
        
        // Create the file
        await app.vault.create(fullPath, processedContent)
        
        // Open the new file
        const newFile = app.vault.getAbstractFileByPath(fullPath)
        if (newFile instanceof TFile) {
          await app.workspace.getLeaf().openFile(newFile)
          new Notice(`Created and opened: ${fullPath}`)
        }
      } catch (err) {
        // User cancelled the folder selection or other error
        if (err instanceof Error) {
          console.error('Error in folder selection:', err)
        }
      }
    } catch (err) {
      console.error('Failed to create document: ', err)
      new Notice(`Error creating document: ${err.message}`)
    } finally {
      setTimeout(() => {
        setCreating(false)
      }, 1500)
    }
  }

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button onClick={creating ? undefined : handleCreateDocument} disabled={creating}>
            {creating ? (
              <Check
                size={12}
                className="smtcmp-assistant-message-actions-icon--copied"
              />
            ) : (
              <PlusCircle size={12} />
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="smtcmp-tooltip-content">
            {creating ? "Creating..." : "Create document from response"}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

function LLMResponesInfoButton({ message }: { message: ChatAssistantMessage }) {
  const cost = useMemo<number | null>(() => {
    if (!message.metadata?.model || !message.metadata?.usage) {
      return 0
    }
    return calculateLLMCost({
      model: message.metadata.model,
      usage: message.metadata.usage,
    })
  }, [message])

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div>
            <LLMResponseInfoPopover
              usage={message.metadata?.usage}
              estimatedPrice={cost}
              model={message.metadata?.model?.model}
            />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="smtcmp-tooltip-content">
            View details
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export default function AssistantMessageActions({
  message,
  onApply,
  conversationId,
}: {
  message: ChatAssistantMessage
  onApply?: (content: string) => void
  conversationId: string
}) {
  return (
    <div className="smtcmp-assistant-message-actions">
      <LLMResponesInfoButton message={message} />
      <CopyButton message={message} />
      {onApply && <ApplyAllButton message={message} onApply={onApply} />}
      <CreateDocumentButton message={message} conversationId={conversationId} />
    </div>
  )
}
