import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import type { Story } from '../../types';
import { AnalysisSection } from './AnalysisSection';

interface WorkflowAnalysisDisplayProps {
  story: Story;
  compact?: boolean; // For drawer vs full page
}

export function WorkflowAnalysisDisplay({
  story,
  compact = false
}: WorkflowAnalysisDisplayProps) {
  // Check if any analysis exists
  const hasAnyAnalysis =
    story.contextExploration ||
    story.baAnalysis ||
    story.designerAnalysis ||
    story.architectAnalysis;

  // Don't render if no analysis exists
  if (!hasAnyAnalysis) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-fg mb-4">
        Workflow Analysis
      </h2>

      <div className="space-y-3">
        <AnalysisSection
          title="Context Exploration"
          icon={MagnifyingGlassIcon}
          content={story.contextExploration}
          timestamp={story.contextExploredAt}
        />

        <AnalysisSection
          title="Business Analysis"
          icon={DocumentTextIcon}
          content={story.baAnalysis}
          timestamp={story.baAnalyzedAt}
        />

        <AnalysisSection
          title="UI/UX Design"
          icon={PaintBrushIcon}
          content={story.designerAnalysis}
          timestamp={story.designerAnalyzedAt}
        />

        <AnalysisSection
          title="Architecture Design"
          icon={CubeIcon}
          content={story.architectAnalysis}
          timestamp={story.architectAnalyzedAt}
        />
      </div>
    </div>
  );
}
