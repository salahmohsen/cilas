import { Icon } from '@/tipTap/components/ui/Icon'
import { Surface } from '@/tipTap/components/ui/Surface'
import { Toolbar } from '@/tipTap/components/ui/Toolbar'
import Tooltip from '@/tipTap/components/ui/Tooltip'

export type LinkPreviewPanelProps = {
  url: string
  onEdit: () => void
  onClear: () => void
}

export const LinkPreviewPanel = ({ onClear, onEdit, url }: LinkPreviewPanelProps) => {
  return (
    <Surface className="flex items-center gap-2 p-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all">
        {url}
      </a>
      <Toolbar.Divider />
      <Tooltip title="Edit link">
        <Toolbar.Button onClick={onEdit}>
          <Icon name="Pen" />
        </Toolbar.Button>
      </Tooltip>
      <Tooltip title="Remove link">
        <Toolbar.Button onClick={onClear}>
          <Icon name="Trash2" />
        </Toolbar.Button>
      </Tooltip>
    </Surface>
  )
}
