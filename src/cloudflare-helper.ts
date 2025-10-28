
/// <reference types="@cloudflare/workers-types" />
import { CloudflareBase } from './cloudflare-base';
import { CloudflareHelper, DefaultCloudflareplatform } from './types';




/**
 * Cloudflare Cache Response Helper
 * This class provides methods to interact with the Cloudflare cache.
 * 
 * @template TPlatform - Platform interface, defaults to DefaultCloudflareplatform
 */
export class CFCacheResponse<TPlatform extends DefaultCloudflareplatform = DefaultCloudflareplatform> extends CloudflareBase<TPlatform> {
    #cache: Cache;

    constructor(platform: Readonly<TPlatform>) {
        super(platform);

        // Access default cache using base class method
        this.#cache = this.getCacheDefault();
    }

    /**
     * Builds a cache key for the given request.
     * @param request The request to build the cache key for.
     * @param normalizeKey Optional function to normalize the cache key.
     * @returns The cache key as a Request object.
     */
    private buildCacheKey(request: Request, normalizeKey?: (url: URL) => URL): Request {
        // Guard: cache only GET and HEAD requests otherwise return safe path
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return request;
        }

        // Create url from request
        const cacheURL = new URL(request.url);

        // Normalize the cacheURL if normalizeKey function is provided
        const normalizedURL = normalizeKey ? normalizeKey(cacheURL) : cacheURL;

        // Assertion: origin must be the same
        if (cacheURL.origin !== normalizedURL.origin) {
            throw new Error('Cache key origin must match request origin');
        }

        // Return new Request cloned from original request with normalized URL        
        return new Request(normalizedURL.toString(), request);
    }

    /**
     * Create a new Response with updated headers
     * The new Response has to be created to make headers mutable
     * @param response response to update
     * @param headers headers to set on the new Response
     * @returns new Response with updated headers
     */
    private updateHeaders(response: Response, headers: Record<string, string>) {
        const updatedHeaders = new Headers(response.headers);
        for (const [key, value] of Object.entries(headers)) {
            updatedHeaders.set(key, value);
        }
        // Make headers mutable by creating a new Response
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: updatedHeaders
        });
    }

    /**
     * Matches a request in the cache and returns the cached response if found
     * @param request The request to match in the cache
     * @param cacheOptions Optional cache options for key normalization
     * @returns The cached response or null if not found
     */
    async match(request: Request, cacheOptions?: CloudflareHelper.CacheOptions): Promise<Response | null> {

        // Build cache key
        const cacheKey = this.buildCacheKey(request, cacheOptions?.normalizeKey);
        if (!cacheKey) {
            return null;
        }

        // Check if the request is in cache
        const hit:Response = await this.#cache.match(cacheKey) as Response;
        if(hit) {
            // Set x-cache header to indicate cache hit
            return this.updateHeaders(hit, { 'x-cache': 'HIT' });
        } else {
            return null;
        }
    }

    /**
     * Takes a request and response and caches the response
     * The Response headers can be modified before caching via cacheOptions
     * Waits until the caching is complete before returning
     * @param request 
     * @param response 
     * @param cacheOptions 
     * @returns 
     */
    async put(request: Request, response: Response, cacheOptions?: CloudflareHelper.CacheOptions): Promise<Response> {
        // Build cache key
        const cacheKey = this.buildCacheKey(request, cacheOptions?.normalizeKey);
        if (!cacheKey) {
            throw new Error('Invalid cache key');
        }

        // Set headers if provided
        if (cacheOptions?.headers) {
            // Create a new Response with updated headers
            response = this.updateHeaders(response, cacheOptions.headers);
        }

        // Put the response in cache
        // Use waitUntil to avoid blocking the response
        this.getContext().waitUntil(
            this.#cache.put(cacheKey, response.clone())
        );
        return response;
    }

    /**
     * Deletes a cached response based on the provided request or URL
     * @param deleteRequestOrURL - The Request, URL, or string URL to delete from cache
     * @param cacheOptions - Optional cache options for key normalization and base request
     * @returns A promise that resolves to true if the cached response was deleted, false otherwise
     */
    async delete(deleteRequestOrURL: Request | URL | string, cacheOptions?: CloudflareHelper.CacheOptions): Promise<boolean> {

        // Check deleteRequestOrURL type and create Request
        let deleteRequestUrl: string =  deleteRequestOrURL instanceof Request ?
            deleteRequestOrURL.url :
            deleteRequestOrURL instanceof URL ?
                deleteRequestOrURL.toString() :
                deleteRequestOrURL;
       
        // Check for absolute URL
        const pattern = /^https?:\/\//i;
        if(!pattern.test(deleteRequestUrl)) {
            if(cacheOptions?.baseRequest) {
                deleteRequestUrl = new URL(deleteRequestUrl, cacheOptions.baseRequest.url).toString();
            } else {
                throw new Error('Base URL is required for relative delete URL');
            }
        }

        // Check for method in cacheOptions
        const method = cacheOptions?.method ?? 'GET';

        // Build Request for deletion
        const deleteRequest = new Request(deleteRequestUrl, { method: method });
    
        // Build cache key
        const cacheKey = this.buildCacheKey(deleteRequest, cacheOptions?.normalizeKey);

        if (cacheOptions?.debug) {
            console.debug('[cache.delete]', cacheKey.method, cacheKey.url);
        }

        // Delete the cached response
        const deleted = await this.#cache.delete(cacheKey);
        return deleted;
    }
}

/**
 * Cloudflare R2 Storage Helper
 * This class provides methods to interact with R2 buckets.
 * 
 * @template TPlatform - Platform interface, defaults to DefaultCloudflareplatform
 */
