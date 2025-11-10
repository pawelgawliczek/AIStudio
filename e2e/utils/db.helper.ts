import { APIRequestContext } from '@playwright/test';
import { ApiHelper, TEST_USERS } from './';

/**
 * Database helper for E2E tests
 * Handles test data setup and cleanup
 */
export class DbHelper {
  /**
   * Seed test users
   * Creates admin, pm, and dev users for testing
   */
  static async seedTestUsers(request: APIRequestContext) {
    try {
      for (const user of Object.values(TEST_USERS)) {
        await ApiHelper.register(request, {
          email: user.email,
          password: user.password,
          name: user.name,
          role: user.role,
        });
      }
    } catch (error) {
      // Users might already exist, ignore error
      console.log('Test users might already exist, continuing...');
    }
  }

  /**
   * Clean up test data
   * Removes all test projects, epics, stories, and subtasks
   */
  static async cleanup(api: ApiHelper) {
    try {
      // Get all projects
      const projects = await api.getProjects();

      // Delete all projects (cascades to epics, stories, subtasks)
      for (const project of projects) {
        if (project.name.startsWith('Test ')) {
          await api.deleteProject(project.id);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Create test project with epic and stories
   */
  static async createTestProject(api: ApiHelper) {
    const project = await api.createProject(
      `Test Project ${Date.now()}`,
      'E2E test project'
    );

    const epic = await api.createEpic(
      project.id,
      'Test Epic',
      'Epic for E2E testing'
    );

    const story = await api.createStory({
      projectId: project.id,
      epicId: epic.id,
      title: 'Test Story',
      description: 'Story for E2E testing',
      businessImpact: 3,
      businessComplexity: 2,
      technicalComplexity: 3,
    });

    return { project, epic, story };
  }
}
