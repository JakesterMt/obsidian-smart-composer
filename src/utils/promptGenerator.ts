import { App, TFile, htmlToMarkdown, requestUrl } from 'obsidian'

import { editorStateToPlainText } from '../components/chat-view/chat-input/utils/editor-state-to-plain-text'
import { QueryProgressState } from '../components/chat-view/QueryProgress'
import { RAGEngine } from '../core/rag/ragEngine'
import { SelectEmbedding } from '../database/schema'
import { SmartComposerSettings } from '../settings/schema/setting.types'
import { ChatMessage, ChatUserMessage } from '../types/chat'
import { ContentPart, RequestMessage } from '../types/llm/request'
import {
  MentionableBlock,
  MentionableFile,
  MentionableFolder,
  MentionableImage,
  MentionableUrl,
  MentionableVault,
} from '../types/mentionable'

import {
  getNestedFiles,
  readMultipleTFiles,
  readTFileContent,
} from './obsidian'
import { tokenCount } from './token'
import { YoutubeTranscript, isYoutubeUrl } from './youtube-transcript'

export class PromptGenerator {
  private getRagEngine: () => Promise<RAGEngine>
  private app: App
  private settings: SmartComposerSettings

  constructor(
    getRagEngine: () => Promise<RAGEngine>,
    app: App,
    settings: SmartComposerSettings,
  ) {
    this.getRagEngine = getRagEngine
    this.app = app
    this.settings = settings
  }

  public async generateRequestMessages({
    messages,
    useVaultSearch,
    onQueryProgressChange,
  }: {
    messages: ChatMessage[]
    useVaultSearch?: boolean
    onQueryProgressChange?: (queryProgress: QueryProgressState) => void
  }): Promise<{
    requestMessages: RequestMessage[]
    compiledMessages: ChatMessage[]
  }> {
    if (messages.length === 0) {
      throw new Error('No messages provided')
    }
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage.role !== 'user') {
      throw new Error('Last message is not a user message')
    }

    const { promptContent, shouldUseRAG, similaritySearchResults } =
      await this.compileUserMessagePrompt({
        message: lastUserMessage,
        useVaultSearch,
        onQueryProgressChange,
      })
    let compiledMessages = [
      ...messages.slice(0, -1),
      {
        ...lastUserMessage,
        promptContent,
        similaritySearchResults,
      },
    ]

    // Safeguard: ensure all user messages have parsed content
    compiledMessages = await Promise.all(
      compiledMessages.map(async (message) => {
        if (message.role === 'user' && !message.promptContent) {
          const { promptContent, similaritySearchResults } =
            await this.compileUserMessagePrompt({
              message,
            })
          return {
            ...message,
            promptContent,
            similaritySearchResults,
          }
        }
        return message
      }),
    )

    const systemMessage = this.getSystemMessage(shouldUseRAG)

    const customInstructionMessage = this.getCustomInstructionMessage()

    const currentFile = lastUserMessage.mentionables.find(
      (m) => m.type === 'current-file',
    )?.file
    const currentFileMessage = currentFile
      ? await this.getCurrentFileMessage(currentFile)
      : undefined

    const requestMessages: RequestMessage[] = [
      systemMessage,
      ...(customInstructionMessage ? [customInstructionMessage] : []),
      ...(currentFileMessage ? [currentFileMessage] : []),
      ...compiledMessages.slice(-20).map((message): RequestMessage => {
        if (message.role === 'user') {
          return {
            role: 'user',
            content: message.promptContent ?? '',
          }
        } else {
          return {
            role: 'assistant',
            content: message.content,
          }
        }
      }),
      ...(shouldUseRAG ? [this.getRagInstructionMessage()] : []),
    ]

