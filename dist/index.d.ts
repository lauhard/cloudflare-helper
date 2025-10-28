/// <reference types="@cloudflare/workers-types" />
import { Env, CfProperties, ExecutionContext, CacheStorage } from '@cloudflare/workers-types';

// Import types from Cloudflare Workers



// Type definitions for Cloudflare Workers platform in SvelteKit
// These types should match @cloudflare/workers-types
declare namespace CloudflareHelper {
    interface Platform {
        env: Env
        cf: CfProperties
        ctx: ExecutionContext
        caches: { default: Cache  } & CacheStorage
        
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
}

/**
 * Base class for Cloudflare Workers integrations
 * Provides single point of access to Cloudflare platform APIs
 */
declare class CloudflareBase {
    protected platform: Readonly<CloudflareHelper.Platform>;
    constructor(platform: Readonly<CloudflareHelper.Platform>);
    /**
     * Get the platform object - this contains the Cloudflare Workers environment
     * @returns The readonly platform object
     */
    protected getPlatform(): Readonly<CloudflareHelper.Platform>;
    /**
     * Get specific binding from environment
     * @param name - Name of the binding
     * @returns The binding value or null if not found
     */
    protected getBinding<T>(name: string): T | null;
    /**
     * Get the Cloudflare Workers environment object
     * @returns The environment object containing bindings
     */
    protected getEnv(): CloudflareHelper.Platform['env'];
    /**
     * Get the execution context for waitUntil and passThroughOnException
     * @returns The execution context
     */
    protected getContext(): CloudflareHelper.Platform['ctx'];
    /**
     * Get the default cache from Cloudflare Workers
     * @returns The default cache instance
     */
    protected getCacheDefault(): Cache;
    /**
     * Get the Cloudflare request properties
     * @returns The cf properties from the request
     */
    protected getCfProperties(): CloudflareHelper.Platform['cf'];
    /**
     * Get the cache storage interface
     * @returns The caches object containing named caches and default cache
     */
    protected getCacheStorage(): CloudflareHelper.Platform['caches'];
    /**
     * Get the Cloudflare Workers context functions
     * @returns Object with waitUntil and passThroughOnException functions
     */
    protected getExecutionContext(): CloudflareHelper.Platform['ctx'];
}

/**
 * Cloudflare Cache Response Helper
 * This class provides methods to interact with the Cloudflare cache.
 */
declare class CFCacheResponse extends CloudflareBase {
    #private;
    constructor(platform: Readonly<CloudflareHelper.Platform>);
    /**
     * Builds a cache key for the given request.
     * @param request The request to build the cache key for.
     * @param normalizeKey Optional function to normalize the cache key.
     * @returns The cache key as a Request object.
     */
    private buildCacheKey;
    /**
     * Create a new Response with updated headers
     * The new Response has to be created to make headers mutable
     * @param response response to update
     * @param headers headers to set on the new Response
     * @returns new Response with updated headers
     */
    private updateHeaders;
    /**
     * Matches a request in the cache and returns the cached response if found
     * @param request The request to match in the cache
     * @param cacheOptions Optional cache options for key normalization
     * @returns The cached response or null if not found
     */
    match(request: Request, cacheOptions?: CloudflareHelper.CacheOptions): Promise<Response | null>;
    /**
     * Takes a request and response and caches the response
     * The Response headers can be modified before caching via cacheOptions
     * Waits until the caching is complete before returning
     * @param request
     * @param response
     * @param cacheOptions
     * @returns
     */
    put(request: Request, response: Response, cacheOptions?: CloudflareHelper.CacheOptions): Promise<Response>;
    /**
     * Deletes a cached response based on the provided request or URL
     * @param deleteRequestOrURL - The Request, URL, or string URL to delete from cache
     * @param cacheOptions - Optional cache options for key normalization and base request
     * @returns A promise that resolves to true if the cached response was deleted, false otherwise
     */
    delete(deleteRequestOrURL: Request | URL | string, cacheOptions?: CloudflareHelper.CacheOptions): Promise<boolean>;
}
/**
 * Cloudflare R2 Storage Helper
 * This class provides methods to interact with R2 buckets.
 */
declare class CFR2 extends CloudflareBase {
    private static readonly MAX_METADATA_SIZE;
    private static readonly MAX_KEY_LENGTH;
    constructor(platform: Readonly<CloudflareHelper.Platform>);
    /**
     * Validates bucket name
     * @param bucketName - Name of the bucket to validate
     * @throws Error if bucket name is invalid
     */
    private validateBucketName;
    /**
     * Validates object key
     * @param key - Key to validate
     * @throws Error if key is invalid
     */
    private validateKey;
    /**
     * Validates metadata size
     * @param metadata - Metadata object to validate
     * @throws Error if metadata exceeds size limit
     */
    private validateMetadata;
    getBucket(bucketName: string): R2Bucket | null;
    getBucketNames(): CloudflareHelper.R2BucketInfo[];
    getBucketData(bucket: string, key: string): Promise<R2ObjectBody | null>;
    createUniqueKey(file: File, useFileName?: boolean): string;
    setHttpMetadata(metadata: R2HTTPMetadata): Record<string, string>;
    setCustomMetadata(metadata: CloudflareHelper.CustomMetadata): Record<string, string>;
    listBucketData(name: string, options: R2ListOptions): Promise<{
        objects: R2Object[];
        cursor: string | undefined;
        hasMore: boolean;
    }>;
}

export { CFCacheResponse, CFR2, CloudflareBase, CloudflareHelper };
