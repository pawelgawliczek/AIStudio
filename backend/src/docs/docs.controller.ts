import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Controller, Get, Res, Param } from '@nestjs/common';
import { Response } from 'express';

@Controller('docs')
export class DocsController {
  @Get(':filename')
  serveDoc(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '');

    // Only allow markdown files
    if (!sanitizedFilename.endsWith('.md')) {
      return res.status(400).send('Only markdown files are allowed');
    }

    const filePath = join(process.cwd(), 'public', 'docs', sanitizedFilename);

    if (!existsSync(filePath)) {
      return res.status(404).send('Document not found');
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(content);
    } catch (error) {
      return res.status(500).send('Error reading document');
    }
  }

  @Get()
  listDocs(@Res() res: Response) {
    const docsDir = join(process.cwd(), 'public', 'docs');

    if (!existsSync(docsDir)) {
      return res.json({ docs: [] });
    }

    try {
      const fs = require('fs');
      const files = fs.readdirSync(docsDir)
        .filter((file: string) => file.endsWith('.md'))
        .map((file: string) => ({
          name: file,
          url: `/docs/${file}`
        }));

      res.json({ docs: files });
    } catch (error) {
      return res.status(500).json({ error: 'Error listing documents' });
    }
  }
}
