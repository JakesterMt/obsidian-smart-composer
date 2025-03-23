import { App, normalizePath, TFile, TFolder } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { ChatMessage, ChatUserMessage } from '../types/chat'
import { MentionableBlock, Mentionable, SerializedMentionable } from '../types/mentionable'
import { getChatModelClient } from '../core/llm/manager'
import { editorStateToPlainText } from '../components/chat-view/chat-input/utils/editor-state-to-plain-text'
import { serializeMentionable } from '../utils/mentionable'

/**
 * Formats a date to YYYY-MM-DD format
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Formats a date to HH-MM-SS format
 */
function formatTime(date: Date): string {
  return date
    .toISOString()
    .split('T')[1]
    .split('.')[0]
    .replace(/:/g, '-')
}

/**
 * Extracts all unique document references from chat messages
 */
function extractDocumentReferences(chatMessages: ChatMessage[]): string[] {
  const references = new Set<string>()
  
  for (const message of chatMessages) {
    // Only user messages can have mentionables
    if (message.role === 'user') {
      const userMessage = message as ChatUserMessage;
      if (userMessage.mentionables) {
        for (const mentionable of userMessage.mentionables) {
          if (mentionable.type === 'block') {
            const block = mentionable as MentionableBlock
            if (block.file && block.file.path) {
              references.add(block.file.path)
            }
          } else if (mentionable.type === 'file' && mentionable.file) {
            references.add(mentionable.file.path)
          } else if (mentionable.type === 'current-file' && mentionable.file) {
            references.add(mentionable.file.path)
          }
        }
      }
    }
  }
  
  return Array.from(references)
}

/**
 * Serializes mentionables to a string format that can be preserved in the saved conversation
 */
function serializeMentionablesToString(mentionables?: Mentionable[]): string {
  if (!mentionables || mentionables.length === 0) {
    return '';
  }
  
  try {
    const serialized = mentionables.map(m => serializeMentionable(m));
    return JSON.stringify(serialized, null, 2);  // Pretty-print JSON for easier debugging
  } catch (e) {
    console.error('Error serializing mentionables', e);
    return '';
  }
}

/**
 * Gets the proper content from a user message
 * User messages might be stored as serialized editor state
 */
function getUserMessageContent(message: ChatMessage): string {
  try {
    // Handle different content types
    if (typeof message.content === 'string') {
      // Try to parse as JSON if it looks like a serialized object
      if (message.content.startsWith('{') && message.content.includes('contents')) {
        try {
          const parsed = JSON.parse(message.content);
          // Try to use editorStateToPlainText if available
          return editorStateToPlainText(parsed);
        } catch (e) {
          // If parsing fails, return original string
          return message.content;
        }
      }
      // Otherwise just return the string content
      return message.content;
    } 
    // If content is already an object
    else if (typeof message.content === 'object' && message.content !== null) {
      // Try to use editorStateToPlainText if it's an editor state object
      try {
        return editorStateToPlainText(message.content);
      } catch (e) {
        // If that fails, try to access common properties
        const contentObj = message.content as any;
        if (typeof contentObj.text === 'string') return contentObj.text;
        if (typeof contentObj.content === 'string') return contentObj.content;
        
        // Last resort - stringify but warn
        console.warn('Could not extract text from user message, using stringified version', message);
        return JSON.stringify(contentObj);
      }
    }
  } catch (e) {
    console.error('Error extracting user message content', e);
  }
  
  // Ultimate fallback
  return typeof message.content === 'string' 
    ? message.content 
    : 'Unable to display message content';
}

/**
 * Generate a title for the conversation
 */
async function generateConversationTitle(chatMessages: ChatMessage[]): Promise<string> {
  try {
    // Use the fallback method to generate a title from the first user message
    return createFallbackTitle(chatMessages);
  } catch (error) {
    console.error('Failed to generate conversation title:', error)
    return 'Chat Conversation';
  }
}

/**
 * Create a title from the first user message
 */
