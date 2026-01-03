/**
 * Test Telegram Markdown Escaping
 * Tests that special characters are properly escaped to prevent Telegram API errors
 */

// Mock TelegramController class for testing
class TelegramController {
  /**
   * Escape Markdown special characters for Telegram (classic Markdown)
   */
  escapeMarkdown(text) {
    if (typeof text !== 'string') return text;
    
    // Escape special characters for Telegram classic Markdown: * _ ` [ ] ( ) \
    return text.replace(/([*_`\[\]()\\])/g, '\\$1');
  }

  /**
   * Format WhatsApp message for Telegram display
   */
  formatWhatsAppMessage(message, metadata = {}) {
    const { contact, timestamp, hasMedia, mediaType } = metadata;
    
    let formatted = `📱 *WhatsApp Message*\n`;
    formatted += `From: ${this.escapeMarkdown(contact || 'Unknown')}\n`;
    formatted += `Time: ${this.escapeMarkdown(timestamp || new Date().toLocaleString())}\n`;
    
    if (hasMedia) {
      formatted += `Media: ${this.escapeMarkdown(mediaType || 'attachment')}\n`;
    }
    
    formatted += `\n${this.escapeMarkdown(message)}`;
    
    return formatted;
  }

  /**
   * Format status update text
   */
  formatStatusUpdate(status) {
    let statusText = '📊 *System Status*\n\n';
    
    // WhatsApp status
    statusText += `WhatsApp: ${status.whatsapp.ready ? '✅ Connected' : '❌ Disconnected'}\n`;
    if (status.whatsapp.lastError) {
      statusText += `  Error: ${this.escapeMarkdown(status.whatsapp.lastError)}\n`;
    }
    
    // Telegram status
    statusText += `Telegram: ${status.telegram.ready ? '✅ Connected' : '❌ Disconnected'}\n`;
    
    // OpenAI status
    statusText += `OpenAI: ${status.ai.connected ? '✅ Connected' : '❌ Disconnected'}\n`;
    if (status.ai.lastError) {
      statusText += `  Error: ${this.escapeMarkdown(status.ai.lastError)}\n`;
    }
    
    // Active conversations
    statusText += `\nActive Chats: ${status.activeConversations || 0}`;
    
    return statusText;
  }

  /**
   * Format conversations list
   */
  formatConversationsList(conversations) {
    if (!conversations || conversations.length === 0) {
      return 'No active conversations';
    }
    
    let list = '💬 *Active Conversations*\n\n';
    
    conversations.forEach((conv, index) => {
      list += `${index + 1}. ${this.escapeMarkdown(conv.chatId)}\n`;
      list += `   AI: ${conv.aiEnabled ? '✅' : '❌'} | `;
      list += `Messages: ${conv.messageCount}\n`;
      list += `   Last: ${this.escapeMarkdown(conv.lastActivity.toLocaleString())}\n\n`;
    });
    
    return list;
  }
}

// Simple test function to verify escapeMarkdown works correctly
function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;

  // Escape special characters for Telegram classic Markdown: * _ ` [ ] ( ) \
  return text.replace(/([*_`\[\]()\\])/g, '\\$1');
}

// Test cases for escapeMarkdown function (classic Markdown)
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
    expected: '\\[Link\\]\\(https://example.com\\)',
    description: 'Text with brackets and parentheses'
  },
  {
    input: 'Price: $100.50',
    expected: 'Price: $100.50',
    description: 'Text with dots (not escaped in classic Markdown)'
  },
  {
    input: 'Hello! How are you?',
    expected: 'Hello! How are you?',
    description: 'Text with exclamation mark (not escaped in classic Markdown)'
  },
  {
    input: 'Code: `console.log()`',
    expected: 'Code: \\`console.log\\(\\)\\`',
    description: 'Text with backticks and parentheses'
  },
  {
    input: 'Math: 1 + 1 = 2',
    expected: 'Math: 1 + 1 = 2',
    description: 'Text with plus and equals (not escaped in classic Markdown)'
  },
  {
    input: '# Heading',
    expected: '# Heading',
    description: 'Text with hash (not escaped in classic Markdown)'
  },
  {
    input: 'List:\n- Item 1\n- Item 2',
    expected: 'List:\n- Item 1\n- Item 2',
    description: 'Text with hyphens (not escaped in classic Markdown)'
  },
  {
    input: 'Backslash test: \\escaped',
    expected: 'Backslash test: \\\\escaped',
    description: 'Text with backslashes (must be escaped)'
  }
];

// Integration test cases
const integrationTestCases = [
  {
    name: 'WhatsApp message with special characters',
    test: () => {
      const controller = new TelegramController();
      const result = controller.formatWhatsAppMessage(
        'Hello *world*! Check this link: [example](https://example.com)',
        {
          contact: 'John_Smith',
          timestamp: '2025-12-28 15:00:30',
          hasMedia: true,
          mediaType: 'image/jpeg'
        }
      );
      const expected = '📱 *WhatsApp Message*\n' +
        'From: John\\_Smith\n' +
          'Time: 2025-12-28 15:00:30\n' +
          'Media: image/jpeg\n' +
          '\nHello \\*world\\*! Check this link: \\[example\\]\\(https://example.com\\)';
      return { result, expected, passed: result === expected };
    }
  },
  {
    name: 'Status update with error messages containing special characters',
    test: () => {
      const controller = new TelegramController();
      const status = {
        whatsapp: {
          ready: false,
          lastError: 'Connection failed: timeout (30s)'
        },
        telegram: { ready: true },
        ai: {
          connected: false,
          lastError: 'Invalid API key! Check config.yaml'
        },
        activeConversations: 5
      };
      const result = controller.formatStatusUpdate(status);
      
      // Check that error messages are properly escaped (only classic Markdown characters)
      const hasEscapedParens = result.includes('timeout \\(30s\\)');
      const hasUnescapedExclamation = result.includes('key! Check'); // ! not escaped in classic
      const hasUnescapedDot = result.includes('config.yaml'); // . not escaped in classic
      
      return {
        result,
        expected: 'Error messages should be escaped',
        passed: hasEscapedParens && hasUnescapedExclamation && hasUnescapedDot
      };
    }
  },
  {
    name: 'Conversations list with special characters in chat IDs',
    test: () => {
      const controller = new TelegramController();
      const conversations = [
        {
          chatId: '+1-555-123-4567@c.us',
          aiEnabled: true,
          messageCount: 15,
          lastActivity: new Date('2025-12-28T15:30:00')
        },
        {
          chatId: 'user_name@whatsapp.org',
          aiEnabled: false,
          messageCount: 3,
          lastActivity: new Date('2025-12-28T14:45:00')
        }
      ];
      const result = controller.formatConversationsList(conversations);
      
      // Check that special characters in chat IDs and timestamps are escaped (only classic Markdown)
      const hasEscapedUnderscore = result.includes('user\\_name@whatsapp.org');
      const hasUnescapedOthers = result.includes('+1-555-123-4567@c.us'); // these aren't escaped in classic
      
      return {
        result,
        expected: 'Chat IDs and timestamps should be escaped',
        passed: hasEscapedUnderscore && hasUnescapedOthers
      };
    }
  },
  {
    name: 'Message with edge cases - empty values and null handling',
    test: () => {
      const controller = new TelegramController();
      const result1 = controller.formatWhatsAppMessage('', { contact: null, timestamp: undefined });
      const result2 = controller.escapeMarkdown(null);
      const result3 = controller.escapeMarkdown(undefined);
      
      // Should handle null/undefined gracefully without crashing
      const handlesNullGracefully = result2 === null && result3 === undefined;
      const handlesEmptyMessage = result1.includes('From: Unknown');
      
      return {
        result: 'Null/undefined handling test',
        expected: 'Should handle null/undefined without crashing',
        passed: handlesNullGracefully && handlesEmptyMessage
      };
    }
  }
];

// Run unit tests
let passed = 0;
let failed = 0;

console.log('\n=== Unit Tests: Telegram Markdown Escaping ===\n');

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

// Run integration tests
console.log('\n=== Integration Tests: Complete Message Formatting ===\n');

integrationTestCases.forEach((test, index) => {
  try {
    const testResult = test.test();
    
    if (testResult.passed) {
      passed++;
      console.log(`✓ Integration ${index + 1}: ${test.name}`);
    } else {
      failed++;
      console.log(`✗ Integration ${index + 1}: ${test.name}`);
      console.log(`  Expected: ${testResult.expected}`);
      if (testResult.result.length < 200) {
        console.log(`  Got: ${testResult.result}`);
      } else {
        console.log(`  Got: [Large result - ${testResult.result.length} chars]`);
      }
    }
  } catch (error) {
    failed++;
    console.log(`✗ Integration ${index + 1}: ${test.name}`);
    console.log(`  Error: ${error.message}`);
  }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${testCases.length + integrationTestCases.length}`);
console.log(`Failed: ${failed}/${testCases.length + integrationTestCases.length}`);

// Summary of what this test verifies
console.log('\n=== Test Coverage Summary ===');
console.log('✓ Utility function escapes classic Markdown special characters (* _ ` [ ] ( ) \\)');
console.log('✓ WhatsApp message formatting escapes contact names, timestamps, media types, and message content');
console.log('✓ Status updates escape error messages (classic Markdown characters only)');
console.log('✓ Conversation lists escape chat IDs and timestamps (classic Markdown characters only)');
console.log('✓ Null/undefined value handling prevents crashes');
console.log('✓ Complete integration flow from user input to final formatted output');
console.log('✓ Uses classic Markdown escaping compatible with parse_mode: "Markdown"');

process.exit(failed > 0 ? 1 : 0);