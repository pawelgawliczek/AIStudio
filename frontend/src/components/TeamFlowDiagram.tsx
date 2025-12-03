import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow } from '../types';

export interface TeamFlowDiagramProps {
  workflow: Workflow;
}

/**
 * TeamFlowDiagram - Visual representation of team structure (Agents)
 * Simple SVG-based implementation (foundation for future React Flow upgrade)
 */
export const TeamFlowDiagram: FC<TeamFlowDiagramProps> = ({ workflow }) => {
  const navigate = useNavigate();

  const handleAgentClick = (componentId: string) => {
    navigate(`/agents/${componentId}`);
  };

  const agents = workflow.componentAssignments || [];
  const agentsPerRow = 4;
  const rows = Math.ceil(agents.length / agentsPerRow);

  // Calculate SVG dimensions (no PM box anymore)
  const agentBoxWidth = 150;
  const agentBoxHeight = 50;
  const horizontalSpacing = 20;
  const verticalSpacing = 40;
  const topMargin = 20;

  const diagramWidth = agentsPerRow * agentBoxWidth + (agentsPerRow - 1) * horizontalSpacing;
  const diagramHeight = topMargin + rows * (agentBoxHeight + verticalSpacing);

  return (
    <div className="w-full overflow-auto">
      <div className="min-w-[600px]">
        <h3 className="text-lg font-semibold text-fg mb-4">Team Agents</h3>
        <svg
          width={diagramWidth}
          height={diagramHeight}
          className="mx-auto"
          style={{ maxWidth: '100%' }}
        >
          {/* Agent Boxes */}
          {agents.map((agent, index) => {
            const row = Math.floor(index / agentsPerRow);
            const col = index % agentsPerRow;

            // Calculate agent box position
            const rowWidth = Math.min(agents.length - row * agentsPerRow, agentsPerRow) * agentBoxWidth +
              (Math.min(agents.length - row * agentsPerRow, agentsPerRow) - 1) * horizontalSpacing;
            const rowStartX = (diagramWidth - rowWidth) / 2;

            const agentX = rowStartX + col * (agentBoxWidth + horizontalSpacing);
            const agentY = topMargin + row * (agentBoxHeight + verticalSpacing);
            const agentCenterX = agentX + agentBoxWidth / 2;

            return (
              <g key={agent.versionId}>
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
        </svg>

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
