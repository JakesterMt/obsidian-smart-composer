# Smart Composer Hooks

This directory contains custom React hooks that encapsulate specific aspects of the Smart Composer plugin functionality.

## Installation

All hooks are available through the index file for easy importing:

```typescript
import { 
  useChatState, 
  useChatSubmission, 
  useChatApply, 
  useChatHistory 
} from '../hooks'
```

## Hooks Overview

### `useChatState`

Manages the core chat state, including:
- Input message and chat message history
- Focused message tracking
- Query progress state
- Auto-scrolling behavior
- Stream abortion
- Chat user input references

**Example Usage:**

```typescript
const {
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
} = useChatState({ selectedBlock });
```

### `useChatSubmission`

Handles chat submission logic, including:
- Submitting user messages
- Streaming responses from AI
- Handling submission errors
- Updating user messages

**Example Usage:**

```typescript
const {
  handleSubmit,
  handleUserMessageUpdate,
} = useChatSubmission({
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
  focusMessage
});

// Then you can submit a new message
const handleUserInput = async (message) => {
  await handleSubmit(message);
};

// Or update an existing message
const handleEdit = (id, content, promptContent) => {
  handleUserMessageUpdate(id, content, promptContent);
};
```

### `useChatApply`

Manages applying chat messages to the editor:
- Applying entire messages
- Applying smart blocks
- Handling document mode applications
- Managing editor mutations

**Example Usage:**

```typescript
const {
  handleApplyEntireMessage,
  handleApplySmartBlock,
  handleApplyToDocument,
  submitMutation,
  applyMutation,
} = useChatApply({
  abortActiveStreams
});

// Apply an entire AI message to the editor
const applyMessage = (message) => {
  handleApplyEntireMessage(message);
};

// Apply a specific code block from a message
const applyCodeBlock = (message, blockIndex) => {
  handleApplySmartBlock(message, blockIndex);
};

// Apply text content directly to the document
const applyText = (content) => {
  handleApplyToDocument(content);
};
```

### `useChatHistory`

Handles chat history persistence:
- Creating and updating conversations
- Loading conversations
- Deleting conversations
- Updating conversation titles

**Example Usage:**

```typescript
const {
  createOrUpdateConversation,
  deleteConversation,
  getChatMessagesById,
  updateConversationTitle,
  chatList,
} = useChatHistory();

// Save the current conversation
await createOrUpdateConversation(conversationId, messages);

// Load a conversation
const messages = await getChatMessagesById(conversationId);

// Update a conversation title
await updateConversationTitle(conversationId, "New Title");

// Delete a conversation
await deleteConversation(conversationId);
```

## Adapter Pattern

The current implementation uses an adapter pattern to bridge between the new hooks and existing components:

```typescript
// Hook implementation (new pattern)
const { handleSubmit: hookHandleSubmit } = useChatSubmission({...});

// Adapter function for compatibility with existing components
const handleSubmit = useCallback((messages, useVaultSearch) => {
  setIsSubmitting(true);
  const userMessage = messages[messages.length - 1];
  hookHandleSubmit(userMessage)
    .finally(() => setIsSubmitting(false));
}, [hookHandleSubmit]);
```

This allows us to gradually refactor the codebase without breaking existing functionality.

## Refactoring Philosophy

The Smart Composer codebase is being incrementally refactored following these principles:

1. **Separation of Concerns**: Each hook has a specific responsibility
2. **Incremental Change**: Refactoring is done in stages to maintain stability
3. **Adapter Pattern**: We use adapter functions to bridge between new hooks and existing components
4. **Explicit Documentation**: Hooks and their interfaces are well-documented

## Future Improvements

Future work on the hooks system may include:

1. Updating components to work directly with our hooks (removing adapters)
2. Creating a context provider for chat state to eliminate prop drilling
3. Adding comprehensive tests for each hook
4. Implementing custom TypeScript type guards for better type safety

## Troubleshooting

If you encounter issues with the hooks:

1. **Check dependencies**: Make sure you're passing all required options
2. **Verify types**: Ensure you're using the correct types for parameters
3. **Inspect state**: Use React DevTools to inspect the state managed by hooks
4. **Review adapters**: If using adapter functions, ensure they correctly transform data 