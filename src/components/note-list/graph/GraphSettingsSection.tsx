import type { ReactNode } from 'react'

/** One titled block of the graph settings panel, with an optional action at the right of its title. */
export function SettingsSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="m-0 text-xs font-medium text-muted-foreground">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  )
}
