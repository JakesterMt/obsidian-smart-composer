import { CornerDownLeftIcon } from 'lucide-react'
import { useSettings } from '../../../contexts/settings-context'

export function SubmitButton({ onClick }: { onClick: () => void }) {
  const { settings } = useSettings()
  
  return (
    <button className="smtcmp-chat-user-input-submit-button" onClick={onClick}>
      <div className="smtcmp-chat-user-input-submit-button-icons">
        <CornerDownLeftIcon size={12} />
      </div>
      <div>{settings.documentMode ? 'Create' : 'Chat'}</div>
    </button>
  )
}
