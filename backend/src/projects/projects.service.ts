import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            epics: true,
            stories: true,
            useCases: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        epics: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            epics: true,
            stories: true,
            useCases: true,
            commits: true,
            testCases: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async create(createProjectDto: CreateProjectDto) {
    // Check if project with same name already exists
    const existingProject = await this.prisma.project.findUnique({
      where: { name: createProjectDto.name },
    });

    if (existingProject) {
      throw new BadRequestException('Project with this name already exists');
    }

    return this.prisma.project.create({
      data: createProjectDto,
    });
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({ where: { id } });

    if (!existingProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // If name is being updated, check if it's already taken
    if (updateProjectDto.name && updateProjectDto.name !== existingProject.name) {
      const nameTaken = await this.prisma.project.findUnique({
        where: { name: updateProjectDto.name },
      });

      if (nameTaken) {
        throw new BadRequestException('Project name already taken');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await this.prisma.project.delete({ where: { id } });

    return { message: 'Project deleted successfully' };
  }
}