export class CFR2<TPlatform extends DefaultCloudflareplatform = DefaultCloudflareplatform> extends CloudflareBase<TPlatform> {
    // R2 limits
    private static readonly MAX_METADATA_SIZE = 8192; // 8KB
    private static readonly MAX_KEY_LENGTH = 1024;

    constructor(platform: Readonly<TPlatform>) {
        super(platform);
    }

    /**
     * Validates bucket name
     * @param bucketName - Name of the bucket to validate
     * @throws Error if bucket name is invalid
     */
    private validateBucketName(bucketName: string): void {
        if (!bucketName || typeof bucketName !== 'string') {
            throw new Error('Bucket name must be a non-empty string');
        }
        if (bucketName.trim().length === 0) {
            throw new Error('Bucket name cannot be empty');
        }
    }

    /**
     * Validates object key
     * @param key - Key to validate
     * @throws Error if key is invalid
     */
    private validateKey(key: string): void {
        if (!key || typeof key !== 'string') {
            throw new Error('Key must be a non-empty string');
        }
        if (key.length > CFR2.MAX_KEY_LENGTH) {
            throw new Error(`Key length cannot exceed ${CFR2.MAX_KEY_LENGTH} characters`);
        }
    }

    /**
     * Validates metadata size
     * @param metadata - Metadata object to validate
     * @throws Error if metadata exceeds size limit
     */
    private validateMetadata(metadata: Record<string, string>): void {
        const metadataSize = JSON.stringify(metadata).length;
        if (metadataSize > CFR2.MAX_METADATA_SIZE) {
            throw new Error(`Metadata size (${metadataSize} bytes) exceeds limit of ${CFR2.MAX_METADATA_SIZE} bytes`);
        }
    }
    
    getBucket(bucketName: string): R2Bucket | null {
        this.validateBucketName(bucketName);
        return this.getBinding<R2Bucket>(bucketName);
    }
  
    getBucketNames() {
        const bucketNames: CloudflareHelper.R2BucketInfo[] = [];
        const env = this.getEnv();
        
        for (const [key, value] of Object.entries(env)) {
            // Check if the value is an R2Bucket instance
            if (value && typeof value === 'object' && 'get' in value && 'put' in value) {
                bucketNames.push({ name: key });
            }
        }
        return bucketNames;
    }

    async getBucketData(bucket: string, key: string): Promise<R2ObjectBody | null> {
        this.validateBucketName(bucket);
        this.validateKey(key);
        
        const R2Bucket = this.getBucket(bucket);
        if (!R2Bucket) {
            throw new Error(`Bucket '${bucket}' not found`);
        }
        return await R2Bucket.get(key);
    }

    //setMetadata(R2Object: R2Object, headers: Record<string, string>) {
    //    const _headers = new CFHeaders();
    //    R2Object?.writeHttpMetadata(_headers);
    //    for (const [key, value] of Object.entries(headers)) {
    //        _headers.set(key, value);   
    //    }
    //    return _headers;
    //}

    createUniqueKey(file: File, useFileName=true) {
        // Generate unique key
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'jpg'; // maybe not good; throw error?
        const name = file.name.split('.').slice(0, -1).join('.');
        let keyPart = name;
        if(!useFileName) {
            keyPart = crypto.randomUUID().substring(0, 8);
        }
        const key = `${timestamp}-${keyPart}.${extension}`;
        return key;
    }

    setHttpMetadata(metadata: R2HTTPMetadata ) {
        let httpMetadata: Record<string, string>= {};
        httpMetadata['contentType'] = metadata.contentType || 'application/octet-stream';
        if(metadata.cacheControl) {
            httpMetadata['cacheControl'] = metadata.cacheControl;
        }
        if(metadata.contentDisposition) {
            httpMetadata['contentDisposition'] = metadata.contentDisposition;
        }
        if(metadata.contentLanguage) {
            httpMetadata['contentLanguage'] = metadata.contentLanguage;
        }
        if(metadata.contentEncoding) {
            httpMetadata['contentEncoding'] = metadata.contentEncoding;
        }
        return httpMetadata;
    }

    setCustomMetadata(metadata: CloudflareHelper.CustomMetadata) {
        let customMetadata: Record<string, string>= {};
        customMetadata['originalFileName'] = metadata.file.name;
        customMetadata['uploadedBy'] = metadata.userId || 'anonymous';
        customMetadata['uploadedAt'] = new Date().toISOString();
        customMetadata['fileSize'] = metadata.file.size.toString();
        customMetadata['mimeType'] = metadata.file.type;
        customMetadata['category'] = metadata.category || 'general';
        customMetadata['processed'] = metadata.processed || 'false';
        customMetadata['thumbnailGenerated'] = metadata.thumbnailGenerated || 'false';

        // Validate metadata size
        this.validateMetadata(customMetadata);
        
        return customMetadata;
    }

    async listBucketData(name: string, options: R2ListOptions): Promise<{
        objects: R2Object[];
        cursor: string | undefined;
        hasMore: boolean;
    }> {
        this.validateBucketName(name);
        
        const bucket = this.getBucket(name);
        if (!bucket) {
            throw new Error(`Bucket '${name}' not found`);
        }

        const listed = await bucket.list(options);
        let truncated = listed.truncated;
        let cursor: string | undefined = truncated ? (listed as R2Objects & { cursor?: string }).cursor : undefined;
        
        while (truncated && cursor) {
            const next = await bucket.list({ ...options, cursor });
            listed.objects.push(...next.objects);
            truncated = next.truncated;
            cursor = truncated ? (next as R2Objects & { cursor?: string }).cursor : undefined;
        }
        
        return {
            objects: listed.objects,
            cursor: cursor,
            hasMore: truncated
        };
    }
}