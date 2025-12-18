import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types/index.js';

export const tool: Tool = {
  name: 'suggest_files_for_story',
  description: 'Smart file suggestions based on story title and description. Analyzes keywords, similar stories, and code patterns. Returns ranked files with confidence scores.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story ID',
      },
    },
    required: ['storyId'],
  },
};

export const metadata: ToolMetadata = {
  category: 'stories',
  domain: 'planning',
  tags: ['story', 'planning', 'files', 'ai-suggestions'],
  version: '1.0.0',
  since: '0.5.0',
  lastUpdated: '2025-11-12',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { storyId } = params;

  // Get story details
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      projectId: true,
      epicId: true,
      project: {
        select: { name: true },
      },
    },
  });

  if (!story) {
    throw new Error(`Story not found: ${storyId}`);
  }

  // Extract keywords from story
  const text = `${story.title} ${story.description || ''}`.toLowerCase();
  const keywords = extractKeywords(text);

  // Get all files in project
  const allFiles = await prisma.codeMetrics.findMany({
    where: { projectId: story.projectId },
    select: {
      filePath: true,
      linesOfCode: true,
      cyclomaticComplexity: true,
      maintainabilityIndex: true,
      lastModified: true,
    },
  });

  // Score each file based on relevance
  const scoredFiles = allFiles.map((file) => {
    let score = 0;
    const reasons: string[] = [];

    const fileLower = file.filePath.toLowerCase();
    const fileName = file.filePath.split('/').pop() || '';
    const fileNameLower = fileName.toLowerCase();

    // Check filename matches
    for (const keyword of keywords) {
      if (fileNameLower.includes(keyword)) {
        score += 10;
        reasons.push(`Filename contains "${keyword}"`);
      } else if (fileLower.includes(keyword)) {
        score += 5;
        reasons.push(`Path contains "${keyword}"`);
      }
    }

    // Boost for common patterns
    if (text.includes('auth') && fileLower.includes('auth')) {
      score += 15;
      reasons.push('Authentication related');
    }
    if (text.includes('user') && fileLower.includes('user')) {
      score += 15;
      reasons.push('User management related');
    }
    if (text.includes('payment') && fileLower.includes('payment')) {
      score += 15;
      reasons.push('Payment related');
    }
    if (text.includes('email') && fileLower.includes('email')) {
      score += 15;
      reasons.push('Email related');
    }
    if (text.includes('test') && fileLower.includes('test')) {
      score += 10;
      reasons.push('Testing related');
    }
    if (text.includes('api') && fileLower.includes('controller')) {
      score += 10;
      reasons.push('API endpoint');
    }
    if (text.includes('database') && fileLower.includes('service')) {
      score += 10;
      reasons.push('Database service');
    }

    // Penalize test files unless story mentions testing
    if (fileLower.includes('.spec.') || fileLower.includes('.test.')) {
      if (!text.includes('test')) {
        score -= 5;
      }
    }

    // Boost recently modified files (might be in same area)
    const daysSinceModified =
      (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 7) {
      score += 3;
      reasons.push('Recently modified');
    }

    // Consider complexity (complex files more likely to need changes)
    if (file.cyclomaticComplexity > 15) {
      score += 2;
    }

    return {
      filePath: file.filePath,
      score,
      reasons,
      metadata: {
        loc: file.linesOfCode,
        complexity: file.cyclomaticComplexity,
        maintainability: file.maintainabilityIndex,
      },
    };
  });

  // Sort by score and take top matches
  const rankedFiles = scoredFiles
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // Calculate confidence level
  const topScore = rankedFiles[0]?.score || 0;
  const confidence =
    topScore >= 20
      ? 'high'
      : topScore >= 10
      ? 'medium'
      : topScore > 0
      ? 'low'
      : 'none';

  // Get similar stories (if in same epic)
  let similarStories: any[] = [];
  if (story.epicId) {
    similarStories = await prisma.story.findMany({
      where: {
        epicId: story.epicId,
        id: { not: storyId },
      },
      select: {
        key: true,
        title: true,
      },
      take: 5,
    });
  }

  // Generate insights
  const insights: string[] = [];

  if (confidence === 'high') {
    insights.push(
      `✅ HIGH CONFIDENCE: Found ${rankedFiles.length} likely files based on strong keyword matches.`,
    );
  } else if (confidence === 'medium') {
    insights.push(
      `⚠️ MEDIUM CONFIDENCE: Found ${rankedFiles.length} possible files. Review carefully.`,
    );
  } else if (confidence === 'low') {
    insights.push(
      `❓ LOW CONFIDENCE: Few clear matches. Story description may need more detail.`,
    );
  } else {
    insights.push(
      `🔍 NO MATCHES: No obvious file matches. This may be a new feature or needs codebase exploration.`,
    );
  }

  if (rankedFiles.some((f) => f.metadata.complexity > 15)) {
    insights.push(
      `🔥 COMPLEX FILES: Some suggested files have high complexity. Extra care needed.`,
    );
  }

  const result = {
    story: {
      id: story.id,
      key: story.key,
      title: story.title,
      project: story.project.name,
    },
    analysis: {
      keywords: keywords.slice(0, 10),
      confidence,
      filesAnalyzed: allFiles.length,
      matchesFound: rankedFiles.length,
    },
    suggestedFiles: rankedFiles.map((f) => ({
      filePath: f.filePath,
      confidence: Math.min(100, Math.round((f.score / 30) * 100)),
      reasons: f.reasons,
      loc: f.metadata.loc,
      complexity: f.metadata.complexity,
      maintainability: Math.round(f.metadata.maintainability),
      warning:
        f.metadata.complexity > 15
          ? 'High complexity - refactor before changes'
          : f.metadata.maintainability < 50
          ? 'Low maintainability'
          : undefined,
    })),
    similarStories: similarStories.map((s) => ({
      key: s.key,
      title: s.title,
    })),
    insights,
    recommendations: [
      rankedFiles.length > 0
        ? `1. Start by reviewing top ${Math.min(3, rankedFiles.length)} suggested files`
        : '1. Use code search or ask for codebase exploration',
      '2. Check for similar implementations in codebase',
      '3. Review test files alongside implementation files',
      confidence === 'low'
        ? '4. Add more specific keywords to story description'
        : '4. Verify all dependencies of suggested files',
    ],
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  // Common words to ignore
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'need',
    'that',
    'this',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'add',
    'create',
    'update',
    'delete',
    'fix',
    'implement',
    'feature',
    'bug',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency and return top keywords
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 15);
}
