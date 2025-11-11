import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinkCommitDto, CommitResponseDto } from './dto';
import { WorkersService } from '../workers/workers.service';

@Injectable()
export class CommitsService {
  private readonly logger = new Logger(CommitsService.name);

  constructor(
    private prisma: PrismaService,
    private workersService: WorkersService,
  ) {}

  /**
   * Link a commit to a story/epic
   */
  async linkCommit(linkCommitDto: LinkCommitDto): Promise<CommitResponseDto> {
    // Check if commit already exists
    const existingCommit = await this.prisma.commit.findUnique({
      where: { hash: linkCommitDto.hash },
    });

    if (existingCommit) {
      // Update existing commit
      const commit = await this.prisma.commit.update({
        where: { hash: linkCommitDto.hash },
        data: {
          storyId: linkCommitDto.storyId,
          epicId: linkCommitDto.epicId,
        },
        include: {
          project: true,
          story: true,
          epic: true,
          files: true,
        },
      });

      return this.transformCommit(commit);
    }

    // Create new commit with files
    const commit = await this.prisma.commit.create({
      data: {
        hash: linkCommitDto.hash,
        projectId: linkCommitDto.projectId,
        author: linkCommitDto.author,
        timestamp: new Date(linkCommitDto.timestamp),
        message: linkCommitDto.message,
        storyId: linkCommitDto.storyId,
        epicId: linkCommitDto.epicId,
        files: linkCommitDto.files
          ? {
              create: linkCommitDto.files.map((file) => ({
                filePath: file.filePath,
                locAdded: file.locAdded,
                locDeleted: file.locDeleted,
                complexityBefore: file.complexityBefore,
                complexityAfter: file.complexityAfter,
                coverageBefore: file.coverageBefore,
                coverageAfter: file.coverageAfter,
              })),
            }
          : undefined,
      },
      include: {
        project: true,
        story: true,
        epic: true,
        files: true,
      },
    });

    // Trigger background code analysis worker
    try {
      await this.workersService.analyzeCommit({
        commitHash: commit.hash,
        projectId: commit.projectId,
        storyId: commit.storyId || undefined,
      });
      this.logger.log(`Enqueued code analysis for commit ${commit.hash}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue code analysis for commit ${commit.hash}:`, error);
      // Don't fail the request if worker enqueue fails
    }

    return this.transformCommit(commit);
  }

  /**
   * Transform commit to convert bigint and Decimal to numbers
   */
  private transformCommit(commit: any): any {
    return {
      ...commit,
      files: commit.files?.map((file: any) => ({
        ...file,
        id: Number(file.id),
        coverageBefore: file.coverageBefore ? Number(file.coverageBefore) : null,
        coverageAfter: file.coverageAfter ? Number(file.coverageAfter) : null,
      })),
    };
  }

  /**
   * Get all commits for a project
   */
  async findByProject(projectId: string, includeFiles = false): Promise<CommitResponseDto[]> {
    const commits = await this.prisma.commit.findMany({
      where: { projectId },
      include: {
        project: true,
        story: true,
        epic: true,
        files: includeFiles,
      },
      orderBy: { timestamp: 'desc' },
    });

    return commits.map(c => this.transformCommit(c));
  }

  /**
   * Get all commits for a story
   */
  async findByStory(storyId: string, includeFiles = false): Promise<CommitResponseDto[]> {
    const commits = await this.prisma.commit.findMany({
      where: { storyId },
      include: {
        project: true,
        story: true,
        epic: true,
        files: includeFiles,
      },
      orderBy: { timestamp: 'desc' },
    });

    return commits.map(c => this.transformCommit(c));
  }

  /**
   * Get all commits for an epic
   */
  async findByEpic(epicId: string, includeFiles = false): Promise<CommitResponseDto[]> {
    const commits = await this.prisma.commit.findMany({
      where: { epicId },
      include: {
        project: true,
        story: true,
        epic: true,
        files: includeFiles,
      },
      orderBy: { timestamp: 'desc' },
    });

    return commits.map(c => this.transformCommit(c));
  }

  /**
   * Get a single commit by hash
   */
  async findOne(hash: string): Promise<CommitResponseDto> {
    const commit = await this.prisma.commit.findUnique({
      where: { hash },
      include: {
        project: true,
        story: true,
        epic: true,
        files: true,
      },
    });

    if (!commit) {
      throw new NotFoundException(`Commit with hash ${hash} not found`);
    }

    return this.transformCommit(commit);
  }

  /**
   * Get commit statistics for a project
   */
  async getProjectStatistics(projectId: string) {
    const [totalCommits, commitsWithStories, totalLOC, uniqueAuthors] = await Promise.all([
      this.prisma.commit.count({ where: { projectId } }),
      this.prisma.commit.count({ where: { projectId, storyId: { not: null } } }),
      this.prisma.commitFile.aggregate({
        where: {
          commit: {
            projectId,
          },
        },
        _sum: {
          locAdded: true,
          locDeleted: true,
        },
      }),
      this.prisma.commit.findMany({
        where: { projectId },
        select: { author: true },
        distinct: ['author'],
      }),
    ]);

    return {
      totalCommits,
      commitsWithStories,
      commitsWithoutStories: totalCommits - commitsWithStories,
      totalLinesAdded: totalLOC._sum.locAdded || 0,
      totalLinesDeleted: totalLOC._sum.locDeleted || 0,
      netLinesChanged: (totalLOC._sum.locAdded || 0) - (totalLOC._sum.locDeleted || 0),
      uniqueAuthors: uniqueAuthors.length,
    };
  }

  /**
   * Get commit statistics for a story
   */
  async getStoryStatistics(storyId: string) {
    const [totalCommits, totalLOC, uniqueAuthors, fileCount] = await Promise.all([
      this.prisma.commit.count({ where: { storyId } }),
      this.prisma.commitFile.aggregate({
        where: {
          commit: {
            storyId,
          },
        },
        _sum: {
          locAdded: true,
          locDeleted: true,
        },
      }),
      this.prisma.commit.findMany({
        where: { storyId },
        select: { author: true },
        distinct: ['author'],
      }),
      this.prisma.commitFile.findMany({
        where: {
          commit: {
            storyId,
          },
        },
        select: { filePath: true },
        distinct: ['filePath'],
      }),
    ]);

    return {
      totalCommits,
      totalLinesAdded: totalLOC._sum.locAdded || 0,
      totalLinesDeleted: totalLOC._sum.locDeleted || 0,
      netLinesChanged: (totalLOC._sum.locAdded || 0) - (totalLOC._sum.locDeleted || 0),
      uniqueAuthors: uniqueAuthors.length,
      filesChanged: fileCount.length,
    };
  }
}
