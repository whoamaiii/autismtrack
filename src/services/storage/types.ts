/**
 * Storage Provider Interface
 * Abstraction layer for encrypted/unencrypted storage backends
 */

import type { z } from 'zod';

/**
 * Abstract storage provider interface
 * Implementations: PlaintextStorage, EncryptedStorage (Android/Web)
 */
export interface StorageProvider {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns Parsed value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Get a value with Zod schema validation
   * @param key - Storage key
   * @param schema - Zod schema for validation
   * @param fallback - Fallback value if not found or invalid
   */
  getValidated<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T>;

  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store (will be JSON serialized)
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Remove a value from storage
   * @param key - Storage key to remove
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all storage
   */
  clear(): Promise<void>;

  /**
   * Get all storage keys
   */
  keys(): Promise<string[]>;

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get storage type identifier
   */
  readonly type: 'plaintext' | 'encrypted';
}

/**
 * Options for encrypted storage provider
 */
export interface EncryptedStorageOptions {
  /**
   * The encryption key (derived from device key + salt)
   */
  encryptionKey: CryptoKey;

  /**
   * Storage backend to use
   */
  backend: 'localStorage' | 'indexedDB' | 'filesystem';

  /**
   * Key prefix for namespacing
   */
  keyPrefix?: string;
}

/**
 * Storage error types
 */
export interface StorageError {
  code: StorageErrorCode;
  message: string;
  key?: string;
  originalError?: Error;
}

export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'KEY_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

/**
 * Storage event types for multi-tab sync
 */
export interface StorageChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  source: 'local' | 'remote';
}

/**
 * Migration state tracking
 */
export interface MigrationState {
  version: number;
  migratedKeys: string[];
  failedKeys: string[];
  startedAt: string;
  completedAt?: string;
  errors: Array<{
    key: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Storage metrics for debugging
 */
export interface StorageMetrics {
  totalKeys: number;
  totalSizeBytes: number;
  encryptedKeys: number;
  lastAccess: string;
}
