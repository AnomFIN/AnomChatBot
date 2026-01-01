/**
 * AI Engine
 * Handles OpenAI integration and response generation
 */
import OpenAI from 'openai';
import logger from '../utils/logger.js';

class AIEngine {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
    this.connected = false;
    this.lastError = null;
  }

  /**
   * Initialize and test connection
   */
  async initialize() {
    try {
      // Test API connection
      await this.client.models.list();
      this.connected = true;
      logger.info('OpenAI connection established');
      return true;
    } catch (error) {
      this.connected = false;
      this.lastError = error.message;
      logger.error('Failed to connect to OpenAI:', error);
      return false;
    }
  }

  /**
   * Generate AI response based on conversation history
   */
  async generateResponse(messages, settings = {}) {
    if (!this.connected) {
      throw new Error('OpenAI not connected');
    }

    try {
      const { aiAggressiveness = 0.5 } = settings;

      // Adjust temperature based on settings
      const temperature = 0.7 + (aiAggressiveness * 0.3);
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info('AI response generated successfully');
      return content;

    } catch (error) {
      this.lastError = error.message;
      logger.error('AI generation failed:', error);
      
      // Don't crash on AI failure
      if (error.status === 429) {
        throw new Error('OpenAI rate limit reached. Try again later.');
      }
      throw error;
    }
  }

  /**
   * Analyze media content (images, videos)
   */
  async analyzeMedia(mediaUrl, mediaType, context = '') {
    if (!this.connected) {
      throw new Error('OpenAI not connected');
    }

    try {
      // For images, use vision model
      if (mediaType === 'image') {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: context || 'Describe this image naturally, as a human would in a WhatsApp chat.'
                },
                {
                  type: 'image_url',
                  image_url: { url: mediaUrl }
                }
              ]
            }
          ],
          max_tokens: 300
        });

        return response.choices[0]?.message?.content || 'I see the image';
      }

      // For other media, return placeholder
      return `Received ${mediaType}`;

    } catch (error) {
      this.lastError = error.message;
      logger.error('Media analysis failed:', error);
      return `Received ${mediaType}`;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      lastError: this.lastError,
      model: 'gpt-4-turbo-preview'
    };
  }

  /**
   * Reconnect to OpenAI
   */
  async reconnect() {
    logger.info('Attempting to reconnect to OpenAI...');
    return await this.initialize();
  }
}

export default AIEngine;
