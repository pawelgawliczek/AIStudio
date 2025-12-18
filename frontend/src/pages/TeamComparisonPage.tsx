import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { VersionComparisonModal } from '../components/VersionComparisonModal';

export function TeamComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const v1 = searchParams.get('v1');
  const v2 = searchParams.get('v2');

  // If no version IDs, show error
  if (!v1 || !v2) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Link
          to={`/teams/${id}`}
          className="inline-flex items-center gap-2 text-fg hover:text-accent mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Team
        </Link>

        <div className="text-center py-12">
          <p className="text-fg text-lg">Invalid comparison parameters</p>
          <p className="text-muted mt-2">Please select two versions to compare.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Link
        to={`/teams/${id}`}
        className="inline-flex items-center gap-2 text-fg hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Team
      </Link>

      <h1 className="text-2xl font-bold text-fg mb-6">Team Version Comparison</h1>

      <VersionComparisonModal
        isOpen={true}
        onClose={() => navigate(`/teams/${id}`)}
        entityType="workflow"
        versionId1={v1}
        versionId2={v2}
      />
    </div>
  );
}
