import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { QUEUE_NAMES } from '../workers.module';

/**
 * NotificationProcessor
 *
 * Responsibilities:
 * - Send email alerts to users
 * - Push real-time updates via WebSocket
 * - Create in-app notifications
 * - Handle notification preferences and delivery
 */
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private websocketGateway: AppWebSocketGateway,
  ) {}

  /**
   * Send notification (email, WebSocket, or in-app)
   */
  @Process('send-notification')
  async sendNotification(job: Job<{
    type: 'email' | 'websocket' | 'in-app';
    recipients: string[];
    subject?: string;
    message: string;
    data?: any;
  }>) {
    const { type, recipients, subject, message, data } = job.data;
    this.logger.log(`Sending ${type} notification to ${recipients.length} recipients`);

    try {
      switch (type) {
        case 'websocket':
          return await this.sendWebSocketNotification(recipients, message, data);

        case 'email':
          return await this.sendEmailNotification(recipients, subject || '', message, data);

        case 'in-app':
          return await this.createInAppNotification(recipients, message, data);

        default:
          throw new Error(`Unknown notification type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send ${type} notification:`, error);
      throw error;
    }
  }

  /**
   * Send real-time WebSocket notification
   */
  private async sendWebSocketNotification(
    userIds: string[],
    message: string,
    data?: any,
  ) {
    for (const userId of userIds) {
      this.websocketGateway.server.to(`user:${userId}`).emit('notification', {
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.log(`Sent WebSocket notification to ${userIds.length} users`);
    return { success: true, recipients: userIds.length };
  }

  /**
   * Send email notification
   * Note: In production, integrate with email service (SendGrid, AWS SES, etc.)
   */
  private async sendEmailNotification(
    emails: string[],
    subject: string,
    message: string,
    data?: any,
  ) {
    // TODO: Integrate with actual email service
    // For now, just log the email
    this.logger.log(`Would send email to: ${emails.join(', ')}`);
    this.logger.log(`Subject: ${subject}`);
    this.logger.log(`Message: ${message}`);

    // Store email log in database for audit
    await this.prisma.$executeRaw`
      INSERT INTO notification_logs (type, recipients, subject, message, data, sent_at)
      VALUES ('email', ${JSON.stringify(emails)}, ${subject}, ${message}, ${JSON.stringify(data)}, NOW())
    `.catch(() => {
      // Ignore if table doesn't exist yet
      this.logger.warn('notification_logs table does not exist - skipping audit log');
    });

    return { success: true, recipients: emails.length };
  }

  /**
   * Create in-app notification
   * Stored in database and shown in UI notification center
   */
  private async createInAppNotification(
    userIds: string[],
    message: string,
    data?: any,
  ) {
    // TODO: Create notifications table if not exists
    // For now, just log
    this.logger.log(`Created in-app notification for ${userIds.length} users: ${message}`);

    // Also send via WebSocket for immediate delivery
    await this.sendWebSocketNotification(userIds, message, data);

    return { success: true, recipients: userIds.length };
  }

  /**
   * Send story assignment notification
   */
  @Process('story-assigned')
  async notifyStoryAssigned(job: Job<{
    storyId: string;
    assignedTo: string;
  }>) {
    const { storyId, assignedTo } = job.data;

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { title: true, key: true },
    });

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    await this.sendWebSocketNotification(
      [assignedTo],
      `New story assigned: ${story.key} - ${story.title}`,
      { storyId, storyKey: story.key },
    );

    return { success: true };
  }

  /**
   * Send quality alert notification
   */
  @Process('quality-alert')
  async notifyQualityAlert(job: Job<{
    projectId: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    details: any;
  }>) {
    const { projectId, severity, message, details } = job.data;

    // Get project admins/architects
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.logger.warn(`[${severity.toUpperCase()}] Quality alert for ${project.name}: ${message}`);
    this.logger.debug('Alert details:', details);

    // TODO: Get actual project members with architect/admin roles
    // For now, just log the alert
    return { success: true };
  }

  /**
   * Send test failure notification
   */
  @Process('test-failure')
  async notifyTestFailure(job: Job<{
    storyId: string;
    testResults: any;
  }>) {
    const { storyId, testResults } = job.data;

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: {
        title: true,
        key: true,
      },
    });

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    const failureCount = testResults?.failed || 0;
    this.logger.warn(`Test failures in ${story.key}: ${story.title} (${failureCount} failed)`);

    // TODO: Notify story assignees
    return { success: true };
  }
}
