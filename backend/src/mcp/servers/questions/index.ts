/**
 * Questions MCP Tools (ST-160)
 *
 * Tools for managing agent questions during workflow execution.
 * Questions are detected from Claude CLI TEXT patterns and answered via --resume.
 */

import * as answerQuestion from './answer_question';
import * as getPendingQuestions from './get_pending_questions';
import * as handoffSession from './handoff_session';

export const tools = {
  answer_question: answerQuestion,
  get_pending_questions: getPendingQuestions,
  handoff_session: handoffSession,
};

export { answerQuestion, getPendingQuestions, handoffSession };
