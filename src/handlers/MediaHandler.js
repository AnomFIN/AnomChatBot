/**
 * Media Handler
 * Handles media processing for images, videos, and audio
 */
import logger from '../utils/logger.js';

class MediaHandler {
  constructor(aiEngine) {
    this.aiEngine = aiEngine;
  }

  /**
   * Process incoming media from WhatsApp
   */
  async processMedia(message) {
    try {
      if (!message.hasMedia) {
        return null;
      }

      const media = await message.downloadMedia();
      
      if (!media) {
        logger.warn('Failed to download media');
        return null;
      }

      const mediaType = this.getMediaType(media.mimetype);
      
      logger.info(`Processing ${mediaType}: ${media.mimetype}`);

      return {
        data: media.data,
        mimetype: media.mimetype,
        filename: media.filename,
        type: mediaType,
        size: media.data.length
      };

    } catch (error) {
      logger.error('Media processing failed:', error);
      return null;
    }
  }

  /**
   * Get media type from mimetype
   */
  getMediaType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype === 'application/pdf') return 'document';
    return 'file';
  }

  /**
   * Generate description for media using AI
   */
  async describeMedia(media, context = '') {
    try {
      if (media.type === 'image') {
        // Convert base64 to data URL
        const dataUrl = `data:${media.mimetype};base64,${media.data}`;
        const description = await this.aiEngine.analyzeMedia(dataUrl, 'image', context);
        return description;
      }

      if (media.type === 'video') {
        return 'Received a video';
      }

      if (media.type === 'audio') {
        return 'Received an audio message';
      }

      return `Received a ${media.type}`;

    } catch (error) {
      logger.error('Media description failed:', error);
      return `Received a ${media.type}`;
    }
  }

  /**
   * Format media for forwarding to Telegram
   */
  formatForTelegram(media) {
    if (!media) return null;

    const sizeKB = Math.round(media.size / 1024);
    const sizeMB = (sizeKB / 1024).toFixed(2);
    
    return {
      type: media.type,
      mimetype: media.mimetype,
      filename: media.filename || `file.${media.type}`,
      size: sizeKB > 1024 ? `${sizeMB} MB` : `${sizeKB} KB`
    };
  }

  /**
   * Check if media is supported for AI analysis
   */
  isAnalyzable(media) {
    return media && (media.type === 'image' || media.type === 'video');
  }
}

export default MediaHandler;
