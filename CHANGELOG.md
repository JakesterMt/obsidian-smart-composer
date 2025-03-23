# Changelog

## Unreleased

### Added
- Added "Import Chat" functionality:
  - Added a new button in the chat header to import saved conversations
  - Allows importing chats from markdown files in the configured save folder
  - Preserves chat history and references to documents
  - Maintains the original chat ID for continuity
- Added "Create Document" button feature:
  - Added a new button next to Copy and Apply in code blocks
  - Added a new button in assistant message actions
  - Creates a new file in the same folder as the active file
  - Automatically determines file extension based on code language
  - Opens the newly created document automatically
  - Added setting to specify a default folder for new documents
  - Added interactive folder selection when creating documents
- Added automatic metadata generation for new documents:
  - Parses topic tags from AI responses and converts them to YAML frontmatter
  - Automatically adds chatId, creation date, and last updated date
  - Preserves existing metadata when applying changes to files
  - Appends new tags or chat IDs to existing ones
  - Uses the actual conversation ID from the current chat
  - Now also handles tags when applying changes to existing files
- Added Perplexity API support with the following models:
  - sonar-deep-research (128k context)
  - sonar-reasoning-pro (128k context)
  - sonar-reasoning (128k context)
  - sonar-pro (200k context)
  - sonar (128k context)
  - r1-1776 (128k context)
- Added migration to version 5 of the settings schema to include Perplexity models
- Added proper citation support for Perplexity responses with direct URL handling
- Added feature to save chat conversations to markdown files:
  - New setting to specify the folder path for saved conversations
  - Save button in the chat UI to export the current conversation
  - Saved conversations include references to all documents mentioned during the chat
  - Chat titles generated from first user message
  - Obsidian properties metadata for better organization and linking
  - Preservation of document references for seamless context access
  - Unique chatId in metadata for future integration with other features
  - Human-readable document references with proper Obsidian links
  - Clean, JSON-free formatting for maximum readability

### Changed
- Enhanced AI prompting to better detect document creation requests
  - Improved system prompts to identify when users ask to create new documents
  - AI now consistently formats code in "creatable" blocks when users ask for new files
  - Ensures the "Create Document" button is available for code that should be saved as a new file
  - Simplified AI instructions to only include topic tags instead of full metadata
  - Moved metadata generation to the client-side for more consistent formatting
  - Now requires topic tags for both new documents and edits to existing files
- Improved document creation workflow:
  - Added folder selection modal for choosing where to save new documents
  - Uses the default folder path as the initial selection
  - Allows navigating the entire vault folder structure
  - Preserves the selected folder for future document creations in the same session
- Improved code organization and reduced complexity:
  - Removed duplicate "Save Conversation Folder" setting from Etc section to avoid confusion
  - Updated description of "Save conversation folder path" in Chat section to clarify it's used for both saving and importing
  - Removed complex chat ID retrieval logic in favor of direct prop passing
  - Cleaned up unused imports and variables
  - Simplified component interactions for better maintainability
  - Added utility function for determining appropriate document folder paths
- Updated settings schema version from 4 to 5
- Improved text streaming handling for Perplexity API to fix formatting and spacing issues
- Updated citation handling to match Perplexity's actual API response format
- Enhanced citation processing to deduplicate repeated source URLs
- Updated Perplexity model pricing to match the latest API pricing information
- Simplified saved conversation filenames to include only the title (no date)
- Improved document reference handling in saved conversations with proper wikilinks
- Renamed "linkedDocuments" property to "links" in saved conversation metadata
- Enhanced the formatting of references in saved conversations for better readability
- Improved saved conversations by hiding technical metadata
- Removed HTML tags and JSON data from saved conversations for cleaner output
- Optimized links format in metadata for better Obsidian integration
- Enhanced saved conversations format:
  - Added proper [[]] syntax to document links in YAML metadata for clickable references
  - Removed redundant "Referenced Documents" section as this information is now in the metadata
  - Fixed formatting of links in YAML metadata by removing unnecessary quotation marks
  - Removed individual "References" sections from user messages to avoid duplication
  - Fixed issue with triple brackets in metadata by using plain text format for document paths
  - Fixed issue with links not appearing in Obsidian properties by using proper YAML format

### Fixed
- Fixed chat ID retrieval in document creation to properly link documents to their originating chat
- Fixed chat ID consistency to ensure all documents from the same chat share the same ID
- Fixed chat ID format to use the raw ID without any prefix
- Improved chat ID handling by directly passing it from the Chat component to document creation functions
- Fixed Perplexity provider implementation to properly implement required BaseLLMProvider methods (generateResponse, streamResponse, getEmbedding)
- Fixed "providerClient.streamResponse is not a function" error in Perplexity provider
- Fixed Perplexity API message order validation error by ensuring messages follow the required pattern (system messages first, alternating user and assistant messages, ending with a user message)
- Fixed formatting and spelling issues in Perplexity responses by improving the streaming text handling
- Fixed citation handling to properly process Perplexity's URL string format
- Fixed "undefined" sources issue by correctly matching Perplexity's citation format
- Fixed duplicate citations in streaming responses by tracking unique source URLs
- Fixed price calculator to display estimated costs for Perplexity models
- Fixed issue with user messages displaying as "[object Object]" when saving conversations
- Fixed title generation with reliable extraction from first user message
- Enhanced error handling during conversation save process
- Fixed issue with file context not being preserved in saved conversations
- Fixed filename collisions by adding incremental numbers to filenames when necessary
- Fixed critical issue where the API couldn't access current document context in saved conversations
- Fixed formatting of links in saved conversation metadata to ensure compatibility with Obsidian's reference system
- Fixed visible HTML tags and JSON data in saved conversations

### Planned Restructuring
- Codebase optimization for better performance:
  - Refactor Chat.tsx to reduce complexity and improve maintainability
  - Implement component lazy loading for better initial load performance
  - Optimize state management to reduce unnecessary re-renders
- Cross-platform enhancements:
  - Improve mobile UI/UX with responsive design patterns
  - Implement touch-friendly controls for all interactive elements
  - Optimize layout for different screen sizes
- Preparation for agentic functions:
  - Create a dedicated agent module with standardized interfaces
  - Implement function calling capability in LLM provider integrations
  - Add tools framework for extensible agent capabilities
- Voice communication foundation:
  - Add audio recording and playback components
  - Implement speech-to-text integration for voice input
  - Prepare text-to-speech integration for assistant responses
  - Ensure mobile-friendly voice interaction

### Removed
- None 

## [Unreleased] - Code Refactoring

- **Major refactoring of Chat component**: Extracted core functionality into custom hooks for better maintainability and code organization
  - Added `useChatState` hook for managing chat state (messages, IDs, query progress, refs)
  - Added `useChatSubmission` hook for handling chat submissions and streaming responses
  - Added `useChatApply` hook for applying chat content to editors and documents
  - Created adapter functions to maintain compatibility with existing components
  - Added comprehensive documentation for hooks with examples
  - Created a centralized hooks index export for simplified imports
  - Improved error handling throughout the codebase
  - Enhanced type safety with better interfaces and helper functions
  - Fixed several potential bugs related to missing dependencies and unused code 