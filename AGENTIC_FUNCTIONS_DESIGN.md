# Agentic Functions Design

This document outlines the design and implementation strategy for adding agentic functions to the Smart Composer plugin. Agentic functions will enable the AI assistant to perform specific actions within Obsidian, enhancing its capabilities beyond simple text generation.

## Overview

The agentic functions system will allow the AI model to:
1. Recognize when users request specific actions
2. Request permission to perform these actions
3. Execute the actions with appropriate access controls
4. Report results back to the user
5. Maintain a stateful interaction across multiple turns

## System Architecture

### Core Components

1. **Function Registry**
   - Central system for registering available functions
   - Manages function schemas, descriptions, and implementations
   - Handles versioning and deprecation of functions

2. **Function Caller**
   - Interfaces with LLM providers to request function calls
   - Translates between LLM formats and internal representation
   - Handles streaming and non-streaming response modes

3. **Function Executor**
   - Safely executes registered functions with proper permissions
   - Manages execution lifecycle and timeout handling
   - Provides standardized error handling and reporting

4. **Permission Manager**
   - Enforces user permissions for function execution
   - Presents confirmation dialogs for sensitive operations
   - Maintains user preference for function permissions

5. **State Manager**
   - Maintains context across function calls
   - Preserves execution state between chat turns
   - Handles serialization and deserialization of state

### Integration Points

1. **LLM Provider Integration**
   - Extend BaseLLMProvider with function calling capabilities
   - Add support for function schema declaration
   - Implement provider-specific function call handling

2. **Chat Component Integration**
   - Add UI elements for function execution state
   - Implement permission request dialogs
   - Display function execution results

3. **Obsidian API Integration**
   - Create safe wrappers around Obsidian API calls
   - Implement vault and file management functions
   - Add metadata and frontmatter manipulation capabilities

## Implementation Details

### Function Schema

Each function will be defined with a JSON schema:

```typescript
interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required: string[];
  };
  returns: {
    type: string;
    description: string;
  };
  permissions: FunctionPermission[];
}

enum FunctionPermission {
  READ_FILES = "read_files",
  WRITE_FILES = "write_files",
  DELETE_FILES = "delete_files",
  READ_SETTINGS = "read_settings",
  WRITE_SETTINGS = "write_settings",
  NETWORK_ACCESS = "network_access"
}
```

### Function Registration

Functions will be registered with the central registry:

```typescript
class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();
  
  registerFunction(func: FunctionDefinition, implementation: Function): void {
    // Register function with validation
  }
  
  getFunction(name: string): FunctionDefinition | undefined {
    // Retrieve function definition
  }
  
  getAllFunctions(): FunctionDefinition[] {
    // Get all registered functions
  }
  
  getFunctionImplementation(name: string): Function | undefined {
    // Get the implementation of a function
  }
}
```

### Function Calling Interface

The BaseLLMProvider will be extended:

```typescript
interface FunctionCallOptions extends LLMOptions {
  functions?: FunctionDefinition[];
  function_call?: "auto" | "none" | { name: string };
}

abstract class BaseLLMProvider<P extends LLMProvider> {
  // Existing methods...
  
  abstract generateResponseWithFunctions(
    model: ChatModel,
    request: LLMRequestNonStreaming,
    options?: FunctionCallOptions,
  ): Promise<LLMResponseWithFunctions>;
  
  abstract streamResponseWithFunctions(
    model: ChatModel,
    request: LLMRequestStreaming,
    options?: FunctionCallOptions,
  ): Promise<AsyncIterable<LLMResponseStreamingWithFunctions>>;
}
```

### Core Obsidian Functions

Initial set of functions to implement:

1. **File Management**
   - `createNewNote(path: string, content: string): Promise<string>`
   - `updateNote(path: string, content: string): Promise<boolean>`
   - `readNote(path: string): Promise<string>`
   - `searchNotes(query: string): Promise<string[]>`

2. **Metadata Management**
   - `getFrontmatter(path: string): Promise<Record<string, any>>`
   - `updateFrontmatter(path: string, data: Record<string, any>): Promise<boolean>`
   - `addTags(path: string, tags: string[]): Promise<boolean>`

3. **Vault Interaction**
   - `listFiles(directory: string): Promise<string[]>`
   - `getVaultInfo(): Promise<Record<string, any>>`
   - `getActiveFile(): Promise<string | null>`

4. **User Interface**
   - `showNotification(message: string, duration?: number): void`
   - `openFile(path: string): Promise<boolean>`
   - `navigateToHeading(path: string, heading: string): Promise<boolean>`

## User Experience

### Permission Flow

1. User asks AI to perform an action (e.g., "Create a new note with my meeting notes")
2. AI identifies this as a function call opportunity
3. AI requests permission to execute the function
4. User sees a permission dialog explaining the action
5. User approves or denies the action
6. AI executes the function if approved and reports results
7. Conversation continues with awareness of the action's outcome

### User Settings

Users will have control over function execution through settings:

- Enable/disable function calling entirely
- Set default permission levels for different function types
- View and manage previously granted permissions
- Set up function execution preferences (confirmation dialogs, auto-approval)

## Security Considerations

1. **Sandbox Execution**
   - Functions execute in a controlled environment
   - Limits on resource usage and execution time
   - Prevention of arbitrary code execution

2. **Permission Boundaries**
   - Granular permissions for different function types
   - Clear user visibility into requested permissions
   - Revocable permission grants

3. **Audit Logging**
   - Record of all function executions
   - Tracking of permission grants and usage
   - User-accessible logs for transparency

## Mobile Considerations

1. **Compact Permission UI**
   - Simplified permission dialogs for small screens
   - Touch-friendly confirmation controls
   - Clear visual feedback for function execution

2. **Resource Efficiency**
   - Lightweight function execution for mobile devices
   - Battery usage optimization for long-running functions
   - Offline-capable functions where possible

3. **Touch Interaction**
   - Swipe gestures for function approval/denial
   - Easy-to-tap function results and feedback
   - Mobile-friendly error recovery

## Implementation Phases

### Phase 1: Foundation
- Implement FunctionRegistry
- Extend BaseLLMProvider with function calling
- Add basic permission management
- Create core file operation functions

### Phase 2: Provider Integration
- Add function calling to major LLM providers:
  - OpenAI (function calling)
  - Anthropic (tool use)
  - Ollama (function calling)
  - Custom provider adapters

### Phase 3: UI Integration
- Implement permission request dialogs
- Add function execution status indicators
- Create result display components
- Implement settings UI for function control

### Phase 4: Advanced Functions
- Add complex multi-step functions
- Implement stateful function sequences
- Create function composition capabilities
- Add custom user function definitions

### Phase 5: Optimization
- Performance tuning for mobile
- Battery and resource usage optimization
- Improve error handling and recovery
- Add offline function capabilities 