import { apiClient } from './api.client';

export interface TaxonomyArea {
  area: string;
  usageCount: number;
}

export interface AddAreaResponse {
  added: string;
  taxonomy: string[];
  warnings?: string[];
}

export interface RemoveAreaResponse {
  removed: string;
  taxonomy: string[];
  warnings?: string[];
}

export interface RenameAreaResponse {
  renamed: {
    from: string;
    to: string;
  };
  useCasesUpdated: number;
  taxonomy: string[];
}

export interface MergeAreasResponse {
  merged: {
    from: string[];
    to: string;
  };
  useCasesUpdated: number;
  taxonomy: string[];
}

export interface ValidateAreaResponse {
  valid: boolean;
  exactMatch: boolean;
  suggestions?: Array<{ area: string; distance: number }>;
}

export const taxonomyService = {
  async listAreas(projectId: string): Promise<TaxonomyArea[]> {
    const response = await apiClient.get(`/projects/${projectId}/taxonomy`);
    return response.data;
  },

  async addArea(projectId: string, area: string, force = false): Promise<AddAreaResponse> {
    const response = await apiClient.post(`/projects/${projectId}/taxonomy`, {
      area,
      force,
    });
    return response.data;
  },

  async removeArea(
    projectId: string,
    area: string,
    force = false
  ): Promise<RemoveAreaResponse> {
    const response = await apiClient.delete(`/projects/${projectId}/taxonomy/${encodeURIComponent(area)}`, {
      params: { force },
    });
    return response.data;
  },

  async renameArea(
    projectId: string,
    oldArea: string,
    newArea: string
  ): Promise<RenameAreaResponse> {
    const response = await apiClient.patch(
      `/projects/${projectId}/taxonomy/${encodeURIComponent(oldArea)}`,
      { newName: newArea }
    );
    return response.data;
  },

  async mergeAreas(
    projectId: string,
    sourceAreas: string[],
    targetArea: string
  ): Promise<MergeAreasResponse> {
    const response = await apiClient.post(`/projects/${projectId}/taxonomy/merge`, {
      sourceAreas,
      targetArea,
    });
    return response.data;
  },

  async validateArea(projectId: string, area: string): Promise<ValidateAreaResponse> {
    const response = await apiClient.post(`/projects/${projectId}/taxonomy/validate`, {
      area,
    });
    return response.data;
  },

  async getSuggestions(projectId: string, area: string): Promise<Array<{ area: string; distance: number }>> {
    const response = await apiClient.get(`/projects/${projectId}/taxonomy/suggest`, {
      params: { area },
    });
    return response.data;
  },
};
