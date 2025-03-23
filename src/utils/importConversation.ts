import { App, TFile, parseYaml } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { ChatMessage } from '../types/chat'
import { deserializeMentionable } from './mentionable'

/**
 * Extracts chat ID from frontmatter
 */
function extractChatId(frontmatter: any): string | null {
  if (frontmatter && typeof frontmatter === 'object' && frontmatter.chatId) {
    return frontmatter.chatId
  }
  return null
}

/**
 * Parses a conversation markdown file into chat messages
 */
export async function parseConversationFile(app: App, file: TFile): Promise<{ messages: ChatMessage[], chatId: string }> {
  // Read the file content
  const content = await app.vault.read(file)
  
  // Extract frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const frontmatterMatch = content.match(frontmatterRegex)
  
  let chatId = uuidv4() // Default to new ID if none found
  let frontmatter = null
  
  if (frontmatterMatch && frontmatterMatch[1]) {
    try {
      frontmatter = parseYaml(frontmatterMatch[1])
      const extractedId = extractChatId(frontmatter)
      if (extractedId) {
        chatId = extractedId
      }
    } catch (e) {
      console.error('Error parsing frontmatter', e)
    }
  }
  
  // Parse the conversation content
  const messages: ChatMessage[] = []
  
  // Remove frontmatter from content
  let conversationContent = content
  if (frontmatterMatch) {
    conversationContent = content.replace(frontmatterMatch[0], '').trim()
  }
  
  // Split by message headers
  const userSections = conversationContent.split(/^### User\s*$/m)
  
  // Skip the first section (before first "### User")
  for (let i = 1; i < userSections.length; i++) {
    const userSection = userSections[i].trim()
    
    // Split user and assistant parts
    const parts = userSection.split(/^### Assistant\s*$/m)
    
    if (parts.length >= 1) {
      // Process user message
      const userContent = parts[0].trim()
      
      // Extract references if any
      const referencesMatch = userContent.match(/References:\n([\s\S]*?)(\n\n|$)/)
      let userMessageContent = userContent
      let mentionables: any[] = []
      
      if (referencesMatch) {
        // Remove references section from content
        userMessageContent = userContent.replace(referencesMatch[0], '').trim()
        
        // Parse references
        const referenceLines = referencesMatch[1].split('\n')
        for (const line of referenceLines) {
          const linkMatch = line.match(/\[\[(.*?)\]\]/)
          if (linkMatch) {
            const filePath = linkMatch[1] + '.md'
            const file = app.vault.getAbstractFileByPath(filePath)
            
            if (file && file instanceof TFile) {
              // Check if it's a block reference
              const blockMatch = line.match(/\((\d+):(\d+)\)/)
              if (blockMatch) {
                // It's a block reference
                mentionables.push({
                  type: 'block',
                  file: {
                    path: filePath
                  },
                  startLine: parseInt(blockMatch[1]),
                  endLine: parseInt(blockMatch[2])
                })
              } else {
                // It's a file reference
                mentionables.push({
                  type: 'file',
                  file: {
                    path: filePath
                  }
                })
              }
            }
          }
        }
      }
      
      // Add user message
      messages.push({
        role: 'user',
        content: userMessageContent,
        promptContent: userMessageContent,
        id: uuidv4(),
        mentionables: mentionables.map(m => deserializeMentionable(m, app)).filter(m => m !== null)
      })
      
      // Process assistant message if it exists
      if (parts.length >= 2) {
        const assistantContent = parts[1].trim()
        messages.push({
          role: 'assistant',
          content: assistantContent,
          id: uuidv4()
        })
      }
    }
  }
  
  return { messages, chatId }
}

/**
 * Imports a conversation from a markdown file
 */
export async function importConversation(app: App, file: TFile): Promise<{ messages: ChatMessage[], chatId: string }> {
  return parseConversationFile(app, file)
} 