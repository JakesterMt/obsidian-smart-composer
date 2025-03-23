import { PROVIDER_TYPES_INFO } from '../../../constants'
import { ChatModel } from '../../../types/chat-model.types'
import { LLMProvider } from '../../../types/provider.types'
import { SettingMigration } from '../setting.types'

export const migrateFrom4To5: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 5

  // Add Perplexity provider if it doesn't exist
  if ('providers' in newData && Array.isArray(newData.providers)) {
    const existingProvidersMap = new Map(
      newData.providers.map((provider) => [provider.id, provider])
    )

    const perplexityProviderId = PROVIDER_TYPES_INFO.perplexity.defaultProviderId
    if (perplexityProviderId && !existingProvidersMap.has(perplexityProviderId)) {
      (newData.providers as LLMProvider[]).push({
        type: 'perplexity',
        id: perplexityProviderId,
      } as LLMProvider)
    }
  }

  // Add Perplexity models
  if ('chatModels' in newData && Array.isArray(newData.chatModels)) {
    const existingModelsMap = new Map(
      newData.chatModels.map((model) => [model.id, model])
    )

    const perplexityModels = [
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'sonar-deep-research',
        model: 'sonar-deep-research',
      },
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'sonar-reasoning-pro',
        model: 'sonar-reasoning-pro',
      },
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'sonar-reasoning',
        model: 'sonar-reasoning',
      },
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'sonar-pro',
        model: 'sonar-pro',
      },
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'sonar',
        model: 'sonar',
      },
      {
        providerType: 'perplexity' as const,
        providerId: PROVIDER_TYPES_INFO.perplexity.defaultProviderId,
        id: 'r1-1776',
        model: 'r1-1776',
      },
    ]

    for (const newModel of perplexityModels) {
      // override existing model with same id
      const existingModel = existingModelsMap.get(newModel.id)
      if (existingModel) {
        // keep the existing model settings
        Object.assign(existingModel, newModel)
        // Remove the existing model from the array
        newData.chatModels = (newData.chatModels as ChatModel[]).filter(
          (model: ChatModel) => model.id !== newModel.id
        )
      }
      // Add the new model to the array
      (newData.chatModels as ChatModel[]).push(newModel as ChatModel)
    }
  }

  return newData
} 