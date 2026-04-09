import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as p from '@clack/prompts';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { checkFileExists } from '../utils.js';

export async function runDoctor(query: string, targetFile: string | undefined, cwd: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    p.log.error('GEMINI_API_KEY is missing in your environment.');
    p.note('Add it to your .env file or export it: `export GEMINI_API_KEY=AIza...`', 'Setup Instructions');
    return;
  }

  if (!targetFile) {
    const tokens = query.split(/\s+/);
    const potentialFiles = tokens.filter(t => t.includes('.'));
    for (const token of potentialFiles) {
      const cleanPath = token.replace(/[^a-zA-Z0-9_\-\.\/]/g, '');
      if (cleanPath && existsSync(path.resolve(cwd, cleanPath))) {
         targetFile = cleanPath;
         p.log.info(chalk.cyan(`Auto-detected relevant file from query: ${targetFile}`));
         break;
      }
    }
  }

  let fileContent = '';
  let fileContext = '';

  if (targetFile) {
    const filePath = path.resolve(cwd, targetFile);
    
    if (!(await checkFileExists(filePath))) {
      p.log.error(`The specified file does not exist: ${targetFile}`);
      return;
    }

    try {
      const s = p.spinner();
      s.start(`Reading ${targetFile}...`);
      fileContent = await fs.readFile(filePath, 'utf8');
      s.stop(`Read ${targetFile} successfully.`);
      fileContext = `\nHere is the content of the target file (${targetFile}):\n\`\`\`\n${fileContent}\n\`\`\`\n`;
    } catch (err: any) {
      p.log.error(`Failed to read file: ${err.message}`);
      return;
    }
  }

  const s = p.spinner();
  s.start('Asking AI to diagnose the issue...');

  try {
    const googleProvider = createGoogleGenerativeAI({ apiKey: apiKey });
    const { object } = await generateObject({
      model: googleProvider('gemini-1.5-flash'),
      schema: z.object({
        rootCause: z.string().describe('Detailed explanation of why the error is happening.'),
        suggestedFix: z.string().describe('Clear, step-by-step instructions or the exact command/code to fix the issue.'),
        fixedFileContent: z.string().optional().describe('The complete, rewritten source code of the file with the fix applied. Do not truncate! Provide the full file.'),
        confidenceScore: z.number().min(0).max(100).describe('Confidence score in the provided solution (0-100).'),
        isSafeToAutoFix: z.boolean().describe('Whether this fix could be run automatically without breaking other things.')
      }),
      prompt: `You are an expert Senior Software Engineer and DevOps Architect.
The user is experiencing an issue and has asked the following query:
"${query}"
${fileContext}
Analyze the ${targetFile ? 'file and the ' : ''}query. Provide the root cause, a suggested fix, your confidence score, and indicate if it's safe to auto-fix.`,
    });

    s.stop('AI Analysis Complete.');

    p.note(object.rootCause, 'Root Cause');
    p.note(object.suggestedFix, 'Suggested Fix');
    
    const color = object.confidenceScore > 80 ? chalk.green : object.confidenceScore > 50 ? chalk.yellow : chalk.red;
    p.log.info(`Confidence Score: ${color(object.confidenceScore.toString() + '%')}`);

    if (targetFile && object.fixedFileContent && object.fixedFileContent.trim() !== fileContent.trim()) {
      const applyFix = await p.confirm({
         message: `Do you want DevHeal to automatically apply this fix to ${targetFile}?`,
         initialValue: true
      });

      if (!p.isCancel(applyFix) && applyFix) {
         const filePath = path.resolve(cwd, targetFile);
         await fs.writeFile(filePath, object.fixedFileContent, 'utf8');
         p.log.success(`Successfully applied fix to ${targetFile}!`);
      } else {
         p.log.info('Fix bypassed.');
      }
    } else if (targetFile) {
      p.log.info(`No fundamental code changes required for ${targetFile}.`);
    }

  } catch (err: any) {
    s.stop('AI diagnosis failed.');
    p.log.error(`AI API Error: ${err.message}`);
  }
}
