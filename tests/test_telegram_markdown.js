/**
 * Test Telegram Markdown Escaping
 * Tests that special characters are properly escaped to prevent Telegram API errors
 */

// Simple test function to verify escapeMarkdown works correctly
function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;
  
  // Escape special Markdown characters: * _ [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([*_\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

// Test cases
const testCases = [
  {
    input: 'Hello world',
    expected: 'Hello world',
    description: 'Plain text without special characters'
  },
  {
    input: 'Hello *world*',
    expected: 'Hello \\*world\\*',
    description: 'Text with asterisks'
  },
  {
    input: 'This is _underlined_',
    expected: 'This is \\_underlined\\_',
    description: 'Text with underscores'
  },
  {
    input: '[Link](https://example.com)',
    expected: '\\[Link\\]\\(https://example\\.com\\)',
    description: 'Text with brackets and parentheses'
  },
  {
    input: 'Price: $100.50',
    expected: 'Price: $100\\.50',
    description: 'Text with dots'
  },
  {
    input: 'Hello! How are you?',
    expected: 'Hello\\! How are you?',
    description: 'Text with exclamation mark'
  },
  {
    input: 'Code: `console.log()`',
    expected: 'Code: \\`console\\.log\\(\\)\\`',
    description: 'Text with backticks and parentheses'
  },
  {
    input: 'Math: 1 + 1 = 2',
    expected: 'Math: 1 \\+ 1 \\= 2',
    description: 'Text with plus and equals'
  },
  {
    input: '# Heading',
    expected: '\\# Heading',
    description: 'Text with hash (heading)'
  },
  {
    input: 'List:\n- Item 1\n- Item 2',
    expected: 'List:\n\\- Item 1\n\\- Item 2',
    description: 'Text with hyphens (list markers)'
  }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n=== Testing Telegram Markdown Escaping ===\n');

testCases.forEach((test, index) => {
  const result = escapeMarkdown(test.input);
  const success = result === test.expected;
  
  if (success) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${test.description}`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: ${test.description}`);
    console.log(`  Input:    "${test.input}"`);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Got:      "${result}"`);
  }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

process.exit(failed > 0 ? 1 : 0);