    return {
      requestMessages,
      compiledMessages,
    }
  }

  private async compileUserMessagePrompt({
    message,
    useVaultSearch,
    onQueryProgressChange,
  }: {
    message: ChatUserMessage
    useVaultSearch?: boolean
    onQueryProgressChange?: (queryProgress: QueryProgressState) => void
  }): Promise<{
    promptContent: ChatUserMessage['promptContent']
    shouldUseRAG: boolean
    similaritySearchResults?: (Omit<SelectEmbedding, 'embedding'> & {
      similarity: number
    })[]
  }> {
    if (!message.content) {
      return {
        promptContent: '',
        shouldUseRAG: false,
      }
    }
    const query = editorStateToPlainText(message.content)
    let similaritySearchResults = undefined

    useVaultSearch =
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      useVaultSearch ||
      message.mentionables.some(
        (m): m is MentionableVault => m.type === 'vault',
      )

    onQueryProgressChange?.({
      type: 'reading-mentionables',
    })
    const files = message.mentionables
      .filter((m): m is MentionableFile => m.type === 'file')
      .map((m) => m.file)
    const folders = message.mentionables
      .filter((m): m is MentionableFolder => m.type === 'folder')
      .map((m) => m.folder)
    const nestedFiles = folders.flatMap((folder) =>
      getNestedFiles(folder, this.app.vault),
    )
    const allFiles = [...files, ...nestedFiles]
    const fileContents = await readMultipleTFiles(allFiles, this.app.vault)

    // Count tokens incrementally to avoid long processing times on large content sets
    const exceedsTokenThreshold = async () => {
      let accTokenCount = 0
      for (const content of fileContents) {
        const count = await tokenCount(content)
        accTokenCount += count
        if (accTokenCount > this.settings.ragOptions.thresholdTokens) {
          return true
        }
      }
      return false
    }
    const shouldUseRAG = useVaultSearch || (await exceedsTokenThreshold())

    let filePrompt: string
    if (shouldUseRAG) {
      similaritySearchResults = useVaultSearch
        ? await (
            await this.getRagEngine()
          ).processQuery({
            query,
            onQueryProgressChange: onQueryProgressChange,
          }) // TODO: Add similarity boosting for mentioned files or folders
        : await (
            await this.getRagEngine()
          ).processQuery({
            query,
            scope: {
              files: files.map((f) => f.path),
              folders: folders.map((f) => f.path),
            },
            onQueryProgressChange: onQueryProgressChange,
          })
      filePrompt = `## Potentially Relevant Snippets from the current vault
${similaritySearchResults
  .map(({ path, content, metadata }) => {
    const contentWithLineNumbers = this.addLineNumbersToContent({
      content,
      startLine: metadata.startLine,
    })
    return `\`\`\`${path}\n${contentWithLineNumbers}\n\`\`\`\n`
  })
  .join('')}\n`
    } else {
      filePrompt = allFiles
        .map((file, index) => {
          return `\`\`\`${file.path}\n${fileContents[index]}\n\`\`\`\n`
        })
        .join('')
    }

    const blocks = message.mentionables.filter(
      (m): m is MentionableBlock => m.type === 'block',
    )
    const blockPrompt = blocks
      .map(({ file, content }) => {
        return `\`\`\`${file.path}\n${content}\n\`\`\`\n`
      })
      .join('')

    const urls = message.mentionables.filter(
      (m): m is MentionableUrl => m.type === 'url',
    )

    const urlPrompt =
      urls.length > 0
        ? `## Potentially Relevant Websearch Results
${(
  await Promise.all(
    urls.map(
      async ({ url }) => `\`\`\`
Website URL: ${url}
Website Content:
${await this.getWebsiteContent(url)}
\`\`\``,
    ),
  )
).join('\n')}
`
        : ''

    const imageDataUrls = message.mentionables
      .filter((m): m is MentionableImage => m.type === 'image')
      .map(({ data }) => data)

    return {
      promptContent: [
        ...imageDataUrls.map(
          (data): ContentPart => ({
            type: 'image_url',
            image_url: {
              url: data,
            },
          }),
        ),
        {
          type: 'text',
          text: `${filePrompt}${blockPrompt}${urlPrompt}\n\n${query}\n\n`,
        },
      ],
      shouldUseRAG,
      similaritySearchResults: similaritySearchResults,
    }
  }

  private getSystemMessage(shouldUseRAG: boolean): RequestMessage {
    const systemPrompt = `You are an intelligent assistant to help answer any questions that the user has, particularly about editing and organizing markdown files in Obsidian.

1. Please keep your response as concise as possible. Avoid being verbose.

2. When the user is asking for edits to their markdown, please provide a simplified version of the markdown block emphasizing only the changes. Use comments to show where unchanged content has been skipped. Wrap the markdown block with <smtcmp_block> tags. Add filename and language attributes to the <smtcmp_block> tags. For example:
<smtcmp_block filename="path/to/file.md" language="markdown">
<!-- ... existing content ... -->
{{ edit_1 }}
<!-- ... existing content ... -->
{{ edit_2 }}
<!-- ... existing content ... -->

