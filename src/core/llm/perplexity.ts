import { PERPLEXITY_PRICES } from '../../constants'
import { ChatModel } from '../../types/chat-model.types'
import {
  LLMOptions,
  LLMRequestNonStreaming,
  LLMRequestStreaming,
  RequestMessage,
} from '../../types/llm/request'
import {
  LLMResponseNonStreaming,
  LLMResponseStreaming,
} from '../../types/llm/response'
import { LLMProvider } from '../../types/provider.types'
import { BaseLLMProvider } from './base'
import {
  LLMAPIKeyInvalidException,
  LLMAPIKeyNotSetException,
} from './exception'

// Types for Perplexity API (based on OpenAI API)
interface PerplexityMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; [key: string]: any }>
}

interface PerplexityRequest {
  model: string
  messages: PerplexityMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  return_citations?: boolean
  search_domain_filter?: string[]
  search_recency_filter?: string
  [key: string]: any
}

interface PerplexityCitation {
  text?: string
  url?: string
  title?: string
  metadata?: {
    published_date?: string
    [key: string]: any
  }
}

// Add a type definition for the citations array that could be either strings or citation objects
type PerplexityCitations = Array<string | PerplexityCitation>;

interface PerplexityResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string | null
    index: number
  }>
  citations?: PerplexityCitations
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface PerplexityStreamResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
    index: number
  }>
  citations?: PerplexityCitations
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class PerplexityProvider extends BaseLLMProvider<LLMProvider> {
  private readonly baseUrl = 'https://api.perplexity.ai'
  private readonly apiKey: string
  private accumulatedCitations: PerplexityCitations = []
  private uniqueCitationSet: Set<string> = new Set()
  
  constructor(provider: LLMProvider) {
    super(provider)
    if (provider.type !== 'perplexity') {
      throw new Error('Invalid provider type')
    }

    if (!provider.apiKey) {
      throw new Error('API key is required for Perplexity provider')
    }

    this.apiKey = provider.apiKey
  }

  /**
   * Ensures messages follow Perplexity's requirements:
   * 1. System messages (if any) must come first
   * 2. User and assistant messages must alternate
   * 3. The last message must be from the user
   */
  static validateAndFixMessages(messages: RequestMessage[]): RequestMessage[] {
    if (messages.length === 0) {
      return [{ role: 'user', content: 'Hello' }]
    }

    const fixedMessages: RequestMessage[] = []
    
    // Extract system messages
    const systemMessages = messages.filter(m => m.role === 'system')
    fixedMessages.push(...systemMessages)
    
    // Get non-system messages
    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    
    if (nonSystemMessages.length === 0) {
      // If we only had system messages, add a user message
      fixedMessages.push({ role: 'user', content: 'Hello' })
      return fixedMessages
    }
    
    // Start with a user message if we don't have one
    let expectedRole: 'user' | 'assistant' = 'user'
    
    // Process remaining messages, ensuring alternating pattern
    for (let i = 0; i < nonSystemMessages.length; i++) {
      const message = nonSystemMessages[i]
      
      if (message.role === expectedRole) {
        fixedMessages.push(message)
        expectedRole = expectedRole === 'user' ? 'assistant' : 'user'
      } else if (message.role === 'user' && expectedRole === 'assistant') {
        // Insert a placeholder assistant message if we have two user messages in a row
        fixedMessages.push({ 
          role: 'assistant', 
          content: 'I understand.' 
        })
        fixedMessages.push(message)
        expectedRole = 'assistant'
      } else if (message.role === 'assistant' && expectedRole === 'user') {
        // Skip this assistant message as we need a user message first
        continue
      }
    }
    
    // Ensure the last message is from the user
    if (fixedMessages.length > 0 && fixedMessages[fixedMessages.length - 1].role === 'assistant') {
      fixedMessages.push({ role: 'user', content: 'Please continue.' })
    }
    
    return fixedMessages
  }

  /**
   * Appends citations to content if available
   */
  static appendCitationsToContent(content: string, citations?: PerplexityCitations): string {
    if (!citations || citations.length === 0) {
      return content;
    }

    // Format the content with citations at the end
    let formattedContent = content.trim();
    
    // Add the Sources section
    formattedContent += '\n\n**Sources:**';
    
    // Create a Set to track unique citation URLs/texts to avoid duplicates
    const uniqueCitations: Set<string> = new Set();
    const processedCitations: Array<{url?: string, text?: string, title?: string}> = [];
    
    // First pass: collect unique citations
    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i];
      
      // If citation is a string (URL), use it directly
      if (typeof citation === 'string') {
        if (!uniqueCitations.has(citation)) {
          uniqueCitations.add(citation);
          processedCitations.push({ url: citation });
        }
      } 
      // If citation is an object, use its URL or text
      else if (citation && typeof citation === 'object') {
        const key = citation.url || citation.text || '';
        if (key && !uniqueCitations.has(key)) {
          uniqueCitations.add(key);
          processedCitations.push(citation);
        }
      }
    }
    
    // Second pass: format the deduplicated citations
    for (let i = 0; i < processedCitations.length; i++) {
      const citation = processedCitations[i];
      const citationNumber = i + 1;
      
      if (citation.url) {
        const title = citation.title || citation.text || citation.url;
        formattedContent += `\n[${citationNumber}] ${citation.url}`;
      } else if (citation.text) {
        formattedContent += `\n[${citationNumber}] ${citation.text}`;
      } else {
        formattedContent += `\n[${citationNumber}] Citation information unavailable`;
      }
    }
    
    return formattedContent;
  }

  async generateResponse(
    model: ChatModel,
    request: LLMRequestNonStreaming,
    options?: LLMOptions
  ): Promise<LLMResponseNonStreaming> {
    if (model.providerType !== 'perplexity') {
      throw new Error('Model is not a Perplexity model')
    }

    if (!this.apiKey) {
      throw new LLMAPIKeyNotSetException(
        `Provider ${this.provider.id} API key is missing. Please set it in settings menu.`
      )
    }

    try {
      // Validate and fix message order
      const validatedMessages = PerplexityProvider.validateAndFixMessages(request.messages)
      
      const perplexityRequest: PerplexityRequest = {
        model: request.model,
        messages: validatedMessages.map(m => PerplexityProvider.parseRequestMessage(m)),
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stream: false
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(perplexityRequest),
        signal: options?.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 401) {
          throw new LLMAPIKeyInvalidException(
            `Provider ${this.provider.id} API key is invalid. Please update it in settings menu.`
          )
        }
        throw new Error(`Perplexity API error: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as PerplexityResponse
      return PerplexityProvider.parseNonStreamingResponse(data)
    } catch (error) {
      if (error instanceof LLMAPIKeyInvalidException) {
        throw error
      }
      if (error instanceof LLMAPIKeyNotSetException) {
        throw error
      }
      throw error
    }
  }

  async streamResponse(
    model: ChatModel,
    request: LLMRequestStreaming,
    options?: LLMOptions
  ): Promise<AsyncIterable<LLMResponseStreaming>> {
    if (model.providerType !== 'perplexity') {
      throw new Error('Model is not a Perplexity model')
    }

    if (!this.apiKey) {
      throw new LLMAPIKeyNotSetException(
        `Provider ${this.provider.id} API key is missing. Please set it in settings menu.`
      )
    }

    // Reset accumulated citations for this streaming session
    this.accumulatedCitations = []
    this.uniqueCitationSet = new Set()

    // Validate and fix message order
    const validatedMessages = PerplexityProvider.validateAndFixMessages(request.messages)
    
    const perplexityRequest: PerplexityRequest = {
      model: request.model,
      messages: validatedMessages.map(m => PerplexityProvider.parseRequestMessage(m)),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: true
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(perplexityRequest),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 401) {
        throw new LLMAPIKeyInvalidException(
          `Provider ${this.provider.id} API key is invalid. Please update it in settings menu.`
        )
      }
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    const provider = this

    // eslint-disable-next-line no-inner-declarations
    async function* streamResponse(): AsyncIterable<LLMResponseStreaming> {
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // If there are accumulated citations, append them to the final chunk
          if (provider.accumulatedCitations.length > 0) {
            // Start with an empty content and only add the citations section
            const citationsContent = provider.accumulatedCitations.length > 0 
              ? PerplexityProvider.appendCitationsToContent('', provider.accumulatedCitations)
              : '';
            
            if (citationsContent) {
              yield {
                id: 'final',
                model: request.model,
                object: 'chat.completion.chunk',
                choices: [{
                  finish_reason: 'stop',
                  delta: {
                    content: citationsContent,
                  },
                }],
                created: Date.now() / 1000,
              };
            }
          }
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        const lines = buffer.split('\n')
        // Keep the last line which might be incomplete
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine === '' || trimmedLine === 'data: [DONE]') {
            continue
          }
          
          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.slice(6)
            if (jsonStr.trim() === '') {
              continue
            }
            
            try {
              const json = JSON.parse(jsonStr) as PerplexityStreamResponse
              
              // Collect citations if available
              if (json.citations && json.citations.length > 0) {
                // Only add new, unique citations
                for (const citation of json.citations) {
                  const citationKey = typeof citation === 'string' 
                    ? citation 
                    : (citation.url || citation.text || '');
                  
                  // Only add if we haven't seen this citation before
                  if (citationKey && !provider.uniqueCitationSet.has(citationKey)) {
                    provider.uniqueCitationSet.add(citationKey);
                    provider.accumulatedCitations.push(citation);
                  }
                }
              }
              
              yield PerplexityProvider.parseStreamingResponseChunk(json)
            } catch (e) {
              console.error('Error parsing JSON:', e)
            }
          }
        }
      }
    }

    return streamResponse()
  }

  async getEmbedding(_model: string, _text: string): Promise<number[]> {
    throw new Error(
      `Provider ${this.provider.id} does not support embeddings. Please use a different provider.`
    )
  }

  getTokenPrice(model: string): { input: number; output: number } {
    const price = PERPLEXITY_PRICES[model]
    if (!price) {
      // Default to sonar model if not found
      return PERPLEXITY_PRICES['sonar'] || { input: 1.0, output: 1.0 }
    }
    return price
  }

  static parseRequestMessage(message: RequestMessage): PerplexityMessage {
    switch (message.role) {
      case 'user': {
        const content = Array.isArray(message.content)
          ? message.content.map(part => {
              switch (part.type) {
                case 'text':
                  return { type: 'text', text: part.text }
                case 'image_url':
                  return { type: 'image_url', image_url: part.image_url }
              }
            })
          : message.content
        return { role: 'user', content }
      }
      case 'assistant': {
        if (Array.isArray(message.content)) {
          throw new Error('Assistant message should be a string')
        }
        return { role: 'assistant', content: message.content }
      }
      case 'system': {
        if (Array.isArray(message.content)) {
          throw new Error('System message should be a string')
        }
        return { role: 'system', content: message.content }
      }
    }
  }

  static parseNonStreamingResponse(
    response: PerplexityResponse
  ): LLMResponseNonStreaming {
    // Get content and add citations if available
    let content = response.choices[0]?.message.content || ''
    
    if (response.citations && response.citations.length > 0) {
      content = PerplexityProvider.appendCitationsToContent(content, response.citations)
    }
    
    return {
      id: response.id,
      choices: [
        {
          finish_reason: response.choices[0]?.finish_reason || 'stop',
          message: {
            content: content,
            role: response.choices[0]?.message.role || 'assistant',
          },
        }
      ],
      created: response.created,
      model: response.model,
      object: 'chat.completion',
      usage: response.usage,
    }
  }

  static parseStreamingResponseChunk(
    chunk: PerplexityStreamResponse
  ): LLMResponseStreaming {
    return {
      id: chunk.id,
      choices: chunk.choices.map((choice) => ({
        finish_reason: choice.finish_reason ?? null,
        delta: {
          content: choice.delta.content ?? null,
          role: choice.delta.role,
        },
      })),
      created: chunk.created,
      model: chunk.model,
      object: 'chat.completion.chunk',
      usage: chunk.usage,
    }
  }
} 