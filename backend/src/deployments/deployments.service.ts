import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentStatus } from '@prisma/client';

export interface DeploymentFilters {
  status?: DeploymentStatus;
  environment?: string;
  storyId?: string;
  limit?: number;
  offset?: number;
}

export interface DeploymentStats {
  total: number;
  byStatus: Record<string, number>;
  byEnvironment: Record<string, number>;
  todayCount: number;
  todaySuccessCount: number;
  todayFailedCount: number;
  recentDeployments: any[];
}

@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: DeploymentFilters = {}) {
    const { status, environment, storyId, limit = 20, offset = 0 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (environment) where.environment = environment;
    if (storyId) where.storyId = storyId;

    const [deployments, total] = await Promise.all([
      this.prisma.deploymentLog.findMany({
        where,
        include: {
          story: {
            select: {
              id: true,
              key: true,
              title: true,
              projectId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.deploymentLog.count({ where }),
    ]);

    return {
      data: deployments.map((d) => this.formatDeployment(d)),
      total,
      limit,
      offset,
    };
  }

  async findById(id: string) {
    const deployment = await this.prisma.deploymentLog.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            projectId: true,
          },
        },
      },
    });

    return deployment ? this.formatDeployment(deployment) : null;
  }

  async findByStoryId(storyId: string) {
    const deployments = await this.prisma.deploymentLog.findMany({
      where: { storyId },
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const successCount = deployments.filter(
      (d) => d.status === DeploymentStatus.deployed
    ).length;
    const failedCount = deployments.filter(
      (d) =>
        d.status === DeploymentStatus.failed ||
        d.status === DeploymentStatus.rolled_back
    ).length;

    return {
      data: deployments.map((d) => this.formatDeployment(d)),
      total: deployments.length,
      successCount,
      failedCount,
    };
  }

  async getStats(): Promise<DeploymentStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total,
      byStatusRaw,
      byEnvironmentRaw,
      todayDeployments,
      recentDeployments,
    ] = await Promise.all([
      this.prisma.deploymentLog.count(),
      this.prisma.deploymentLog.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.deploymentLog.groupBy({
        by: ['environment'],
        _count: true,
      }),
      this.prisma.deploymentLog.findMany({
        where: { createdAt: { gte: today } },
        select: { status: true },
      }),
      this.prisma.deploymentLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          story: {
            select: {
              id: true,
              key: true,
              title: true,
              projectId: true,
            },
          },
        },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    byStatusRaw.forEach((item) => {
      byStatus[item.status] = item._count;
    });

    const byEnvironment: Record<string, number> = {};
    byEnvironmentRaw.forEach((item) => {
      byEnvironment[item.environment] = item._count;
    });

    const todaySuccessCount = todayDeployments.filter(
      (d) => d.status === DeploymentStatus.deployed
    ).length;
    const todayFailedCount = todayDeployments.filter(
      (d) =>
        d.status === DeploymentStatus.failed ||
        d.status === DeploymentStatus.rolled_back
    ).length;

    return {
      total,
      byStatus,
      byEnvironment,
      todayCount: todayDeployments.length,
      todaySuccessCount,
      todayFailedCount,
      recentDeployments: recentDeployments.map((d) => this.formatDeployment(d)),
    };
  }

  private formatDeployment(deployment: any) {
    const duration =
      deployment.completedAt && deployment.deployedAt
        ? new Date(deployment.completedAt).getTime() -
          new Date(deployment.deployedAt).getTime()
        : null;

    return {
      id: deployment.id,
      storyId: deployment.storyId,
      storyKey: deployment.story?.key || null,
      storyTitle: deployment.story?.title || null,
      projectId: deployment.story?.projectId || null,
      prNumber: deployment.prNumber,
      status: deployment.status,
      environment: deployment.environment,
      branch: deployment.branch,
      commitHash: deployment.commitHash,
      approvedBy: deployment.approvedBy,
      approvedAt: deployment.approvedAt,
      deployedBy: deployment.deployedBy,
      deployedAt: deployment.deployedAt,
      completedAt: deployment.completedAt,
      duration, // in milliseconds
      errorMessage: deployment.errorMessage,
      approvalMethod: deployment.approvalMethod,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }
}
