#!/usr/bin/env npx tsx

/**
 * Update story statuses using MCP tools
 */

// Stories with merged PRs should be marked as "done"
const MERGED_STORIES = [
  'ST-8', 'ST-9', 'ST-10', 'ST-11', 'ST-14', 'ST-16', 'ST-17', 'ST-18',
  'ST-26', 'ST-27', 'ST-28', 'ST-36', 'ST-37', 'ST-38', 'ST-39', 'ST-40',
  'ST-41', 'ST-42', 'ST-44', 'ST-45', 'ST-46', 'ST-47', 'ST-48', 'ST-50',
  'ST-54', 'ST-56', 'ST-57', 'ST-58', 'ST-59', 'ST-60', 'ST-61', 'ST-62',
  'ST-63', 'ST-68', 'ST-69', 'ST-70', 'ST-71', 'ST-72', 'ST-73', 'ST-74',
  'ST-75', 'ST-76', 'ST-77', 'ST-79', 'ST-80', 'ST-82', 'ST-83', 'ST-85'
];

// Stories with open PRs or in progress
const IN_PROGRESS_STORIES = ['ST-64', 'ST-86'];

// Generate MCP update commands
console.log('#!/bin/bash\n');
console.log('# Auto-generated script to update story statuses\n');

console.log('echo "Updating merged stories to done status..."');
MERGED_STORIES.forEach(key => {
  console.log(`claude mcp call vibestudio update_story '{"storyKey":"${key}","status":"done"}' || echo "Failed to update ${key}"`);
});

console.log('\necho "Updating in-progress stories..."');
IN_PROGRESS_STORIES.forEach(key => {
  console.log(`claude mcp call vibestudio update_story '{"storyKey":"${key}","status":"impl"}' || echo "Failed to update ${key}"`);
});

console.log('\necho "Done!"');
