import { Check, CopyIcon, Loader2, PlusCircle } from 'lucide-react'
import { PropsWithChildren, useMemo, useState } from 'react'
import { Notice, TFile, TFolder, normalizePath } from 'obsidian'

import { useDarkModeContext } from '../../contexts/dark-mode-context'
import { useApp } from '../../contexts/app-context'
import { useSettings } from '../../contexts/settings-context'
import { getNewDocumentFolderPath } from '../../utils/obsidian'
import { FolderSelectionModal } from '../modals/FolderSelectionModal'

import { MemoizedSyntaxHighlighterWrapper } from './SyntaxHighlighterWrapper'

export default function MarkdownCodeComponent({
  onApply,
  isApplying,
  language,
  filename,
  children,
  conversationId,
}: PropsWithChildren<{
  onApply: (blockToApply: string) => void
  isApplying: boolean
  language?: string
  filename?: string
  conversationId: string
}>) {
  const [copied, setCopied] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { isDarkMode } = useDarkModeContext()
  const app = useApp()
  const { settings } = useSettings()

  const wrapLines = useMemo(() => {
    return !language || ['markdown'].includes(language)
  }, [language])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const handleCreateDocument = async () => {
    try {
      setIsCreating(true)
      
      // Determine appropriate file extension based on language
      let extension = '.md' // Default to markdown
      if (language) {
        switch (language.toLowerCase()) {
          case 'javascript':
          case 'js':
            extension = '.js'
            break
          case 'typescript':
          case 'ts':
            extension = '.ts'
            break
          case 'python':
          case 'py':
            extension = '.py'
            break
          case 'html':
            extension = '.html'
            break
          case 'css':
            extension = '.css'
            break
          case 'json':
            extension = '.json'
            break
          // Add more cases for other languages as needed
        }
      }

      // Use filename if provided, otherwise generate a name
      const suggestedFilename = filename || `new-file-${Date.now()}${extension}`
      
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
        let content = String(children)
        
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
        let processedContent = ''
        
        // Only add YAML frontmatter for markdown files
        if (extension === '.md') {
          processedContent = `---
tags: [${tags.join(', ')}]
chatId: ${conversationId}
created: ${currentDate}
lastUpdated: ${currentDate}
---

${content.trim()}
`
        } else {
          // For non-markdown files, we might want to add a comment with metadata
          // depending on the language
          processedContent = content.trim()
        }
        
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
      setIsCreating(false)
    }
  }

  return (
    <div className={`smtcmp-code-block ${filename ? 'has-filename' : ''}`}>
      <div className={'smtcmp-code-block-header'}>
        {filename && (
          <div className={'smtcmp-code-block-header-filename'}>{filename}</div>
        )}
        <div className={'smtcmp-code-block-header-button'}>
          <button
            onClick={() => {
              handleCopy()
            }}
          >
            {copied ? (
              <>
                <Check size={10} /> Copied
              </>
            ) : (
              <>
                <CopyIcon size={10} /> Copy
              </>
            )}
          </button>
          <button
            onClick={() => {
              onApply(String(children))
            }}
            disabled={isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="spinner" size={14} /> Applying...
              </>
            ) : (
              'Apply'
            )}
          </button>
          <button
            onClick={handleCreateDocument}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="spinner" size={14} /> Creating...
              </>
            ) : (
              <>
                <PlusCircle size={10} /> Create Document
              </>
            )}
          </button>
        </div>
      </div>
      <MemoizedSyntaxHighlighterWrapper
        isDarkMode={isDarkMode}
        language={language}
        hasFilename={!!filename}
        wrapLines={wrapLines}
      >
        {String(children)}
      </MemoizedSyntaxHighlighterWrapper>
    </div>
  )
}
