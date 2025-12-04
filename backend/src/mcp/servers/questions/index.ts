/**
 * Questions MCP Tools (ST-160, ST-172)
 *
 * Tools for managing agent questions during workflow execution.
 * Questions are detected from Claude CLI TEXT patterns and answered via --resume.
 * ST-172: Added create_agent_question for hook-triggered question creation.
 */

import * as answerQuestion from './answer_question';
import * as createAgentQuestion from './create_agent_question';
import * as getPendingQuestions from './get_pending_questions';
import * as handoffSession from './handoff_session';

export const tools = {
  answer_question: answerQuestion,
  create_agent_question: createAgentQuestion,
  get_pending_questions: getPendingQuestions,
  handoff_session: handoffSession,
};

export { answerQuestion, createAgentQuestion, getPendingQuestions, handoffSession };
