import { useState, useEffect } from 'react';
import { taxonomyService, TaxonomyArea } from '../../services/taxonomy.service';

interface TaxonomyManagerProps {
  projectId: string;
}

export function TaxonomyManager({ projectId }: TaxonomyManagerProps) {
  const [areas, setAreas] = useState<TaxonomyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Add area dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [similarWarning, setSimilarWarning] = useState<string | null>(null);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<TaxonomyArea | null>(null);

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeTargetName, setMergeTargetName] = useState('');

  // Success/info messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAreas();
  }, [projectId]);

  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Validate area name as user types
  const [similarAreaSuggestion, setSimilarAreaSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (newAreaName.trim().length > 0) {
      const debounce = setTimeout(async () => {
        try {
          const validation = await taxonomyService.validateArea(projectId, newAreaName);
          if (!validation.valid && validation.suggestions && validation.suggestions.length > 0) {
            setSimilarWarning('Similar area exists');
            setSimilarAreaSuggestion(validation.suggestions[0].area);
          } else {
            setSimilarWarning(null);
            setSimilarAreaSuggestion(null);
          }
        } catch (err) {
          // Ignore validation errors
        }
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      setSimilarWarning(null);
      setSimilarAreaSuggestion(null);
    }
  }, [newAreaName, projectId]);

  const loadAreas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taxonomyService.listAreas(projectId);
      setAreas(data);
    } catch (err: any) {
      setError(err.message || 'Error loading taxonomy areas');
    } finally {
      setLoading(false);
    }
  };

  const handleAddArea = async () => {
    if (!newAreaName.trim()) {
      setAddError('Area name is required');
      return;
    }

    try {
      await taxonomyService.addArea(projectId, newAreaName);
      await loadAreas();
      setShowAddDialog(false);
      setNewAreaName('');
      setAddError(null);
      setSimilarWarning(null);
      setSimilarAreaSuggestion(null);
      setSuccessMessage('Area successfully added');
    } catch (err: any) {
      setAddError(err.response?.data?.message || err.message || 'Error adding area');
    }
  };

  const handleDeleteClick = (area: TaxonomyArea) => {
    setAreaToDelete(area);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!areaToDelete) return;

    try {
      await taxonomyService.removeArea(projectId, areaToDelete.area, false);
      await loadAreas();
      setShowDeleteDialog(false);
      setAreaToDelete(null);
      setSuccessMessage(`Area "${areaToDelete.area}" deleted successfully`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error removing area');
      // Don't close dialog on error
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setAreaToDelete(null);
  };

  const handleDoubleClick = (area: TaxonomyArea) => {
    setEditingArea(area.area);
    setEditingValue(area.area);
  };

  const handleRenameBlur = async () => {
    if (editingArea && editingValue !== editingArea) {
      try {
        const result = await taxonomyService.renameArea(projectId, editingArea, editingValue);
        await loadAreas();
        setSuccessMessage(`Renamed to "${result.renamed.to}" - ${result.useCasesUpdated} use cases updated`);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Error renaming area');
      }
    }
    setEditingArea(null);
    setEditingValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setEditingArea(null);
      setEditingValue('');
    } else if (e.key === 'Enter') {
      handleRenameBlur();
    }
  };

  const handleCheckboxChange = (area: string) => {
    const newSelected = new Set(selectedAreas);
    if (newSelected.has(area)) {
      newSelected.delete(area);
    } else {
      newSelected.add(area);
    }
    setSelectedAreas(newSelected);
  };

  const handleMerge = async () => {
    if (!mergeTargetName.trim()) return;

    const sourceAreas = Array.from(selectedAreas);
    try {
      const result = await taxonomyService.mergeAreas(projectId, sourceAreas, mergeTargetName);
      await loadAreas();
      setShowMergeDialog(false);
      setMergeTargetName('');
      setSelectedAreas(new Set());
      setSuccessMessage(
        `Merged ${result.merged.from.length} areas into "${result.merged.to}" - ${result.useCasesUpdated} use cases updated`
      );
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error merging areas');
    }
  };

  if (loading) {
    return <div>Loading taxonomy areas...</div>;
  }

  if (error && areas.length === 0) {
    return <div>Error loading taxonomy areas: {error}</div>;
  }

  return (
    <div className="taxonomy-manager">
      {!showAddDialog && !showDeleteDialog && !showMergeDialog && (
        <>
          <div className="header">
            <h2>Taxonomy Settings</h2>
            <div className="actions">
              <button
                onClick={() => setShowAddDialog(true)}
                aria-label="Add area"
                className="add-button"
              >
                Add Area
              </button>
              <button
                onClick={() => setShowMergeDialog(true)}
                disabled={selectedAreas.size < 2}
                aria-label="Merge selected areas"
                className="merge-button"
              >
                Merge Selected
              </button>
            </div>
          </div>

          {successMessage && (
            <div role="alert" className="success-message">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="areas-header">
            <h3>Areas ({areas.length})</h3>
          </div>

          {areas.length === 0 ? (
            <div className="empty-state">
              No taxonomy areas defined yet. Click "Add Area" to create one.
            </div>
          ) : (
            <div className="areas-list">
              {areas.map((area) => (
                <div key={area.area} className="area-item">
                  <input
                    type="checkbox"
                    checked={selectedAreas.has(area.area)}
                    onChange={() => handleCheckboxChange(area.area)}
                    aria-label={`Select ${area.area}`}
                  />

                  {editingArea === area.area ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={handleRenameBlur}
                      onKeyDown={handleRenameKeyDown}
                      autoFocus
                      className="rename-input"
                    />
                  ) : (
                    <span
                      className="area-name"
                      onDoubleClick={() => handleDoubleClick(area)}
                    >
                      {area.area}
                    </span>
                  )}

                  <span className="usage-count">{area.usageCount} use cases</span>

                  <button
                    onClick={() => handleDeleteClick(area)}
                    aria-label="Delete area"
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Area Dialog */}
      {showAddDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add Taxonomy Area</h3>
            <input
              type="text"
              placeholder="Enter area name"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              className="area-input"
            />
            {similarWarning && (
              <div className="warning-message">
                {similarWarning}
                {similarAreaSuggestion && <div>{similarAreaSuggestion}</div>}
              </div>
            )}
            {addError && (
              <div className="error-message">{addError}</div>
            )}
            <div className="modal-actions">
              <button onClick={handleAddArea} aria-label="Add">
                Add
              </button>
              <button onClick={() => {
                setShowAddDialog(false);
                setNewAreaName('');
                setAddError(null);
                setSimilarWarning(null);
                setSimilarAreaSuggestion(null);
              }} aria-label="Cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && areaToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Are you sure?</h3>
            <p>
              Delete area "{areaToDelete.area}"?
              {areaToDelete.usageCount > 0 && (
                <span className="warning">
                  {' '}This area has {areaToDelete.usageCount} use cases that will be orphaned.
                </span>
              )}
            </p>
            <div className="modal-actions">
              <button onClick={handleDeleteConfirm} aria-label="Confirm">
                Confirm
              </button>
              <button onClick={handleDeleteCancel} aria-label="Cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Dialog */}
      {showMergeDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Merge Taxonomy Areas</h3>
            <p>Merging {selectedAreas.size} areas</p>
            <input
              type="text"
              placeholder="Target area name"
              value={mergeTargetName}
              onChange={(e) => setMergeTargetName(e.target.value)}
              className="merge-input"
            />
            <div className="modal-actions">
              <button onClick={handleMerge} aria-label="Merge">
                Merge
              </button>
              <button onClick={() => {
                setShowMergeDialog(false);
                setMergeTargetName('');
              }} aria-label="Cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
