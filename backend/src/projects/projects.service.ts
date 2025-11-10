import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.project.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        epics: true,
        _count: {
          select: {
            stories: true,
            useCases: true,
          },
        },
      },
    });
  }

  async create(data: { name: string; description?: string; repositoryUrl?: string }) {
    return this.prisma.project.create({
      data,
    });
  }

  async update(id: string, data: Partial<{ name: string; description: string; status: string }>) {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }
}