Topics: documentation, editing, changes
</smtcmp_block>
The user has full access to the file, so they prefer seeing only the changes in the markdown. Often this will mean that the start/end of the file will be skipped, but that's okay! Rewrite the entire file only if specifically requested. Always provide a brief explanation of the updates, except when the user specifically asks for just the content. Always include a "Topics:" line at the end of your edit with relevant tags for the content.

3. When the user asks you to create a new document or file, always wrap your response with <smtcmp_block> tags and include the appropriate language attribute. For example:
<smtcmp_block language="markdown">
# New Document
Content goes here

Topics: documentation, example, guide
</smtcmp_block>

Always include a "Topics:" line at the end of your document with relevant tags for the content. These will be used to categorize the document.

4. Do not lie or make up facts.

5. Respond in the same language as the user's message.

6. Format your response in markdown.

7. When writing out new markdown blocks, also wrap them with <smtcmp_block> tags. For example:
<smtcmp_block language="markdown">
{{ content }}
</smtcmp_block>

8. When providing markdown blocks for an existing file, add the filename and language attributes to the <smtcmp_block> tags. Restate the relevant section or heading, so the user knows which part of the file you are editing. For example:
<smtcmp_block filename="path/to/file.md" language="markdown">
## Section Title
...
{{ content }}
...
</smtcmp_block>`

    const systemPromptRAG = `You are an intelligent assistant to help answer any questions that the user has, particularly about editing and organizing markdown files in Obsidian. You will be given your conversation history with them and potentially relevant blocks of markdown content from the current vault.
      
1. Do not lie or make up facts.

2. Respond in the same language as the user's message.

3. Format your response in markdown.

4. When the user asks you to create a new document or file, always wrap your response with <smtcmp_block> tags and include the appropriate language attribute. For example:
<smtcmp_block language="markdown">
# New Document
Content goes here

Topics: documentation, example, guide
</smtcmp_block>

Always include a "Topics:" line at the end of your document with relevant tags for the content. These will be used to categorize the document.

5. When referencing markdown blocks in your answer, keep the following guidelines in mind:

  a. Never include line numbers in the output markdown.

  b. Wrap the markdown block with <smtcmp_block> tags. Include language attribute. For example:
  <smtcmp_block language="markdown">
  {{ content }}
  </smtcmp_block>

  c. When providing markdown blocks for an existing file, also include the filename attribute to the <smtcmp_block> tags. For example:
  <smtcmp_block filename="path/to/file.md" language="markdown">
  {{ content }}
  
  Topics: documentation, reference, example
  </smtcmp_block>

  d. When referencing a markdown block the user gives you, only add the startLine and endLine attributes to the <smtcmp_block> tags. Write related content outside of the <smtcmp_block> tags. The content inside the <smtcmp_block> tags will be ignored and replaced with the actual content of the markdown block. For example:
  <smtcmp_block filename="path/to/file.md" language="markdown" startLine="2" endLine="30"></smtcmp_block>`

    const documentModePrompt = `You are a dedicated writing assistant focused on helping the user create high-quality documents and notes in Obsidian. Your primary goal is to help develop and structure documents based on the user's input.

1. Focus on creating well-structured, comprehensive documents in response to the user's needs.

2. Based on the users request, format your response as a complete document or as an updated section of a document based on the users input, with proper headings, sections, and organization.

3. Create content that is both informative and engaging, with appropriate depth based on the topic.

4. Always wrap your document response with <smtcmp_block> tags and include the markdown language attribute. For example:
<smtcmp_block language="markdown">
# Document Title
## Section 1
Content for section 1...

## Section 2
Content for section 2...

Topics: documentation, writing, notes
</smtcmp_block>

5. Always include a "Topics:" line at the end of your document with relevant tags for content categorization.

6. Respond in the same language as the user's message.

7. Consider the conversation context to continuously improve and refine the document as the user provides more input.

