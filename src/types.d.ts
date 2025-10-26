// Import types from Cloudflare Workers

/// <reference types="@cloudflare/workers-types" />
import type { 
    CfProperties, 
    ExecutionContext,
    CacheStorage
} from '@cloudflare/workers-types';

// Type definitions for Cloudflare Workers platform in SvelteKit
// These types should match @cloudflare/workers-types
declare namespace App {
    interface Platform {
        env: Env
        cf: CfProperties
        context: ExecutionContext
        caches: { default: Cache  } & CacheStorage
        ctx: {
            waitUntil(promise: Promise<unknown>): void;
            passThroughOnException(): void;
        };
    }
        interface R2BucketInfo {
        name: string
    }

    interface BucketOptions {
        limit?: number;
        include: string[];
    }

    interface CacheOptions {
        normalizeKey?: (url: URL) => URL,
        headers?: Record<string, string>,
        baseRequest?: Request,
        method?: 'GET' | 'HEAD';
        debug?: boolean;
    }
    interface CustomMetadata{
        file: File, 
        userId?: string, 
        category?: string, 
        processed?: string, 
        thumbnailGenerated?: string
    }
    // Generic environment interface - users can extend this in their projects
    interface Env {
        [key: string]: unknown;
    }
}

export { App };


