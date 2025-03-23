/**
 * Hooks index file
 * 
 * This file exports all our custom hooks for easy importing.
 * Instead of:
 *   import { useChatState } from '../hooks/useChatState'
 *   import { useChatSubmission } from '../hooks/useChatSubmission'
 * 
 * We can now do:
 *   import { useChatState, useChatSubmission } from '../hooks'
 */

export { useChatState, getNewInputMessage } from './useChatState'
export { useChatSubmission } from './useChatSubmission'
export { useChatApply } from './useChatApply'
export { useChatHistory } from './useChatHistory' 