8. Make use of Markdown formatting features to create visually structured and clear documents:
   - Use headings (# for main headings, ## for subheadings)
   - Use lists (bulleted and numbered) for organized information
   - Use tables when appropriate to present structured data
   - Use emphasis (bold, italic) for important points
   - Use code blocks for technical content when needed

9. Each time the user provides feedback or additional information, incorporate it into an improved version of the entire document.`

    const documentModeRAGPrompt = `You are a dedicated writing assistant focused on helping the user create high-quality documents and notes in Obsidian. Your primary goal is to help develop and structure documents based on the user's input. You will be given your conversation history with them and potentially relevant blocks of markdown content from the current vault.

1. Focus on creating well-structured, comprehensive documents in response to the user's needs.

2. Always format your entire response as a complete document, with proper headings, sections, and organization.

3. Create content that is both informative and engaging, with appropriate depth based on the topic.

4. Always wrap your document response with <smtcmp_block> tags and include the markdown language attribute. For example:
<smtcmp_block language="markdown">
# Document Title
## Section 1
Content for section 1...

## Section 2
Content for section 2...

Topics: documentation, writing, notes
</smtcmp_block>

5. Always include a "Topics:" line at the end of your document with relevant tags for content categorization.

6. Respond in the same language as the user's message.

7. Consider the conversation context and vault content to continuously improve and refine the document as the user provides more input.

8. Make use of Markdown formatting features to create visually structured and clear documents:
   - Use headings (# for main headings, ## for subheadings)
   - Use lists (bulleted and numbered) for organized information
   - Use tables when appropriate to present structured data
   - Use emphasis (bold, italic) for important points
   - Use code blocks for technical content when needed

9. Each time the user provides feedback or additional information, incorporate it into an improved version of the entire document.

10. When referencing blocks from the vault in your document:
    a. Never include line numbers in the output markdown.
    b. Integrate the content seamlessly into your document.
    c. Cite sources appropriately if referencing specific notes from the vault.`

    // Determine which system prompt to use based on document mode and RAG settings
    let finalPrompt = systemPrompt;
    if (this.settings.documentMode) {
      finalPrompt = shouldUseRAG ? documentModeRAGPrompt : documentModePrompt;
    } else {
      finalPrompt = shouldUseRAG ? systemPromptRAG : systemPrompt;
    }

    return {
      role: 'system',
      content: finalPrompt,
    }
  }

  private getCustomInstructionMessage(): RequestMessage | null {
    const customInstruction = this.settings.systemPrompt.trim()
    if (!customInstruction) {
      return null
    }
    return {
      role: 'user',
      content: `Here are additional instructions to follow in your responses when relevant. There's no need to explicitly acknowledge them:
<custom_instructions>
${customInstruction}
</custom_instructions>`,
    }
  }

  private async getCurrentFileMessage(
    currentFile: TFile,
  ): Promise<RequestMessage> {
    const fileContent = await readTFileContent(currentFile, this.app.vault)
    return {
      role: 'user',
      content: `# Inputs
## Current File
Here is the file I'm looking at.
\`\`\`${currentFile.path}
${fileContent}
\`\`\`\n\n`,
    }
  }

  private getRagInstructionMessage(): RequestMessage {
    return {
      role: 'user',
      content: `If you need to reference any of the markdown blocks I gave you, add the startLine and endLine attributes to the <smtcmp_block> tags without any content inside. For example:
<smtcmp_block filename="path/to/file.md" language="markdown" startLine="200" endLine="310"></smtcmp_block>

When writing out new markdown blocks, remember not to include "line_number|" at the beginning of each line.`,
    }
  }

  private addLineNumbersToContent({
    content,
    startLine,
  }: {
    content: string
    startLine: number
  }): string {
    const lines = content.split('\n')
    const linesWithNumbers = lines.map((line, index) => {
      return `${startLine + index}|${line}`
    })
    return linesWithNumbers.join('\n')
  }

  /**
   * TODO: Improve markdown conversion logic
   * - filter visually hidden elements
   * ...
   */
  private async getWebsiteContent(url: string): Promise<string> {
    if (isYoutubeUrl(url)) {
      try {
        // TODO: pass language based on user preferences
        const { title, transcript } =
          await YoutubeTranscript.fetchTranscriptAndMetadata(url)

        return `Title: ${title}
Video Transcript:
${transcript.map((t) => `${t.offset}: ${t.text}`).join('\n')}`
      } catch (error) {
        console.error('Error fetching YouTube transcript', error)
      }
    }

    const response = await requestUrl({ url })

    return htmlToMarkdown(response.text)
  }
}
