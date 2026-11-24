import { Layers } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AppShell } from './AppShell';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';

export interface ModulePlaceholderPageProps {
  title: string;
  subtitle: string;
  phaseLabel: string;
  description: string;
}

export function ModulePlaceholderPage({
  title,
  subtitle,
  phaseLabel,
  description,
}: ModulePlaceholderPageProps) {
  useDocumentTitle(title);

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
      actions={<StatusBadge label={phaseLabel} tone="gold" />}
    >
      <EmptyState
        title={`Modul ${title}`}
        description={description}
        icon={<Layers className="h-6 w-6" />}
      />
    </AppShell>
  );
}
