/**
 * Artifact Management MCP Tools
 * ST-151: Manages artifact definitions, access rules, and artifacts for workflow execution
 * ST-307: Renamed tools and added binary file support
 */

export * as createArtifactDefinition from './create_artifact_definition';
export * as updateArtifactDefinition from './update_artifact_definition';
export * as deleteArtifactDefinition from './delete_artifact_definition';
export * as listArtifactDefinitions from './list_artifact_definitions';
export * as setArtifactAccess from './set_artifact_access';
export * as removeArtifactAccess from './remove_artifact_access';

// ST-307: Primary tool names
export * as createArtifact from './create_artifact';
export * as uploadArtifactFromMdFile from './upload_artifact_from_md_file';
export * as uploadArtifactFromBinaryFile from './upload_artifact_from_binary_file';

// ST-307: Backward compatibility aliases (deprecated - use new names above)
export * as uploadArtifact from './create_artifact';
export * as uploadArtifactFromFile from './upload_artifact_from_md_file';

export * as getArtifact from './get_artifact';
export * as listArtifacts from './list_artifacts';
