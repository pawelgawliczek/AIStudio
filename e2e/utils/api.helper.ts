import { APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

export interface Project {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
}

export interface Epic {
  id: string;
  key: string;
  title: string;
  description?: string;
  projectId: string;
  status: string;
}

export interface Story {
  id: string;
  key: string;
  title: string;
  description?: string;
  status: string;
  projectId: string;
  epicId?: string;
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
}

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  storyId: string;
  status: string;
  layer?: string;
  component?: string;
}

/**
 * API Helper class for E2E tests
 */
export class ApiHelper {
  constructor(private request: APIRequestContext, private token: string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async createProject(name: string, description?: string): Promise<Project> {
    const response = await this.request.post(`${API_URL}/projects`, {
      headers: this.headers,
      data: { name, description },
    });
    return response.json();
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.request.get(`${API_URL}/projects`, {
      headers: this.headers,
    });
    return response.json();
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.request.get(`${API_URL}/projects/${id}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async deleteProject(id: string): Promise<void> {
    await this.request.delete(`${API_URL}/projects/${id}`, {
      headers: this.headers,
    });
  }

  // ============================================================================
  // Epics
  // ============================================================================

  async createEpic(
    projectId: string,
    title: string,
    description?: string
  ): Promise<Epic> {
    const response = await this.request.post(`${API_URL}/epics`, {
      headers: this.headers,
      data: { projectId, title, description },
    });
    return response.json();
  }

  async getEpics(projectId: string): Promise<Epic[]> {
    const response = await this.request.get(`${API_URL}/epics?projectId=${projectId}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async updateEpic(id: string, data: Partial<Epic>): Promise<Epic> {
    const response = await this.request.patch(`${API_URL}/epics/${id}`, {
      headers: this.headers,
      data,
    });
    return response.json();
  }

  async deleteEpic(id: string): Promise<void> {
    await this.request.delete(`${API_URL}/epics/${id}`, {
      headers: this.headers,
    });
  }

  // ============================================================================
  // Stories
  // ============================================================================

  async createStory(data: {
    projectId: string;
    title: string;
    description?: string;
    epicId?: string;
    businessImpact?: number;
    businessComplexity?: number;
    technicalComplexity?: number;
  }): Promise<Story> {
    const response = await this.request.post(`${API_URL}/stories`, {
      headers: this.headers,
      data,
    });
    return response.json();
  }

  async getStories(filters?: {
    projectId?: string;
    epicId?: string;
    status?: string;
  }): Promise<Story[]> {
    const params = new URLSearchParams();
    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.epicId) params.append('epicId', filters.epicId);
    if (filters?.status) params.append('status', filters.status);

    const response = await this.request.get(`${API_URL}/stories?${params}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async getStory(id: string): Promise<Story> {
    const response = await this.request.get(`${API_URL}/stories/${id}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async updateStory(id: string, data: Partial<Story>): Promise<Story> {
    const response = await this.request.patch(`${API_URL}/stories/${id}`, {
      headers: this.headers,
      data,
    });
    return response.json();
  }

  async updateStoryStatus(id: string, status: string): Promise<Story> {
    const response = await this.request.patch(`${API_URL}/stories/${id}/status`, {
      headers: this.headers,
      data: { status },
    });
    return response.json();
  }

  async deleteStory(id: string): Promise<void> {
    await this.request.delete(`${API_URL}/stories/${id}`, {
      headers: this.headers,
    });
  }

  // ============================================================================
  // Subtasks
  // ============================================================================

  async createSubtask(data: {
    storyId: string;
    title: string;
    description?: string;
    layer?: string;
    component?: string;
  }): Promise<Subtask> {
    const response = await this.request.post(`${API_URL}/subtasks`, {
      headers: this.headers,
      data,
    });
    return response.json();
  }

  async getSubtasks(storyId: string): Promise<Subtask[]> {
    const response = await this.request.get(`${API_URL}/subtasks?storyId=${storyId}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async updateSubtask(id: string, data: Partial<Subtask>): Promise<Subtask> {
    const response = await this.request.patch(`${API_URL}/subtasks/${id}`, {
      headers: this.headers,
      data,
    });
    return response.json();
  }

  async deleteSubtask(id: string): Promise<void> {
    await this.request.delete(`${API_URL}/subtasks/${id}`, {
      headers: this.headers,
    });
  }

  // ============================================================================
  // Auth
  // ============================================================================

  static async login(
    request: APIRequestContext,
    email: string,
    password: string
  ): Promise<string> {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email, password },
    });
    const data = await response.json();
    return data.access_token;
  }

  static async register(
    request: APIRequestContext,
    data: {
      email: string;
      password: string;
      name: string;
      role: string;
    }
  ): Promise<void> {
    await request.post(`${API_URL}/auth/register`, { data });
  }
}
