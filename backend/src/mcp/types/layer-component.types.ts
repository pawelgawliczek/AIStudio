/**
 * Layer and Component Management Type Definitions
 */

export interface CreateLayerParams {
  projectId: string;
  name: string;
  description?: string;
  techStack?: string[];
  orderIndex: number;
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated';
}

export interface UpdateLayerParams {
  layerId: string;
  name?: string;
  description?: string;
  techStack?: string[];
  orderIndex?: number;
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated';
}

export interface ListLayersParams {
  projectId?: string;
  status?: 'active' | 'deprecated';
}

export interface GetLayerParams {
  layerId: string;
}

export interface LayerResponse {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  techStack: string[];
  orderIndex: number;
  color?: string;
  icon?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  usageCount?: {
    stories: number;
    components: number;
    useCases: number;
    testCases: number;
  };
  components?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
  }>;
}

export interface CreateComponentParams {
  projectId: string;
  name: string;
  description?: string;
  ownerId?: string;
  filePatterns?: string[];
  layerIds?: string[];
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated' | 'planning';
}

export interface UpdateComponentParams {
  componentId: string;
  name?: string;
  description?: string;
  ownerId?: string;
  filePatterns?: string[];
  layerIds?: string[];
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated' | 'planning';
}

export interface ListComponentsParams {
  projectId?: string;
  status?: 'active' | 'deprecated' | 'planning';
  layerId?: string;
}

export interface GetComponentParams {
  componentId: string;
}

export interface GetComponentUseCasesParams {
  componentId: string;
}

export interface GetComponentStoriesParams {
  componentId: string;
}

export interface ComponentResponse {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  ownerId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  filePatterns: string[];
  color?: string;
  icon?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  layers?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
    orderIndex: number;
  }>;
  usageCount?: {
    stories: number;
    useCases: number;
    testCases: number;
  };
}