function createFallbackTitle(chatMessages: ChatMessage[]): string {
  // Find the first user message
  const firstUserMessage = chatMessages.find(msg => msg.role === 'user');
  if (firstUserMessage) {
    const content = getUserMessageContent(firstUserMessage);
    // Use first line or first few words
    const firstLine = content.split('\n')[0].trim();
    if (firstLine) {
      // Truncate to reasonable length for a title
      const words = firstLine.split(' ');
      if (words.length > 8) {
        return words.slice(0, 8).join(' ') + '...';
      }
      return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }
  }
  
  // Default if no suitable user message found
  return 'Chat Conversation';
}

/**
 * Formats the chat messages into markdown content
 */
function formatConversationContent(title: string, chatMessages: ChatMessage[], documentReferences: string[], conversationId: string, createdDate: Date): string {
  // Format the properties section
  let content = '---\n'
  content += `title: "${title}"\n`
  content += `date: ${formatDate(createdDate)}\n`
  content += `chatId: "${conversationId}"\n`
  
  if (documentReferences.length > 0) {
    // Format links as an array in YAML
    content += 'links:\n'
    for (const reference of documentReferences) {
      // Clean up link format - remove .md extension
      const docName = reference.replace(/\.md$/, '');
      // Format as proper Obsidian link with [[]] syntax
      content += `  - "[[${docName}]]"\n`
    }
  }
  
  content += '---\n\n'
  
  // Add main content
  content += `# ${title}\n\n`
  
  // Remove the "Referenced Documents" section as it's redundant with the metadata
  // Just start with the conversation directly
  content += '## Conversation\n\n'
  
  for (const message of chatMessages) {
    if (message.role === 'user') {
      content += '### User\n\n'
      const userContent = getUserMessageContent(message)
      content += `${userContent}\n\n`
      
      // Remove references section entirely from the conversation
      // We already have this information in the metadata
    } else if (message.role === 'assistant') {
      content += '### Assistant\n\n'
      // Clean any smtcmp_block HTML tags from assistant responses
      let cleanedContent = message.content;
      cleanedContent = cleanedContent.replace(/<\/?smtcmp_block[^>]*>/g, '');
      content += `${cleanedContent}\n\n`
    }
  }
  
  return content
}

/**
 * Creates a folder if it doesn't exist
 */
async function ensureFolder(app: App, folderPath: string): Promise<TFolder> {
  const normalizedPath = normalizePath(folderPath)
  const folder = app.vault.getAbstractFileByPath(normalizedPath)
  
  if (folder && folder instanceof TFolder) {
    return folder
  }
  
  // Create folder path recursively
  const parts = normalizedPath.split('/')
  let currentPath = ''
  
  for (const part of parts) {
    if (!part) continue
    
    currentPath += part
    let currentFolder = app.vault.getAbstractFileByPath(currentPath)
    
    if (!currentFolder) {
      currentFolder = await app.vault.createFolder(currentPath)
    } else if (!(currentFolder instanceof TFolder)) {
      throw new Error(`Path ${currentPath} exists but is not a folder`)
    }
    
    currentPath += '/'
  }
  
  return app.vault.getAbstractFileByPath(normalizedPath) as TFolder
}

/**
 * Saves a conversation to a markdown file
 */
export async function saveConversation(
  app: App,
  chatMessages: ChatMessage[],
  conversationId: string,
  modelId: string,
  folderPath: string
): Promise<string> {
  try {
    // Ensure folder exists
    await ensureFolder(app, folderPath)
    
    // Generate a title for the conversation - make sure this completes before proceeding
    const title = await generateConversationTitle(chatMessages)
    
    // Extract document references
    const documentReferences = extractDocumentReferences(chatMessages)
    
    // Create timestamp
    const date = new Date()
    
    // Format content
    const content = formatConversationContent(title, chatMessages, documentReferences, conversationId, date)
    
    // Create filename using just the title without date
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Chat'
    
    // Make sure we handle filename collisions by appending a suffix if needed
    let filename = `${safeTitle}.md`
    let index = 1
    let fullPath = normalizePath(`${folderPath}/${filename}`)
    
    // Check if file already exists and append numbers if needed
    while (app.vault.getAbstractFileByPath(fullPath)) {
      filename = `${safeTitle} (${index}).md`
      fullPath = normalizePath(`${folderPath}/${filename}`)
      index++
    }
    
    // Create the file
    await app.vault.create(fullPath, content)
    
    return fullPath
  } catch (error) {
    console.error('Failed to save conversation:', error)
    throw error
  }
} 