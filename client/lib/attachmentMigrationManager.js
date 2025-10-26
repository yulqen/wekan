/**
 * Attachment Migration Manager
 * Handles migration of attachments from old structure to new structure
 * with UI feedback and spinners for unconverted attachments
 */

import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveCache } from '/imports/reactiveCache';

// Reactive variables for attachment migration progress
export const attachmentMigrationProgress = new ReactiveVar(0);
export const attachmentMigrationStatus = new ReactiveVar('');
export const isMigratingAttachments = new ReactiveVar(false);
export const unconvertedAttachments = new ReactiveVar([]);

// Global tracking of migrated boards (persistent across component reinitializations)
const globalMigratedBoards = new Set();

class AttachmentMigrationManager {
  constructor() {
    this.migrationCache = new Map(); // Cache migrated attachment IDs
    this.migratedBoards = new Set(); // Track boards that have been migrated
  }

  /**
   * Check if an attachment needs migration
   * @param {string} attachmentId - The attachment ID to check
   * @returns {boolean} - True if attachment needs migration
   */
  needsMigration(attachmentId) {
    if (this.migrationCache.has(attachmentId)) {
      return false; // Already migrated
    }

    try {
      const attachment = ReactiveCache.getAttachment(attachmentId);
      if (!attachment) return false;

      // Check if attachment has old structure (no meta field or missing required fields)
      return !attachment.meta || 
             !attachment.meta.cardId || 
             !attachment.meta.boardId ||
             !attachment.meta.listId;
    } catch (error) {
      console.error('Error checking if attachment needs migration:', error);
      return false;
    }
  }

  /**
   * Check if a board has been migrated
   * @param {string} boardId - The board ID
   * @returns {boolean} - True if board has been migrated
   */
  isBoardMigrated(boardId) {
    return globalMigratedBoards.has(boardId);
  }

  /**
   * Check if a board has been migrated (server-side check)
   * @param {string} boardId - The board ID
   * @returns {Promise<boolean>} - True if board has been migrated
   */
  async isBoardMigratedServer(boardId) {
    return new Promise((resolve) => {
      Meteor.call('attachmentMigration.isBoardMigrated', boardId, (error, result) => {
        if (error) {
          console.error('Error checking board migration status:', error);
          resolve(false);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get all unconverted attachments for a board
   * @param {string} boardId - The board ID
   * @returns {Array} - Array of unconverted attachments
   */
  getUnconvertedAttachments(boardId) {
    try {
      const attachments = ReactiveCache.getAttachments({
        'meta.boardId': boardId
      });

      return attachments.filter(attachment => this.needsMigration(attachment._id));
    } catch (error) {
      console.error('Error getting unconverted attachments:', error);
      return [];
    }
  }

  /**
   * Start migration for attachments in a board
   * @param {string} boardId - The board ID
   */
  async startAttachmentMigration(boardId) {
    if (isMigratingAttachments.get()) {
      return; // Already migrating
    }

    // Check if this board has already been migrated (client-side check first)
    if (globalMigratedBoards.has(boardId)) {
      if (process.env.DEBUG === 'true') {
        console.log(`Board ${boardId} has already been migrated (client-side), skipping`);
      }
      return;
    }

    // Double-check with server-side check
    const serverMigrated = await this.isBoardMigratedServer(boardId);
    if (serverMigrated) {
      if (process.env.DEBUG === 'true') {
        console.log(`Board ${boardId} has already been migrated (server-side), skipping`);
      }
      globalMigratedBoards.add(boardId); // Sync client-side tracking
      return;
    }

    isMigratingAttachments.set(true);
    attachmentMigrationStatus.set('Starting attachment migration...');
    attachmentMigrationProgress.set(0);

    try {
      const unconverted = this.getUnconvertedAttachments(boardId);
      unconvertedAttachments.set(unconverted);

      if (unconverted.length === 0) {
        attachmentMigrationStatus.set('All attachments are already migrated');
        attachmentMigrationProgress.set(100);
        isMigratingAttachments.set(false);
        globalMigratedBoards.add(boardId); // Mark board as migrated
        if (process.env.DEBUG === 'true') {
          console.log(`Board ${boardId} has no attachments to migrate, marked as migrated`);
        }
        return;
      }

      // Start server-side migration
      Meteor.call('attachmentMigration.migrateBoardAttachments', boardId, (error, result) => {
        if (error) {
          console.error('Failed to start attachment migration:', error);
          const errorMessage = error.message || error.reason || error.toString();
          attachmentMigrationStatus.set(`Migration failed: ${errorMessage}`);
          isMigratingAttachments.set(false);
        } else {
          if (process.env.DEBUG === 'true') {
            console.log('Attachment migration started for board:', boardId);
          }
          this.pollAttachmentMigrationProgress(boardId);
        }
      });

    } catch (error) {
      console.error('Error starting attachment migration:', error);
      attachmentMigrationStatus.set(`Migration failed: ${error.message}`);
      isMigratingAttachments.set(false);
    }
  }

  /**
   * Poll for attachment migration progress
   * @param {string} boardId - The board ID
   */
  pollAttachmentMigrationProgress(boardId) {
    const pollInterval = setInterval(() => {
      Meteor.call('attachmentMigration.getProgress', boardId, (error, result) => {
        if (error) {
          console.error('Error getting migration progress:', error);
          clearInterval(pollInterval);
          isMigratingAttachments.set(false);
          return;
        }

        if (result) {
          attachmentMigrationProgress.set(result.progress);
          attachmentMigrationStatus.set(result.status);
          unconvertedAttachments.set(result.unconvertedAttachments || []);

          // Stop polling if migration is complete
          if (result.progress >= 100 || result.status === 'completed') {
            clearInterval(pollInterval);
            isMigratingAttachments.set(false);
            this.migrationCache.clear(); // Clear cache to refresh data
            globalMigratedBoards.add(boardId); // Mark board as migrated
            if (process.env.DEBUG === 'true') {
              console.log(`Board ${boardId} migration completed and marked as migrated`);
            }
          }
        }
      });
    }, 1000);
  }

  /**
   * Check if an attachment is currently being migrated
   * @param {string} attachmentId - The attachment ID
   * @returns {boolean} - True if attachment is being migrated
   */
  isAttachmentBeingMigrated(attachmentId) {
    const unconverted = unconvertedAttachments.get();
    return unconverted.some(attachment => attachment._id === attachmentId);
  }

  /**
   * Get migration status for an attachment
   * @param {string} attachmentId - The attachment ID
   * @returns {string} - Migration status ('migrated', 'migrating', 'unmigrated')
   */
  getAttachmentMigrationStatus(attachmentId) {
    if (this.migrationCache.has(attachmentId)) {
      return 'migrated';
    }

    if (this.isAttachmentBeingMigrated(attachmentId)) {
      return 'migrating';
    }

    return this.needsMigration(attachmentId) ? 'unmigrated' : 'migrated';
  }
}

export const attachmentMigrationManager = new AttachmentMigrationManager();





