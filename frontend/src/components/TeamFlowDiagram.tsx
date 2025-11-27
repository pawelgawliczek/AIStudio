import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow } from '../types';

export interface TeamFlowDiagramProps {
  workflow: Workflow;
}

/**
 * TeamFlowDiagram - Visual representation of team structure (PM → Agents)
 * Simple SVG-based implementation (foundation for future React Flow upgrade)
 */
export const TeamFlowDiagram: FC<TeamFlowDiagramProps> = ({ workflow }) => {
  const navigate = useNavigate();

  const handlePMClick = () => {
    if (workflow.coordinatorId) {
      navigate(`/project-managers/${workflow.coordinatorId}`);
    }
  };

  const handleAgentClick = (componentId: string) => {
    navigate(`/agents/${componentId}`);
  };

  const agents = workflow.componentAssignments || [];
  const agentsPerRow = 3;
  const rows = Math.ceil(agents.length / agentsPerRow);

  // Calculate SVG dimensions
  const pmBoxWidth = 200;
  const pmBoxHeight = 60;
  const agentBoxWidth = 150;
  const agentBoxHeight = 50;
  const horizontalSpacing = 20;
  const verticalSpacing = 80;
  const topMargin = 20;

  const diagramWidth = Math.max(
    pmBoxWidth,
    agentsPerRow * agentBoxWidth + (agentsPerRow - 1) * horizontalSpacing
  );
  const diagramHeight = topMargin + pmBoxHeight + verticalSpacing + rows * (agentBoxHeight + verticalSpacing);

  // PM box position (centered at top)
  const pmX = (diagramWidth - pmBoxWidth) / 2;
  const pmY = topMargin;
  const pmCenterX = pmX + pmBoxWidth / 2;
  const pmBottomY = pmY + pmBoxHeight;

  return (
    <div className="w-full overflow-auto">
      <div className="min-w-[600px]">
        <h3 className="text-lg font-semibold text-fg mb-4">Team Structure</h3>
        <svg
          width={diagramWidth}
          height={diagramHeight}
          className="mx-auto"
          style={{ maxWidth: '100%' }}
        >
          {/* PM Box */}
          <g
            onClick={handlePMClick}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            role="button"
            tabIndex={0}
            aria-label={`Navigate to Project Manager: ${workflow.coordinator?.name}`}
          >
            <rect
              x={pmX}
              y={pmY}
              width={pmBoxWidth}
              height={pmBoxHeight}
              fill="#f3f4f6"
              stroke="#9ca3af"
              strokeWidth="2"
              rx="8"
              className="dark:fill-gray-800 dark:stroke-gray-600"
            />
            <text
              x={pmCenterX}
              y={pmY + 25}
              textAnchor="middle"
              className="text-sm font-semibold fill-gray-900 dark:fill-gray-100"
            >
              {workflow.coordinator?.name || 'Project Manager'}
            </text>
            {workflow.coordinator?.version && (
              <text
                x={pmCenterX}
                y={pmY + 45}
                textAnchor="middle"
                className="text-xs fill-purple-600 dark:fill-purple-400"
              >
                {workflow.coordinator.version}
              </text>
            )}
          </g>

          {/* Arrows and Agent Boxes */}
          {agents.map((agent, index) => {
            const row = Math.floor(index / agentsPerRow);
            const col = index % agentsPerRow;

            // Calculate agent box position
            const rowWidth = Math.min(agents.length - row * agentsPerRow, agentsPerRow) * agentBoxWidth +
              (Math.min(agents.length - row * agentsPerRow, agentsPerRow) - 1) * horizontalSpacing;
            const rowStartX = (diagramWidth - rowWidth) / 2;

            const agentX = rowStartX + col * (agentBoxWidth + horizontalSpacing);
            const agentY = pmBottomY + verticalSpacing + row * (agentBoxHeight + verticalSpacing);
            const agentCenterX = agentX + agentBoxWidth / 2;
            const agentTopY = agentY;

            return (
              <g key={agent.versionId}>
                {/* Arrow from PM to Agent */}
                <line
                  x1={pmCenterX}
                  y1={pmBottomY}
                  x2={agentCenterX}
                  y2={agentTopY}
                  stroke="#9ca3af"
                  strokeWidth="2"
                  className="dark:stroke-gray-600"
                  markerEnd="url(#arrowhead)"
                />

                {/* Agent Box */}
                <g
                  onClick={() => handleAgentClick(agent.componentId)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  role="button"
                  tabIndex={0}
                  aria-label={`Navigate to Agent: ${agent.componentName}`}
                >
                  <rect
                    x={agentX}
                    y={agentY}
                    width={agentBoxWidth}
                    height={agentBoxHeight}
                    fill="#dbeafe"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    rx="8"
                    className="dark:fill-blue-900 dark:stroke-blue-600"
                  />
                  <text
                    x={agentCenterX}
                    y={agentY + 22}
                    textAnchor="middle"
                    className="text-sm font-medium fill-blue-900 dark:fill-blue-100"
                  >
                    {agent.componentName.length > 18
                      ? `${agent.componentName.substring(0, 15)}...`
                      : agent.componentName}
                  </text>
                  <text
                    x={agentCenterX}
                    y={agentY + 38}
                    textAnchor="middle"
                    className="text-xs fill-blue-600 dark:fill-blue-400"
                  >
                    {agent.version}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#9ca3af" className="dark:fill-gray-600" />
            </marker>
          </defs>
        </svg>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded"></div>
            <span>Project Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-600 rounded"></div>
            <span>Agent</span>
          </div>
        </div>

        {/* No agents message */}
        {agents.length === 0 && (
          <div className="text-center mt-8 text-muted">
            <p>No agents assigned to this team yet.</p>
            <p className="text-sm mt-1">Edit the team to add agents.</p>
          </div>
        )}
      </div>
    </div>
  );
};
