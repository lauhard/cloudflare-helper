// src/cloudflare-base.ts
var CloudflareBase = class {
  platform;
  constructor(platform) {
    this.platform = platform;
  }
  /**
   * Get the platform object - this contains the Cloudflare Workers environment
   * @returns The readonly platform object
   */
  getPlatform() {
    return this.platform;
  }
  /**
   * Get specific binding from environment
   * @param name - Name of the binding
   * @returns The binding value or null if not found
   */
  getBinding(name) {
    const env = this.getEnv();
    if (name in env) {
      return env[name];
    }
    return null;
  }
  /**
   * Get the Cloudflare Workers environment object
   * @returns The environment object containing bindings
   */
  getEnv() {
    return this.platform.env;
  }
  /**
   * Get the execution context for waitUntil and passThroughOnException
   * @returns The execution context
   */
  getContext() {
    return this.platform.ctx;
  }
  /**
   * Get the default cache from Cloudflare Workers
   * @returns The default cache instance
   */
  getCacheDefault() {
    return this.platform.caches.default;
  }
  /**
   * Get the Cloudflare request properties
   * @returns The cf properties from the request
   */
  getCfProperties() {
    return this.platform.cf;
  }
  /**
   * Get the cache storage interface
   * @returns The caches object containing named caches and default cache
   */
  getCacheStorage() {
    return this.platform.caches;
  }
  /**
   * Get the Cloudflare Workers context functions
   * @returns Object with waitUntil and passThroughOnException functions
   */
  getExecutionContext() {
    return this.platform.context;
  }
};

// src/cloudflare-helper.ts
var CFCacheResponse = class extends CloudflareBase {
  #cache;
  constructor(platform) {
    super(platform);
    this.#cache = this.getCacheDefault();
  }
  /**
   * Builds a cache key for the given request.
   * @param request The request to build the cache key for.
   * @param normalizeKey Optional function to normalize the cache key.
   * @returns The cache key as a Request object.
   */
  buildCacheKey(request, normalizeKey) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return request;
    }
    const cacheURL = new URL(request.url);
    const normalizedURL = normalizeKey ? normalizeKey(cacheURL) : cacheURL;
    if (cacheURL.origin !== normalizedURL.origin) {
      throw new Error("Cache key origin must match request origin");
    }
    return new Request(normalizedURL.toString(), request);
  }
  /**
   * Create a new Response with updated headers
   * The new Response has to be created to make headers mutable
   * @param response response to update
   * @param headers headers to set on the new Response
   * @returns new Response with updated headers
   */
  updateHeaders(response, headers) {
    const updatedHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) {
      updatedHeaders.set(key, value);
    }
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
  async match(request, cacheOptions) {
    const cacheKey = this.buildCacheKey(request, cacheOptions?.normalizeKey);
    if (!cacheKey) {
      return null;
    }
    const hit = await this.#cache.match(cacheKey);
    if (hit) {
      return this.updateHeaders(hit, { "x-cache": "HIT" });
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
  async put(request, response, cacheOptions) {
    const cacheKey = this.buildCacheKey(request, cacheOptions?.normalizeKey);
    if (!cacheKey) {
      throw new Error("Invalid cache key");
    }
    if (cacheOptions?.headers) {
      response = this.updateHeaders(response, cacheOptions.headers);
    }
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
  async delete(deleteRequestOrURL, cacheOptions) {
    let deleteRequestUrl = deleteRequestOrURL instanceof Request ? deleteRequestOrURL.url : deleteRequestOrURL instanceof URL ? deleteRequestOrURL.toString() : deleteRequestOrURL;
    const pattern = /^https?:\/\//i;
    if (!pattern.test(deleteRequestUrl)) {
      if (cacheOptions?.baseRequest) {
        deleteRequestUrl = new URL(deleteRequestUrl, cacheOptions.baseRequest.url).toString();
      } else {
        throw new Error("Base URL is required for relative delete URL");
      }
    }
    const method = cacheOptions?.method ?? "GET";
    const deleteRequest = new Request(deleteRequestUrl, { method });
    const cacheKey = this.buildCacheKey(deleteRequest, cacheOptions?.normalizeKey);
    if (cacheOptions?.debug) {
      console.debug("[cache.delete]", cacheKey.method, cacheKey.url);
    }
    const deleted = await this.#cache.delete(cacheKey);
    return deleted;
  }
};
var CFR2 = class _CFR2 extends CloudflareBase {
  // R2 limits
  static MAX_METADATA_SIZE = 8192;
  // 8KB
  static MAX_KEY_LENGTH = 1024;
  constructor(platform) {
    super(platform);
  }
  /**
   * Validates bucket name
   * @param bucketName - Name of the bucket to validate
   * @throws Error if bucket name is invalid
   */
  validateBucketName(bucketName) {
    if (!bucketName || typeof bucketName !== "string") {
      throw new Error("Bucket name must be a non-empty string");
    }
    if (bucketName.trim().length === 0) {
      throw new Error("Bucket name cannot be empty");
    }
  }
  /**
   * Validates object key
   * @param key - Key to validate
   * @throws Error if key is invalid
   */
  validateKey(key) {
    if (!key || typeof key !== "string") {
      throw new Error("Key must be a non-empty string");
    }
    if (key.length > _CFR2.MAX_KEY_LENGTH) {
      throw new Error(`Key length cannot exceed ${_CFR2.MAX_KEY_LENGTH} characters`);
    }
  }
  /**
   * Validates metadata size
   * @param metadata - Metadata object to validate
   * @throws Error if metadata exceeds size limit
   */
  validateMetadata(metadata) {
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > _CFR2.MAX_METADATA_SIZE) {
      throw new Error(`Metadata size (${metadataSize} bytes) exceeds limit of ${_CFR2.MAX_METADATA_SIZE} bytes`);
    }
  }
  getBucket(bucketName) {
    this.validateBucketName(bucketName);
    return this.getBinding(bucketName);
  }
  getBucketNames() {
    const bucketNames = [];
    const env = this.getEnv();
    for (const [key, value] of Object.entries(env)) {
      if (value && typeof value === "object" && "get" in value && "put" in value) {
        bucketNames.push({ name: key });
      }
    }
    return bucketNames;
  }
  async getBucketData(bucket, key) {
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
  createUniqueKey(file, useFileName = true) {
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const name = file.name.split(".").slice(0, -1).join(".");
    let keyPart = name;
    if (!useFileName) {
      keyPart = crypto.randomUUID().substring(0, 8);
    }
    const key = `${timestamp}-${keyPart}.${extension}`;
    return key;
  }
  setHttpMetadata(metadata) {
    let httpMetadata = {};
    httpMetadata["contentType"] = metadata.contentType || "application/octet-stream";
    if (metadata.cacheControl) {
      httpMetadata["cacheControl"] = metadata.cacheControl;
    }
    if (metadata.contentDisposition) {
      httpMetadata["contentDisposition"] = metadata.contentDisposition;
    }
    if (metadata.contentLanguage) {
      httpMetadata["contentLanguage"] = metadata.contentLanguage;
    }
    if (metadata.contentEncoding) {
      httpMetadata["contentEncoding"] = metadata.contentEncoding;
    }
    return httpMetadata;
  }
  setCustomMetadata(metadata) {
    let customMetadata = {};
    customMetadata["originalFileName"] = metadata.file.name;
    customMetadata["uploadedBy"] = metadata.userId || "anonymous";
    customMetadata["uploadedAt"] = (/* @__PURE__ */ new Date()).toISOString();
    customMetadata["fileSize"] = metadata.file.size.toString();
    customMetadata["mimeType"] = metadata.file.type;
    customMetadata["category"] = metadata.category || "general";
    customMetadata["processed"] = metadata.processed || "false";
    customMetadata["thumbnailGenerated"] = metadata.thumbnailGenerated || "false";
    this.validateMetadata(customMetadata);
    return customMetadata;
  }
  async listBucketData(name, options) {
    this.validateBucketName(name);
    const bucket = this.getBucket(name);
    if (!bucket) {
      throw new Error(`Bucket '${name}' not found`);
    }
    const listed = await bucket.list(options);
    let truncated = listed.truncated;
    let cursor = truncated ? listed.cursor : void 0;
    while (truncated && cursor) {
      const next = await bucket.list({ ...options, cursor });
      listed.objects.push(...next.objects);
      truncated = next.truncated;
      cursor = truncated ? next.cursor : void 0;
    }
    return {
      objects: listed.objects,
      cursor,
      hasMore: truncated
    };
  }
};

export { CFCacheResponse, CFR2, CloudflareBase };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map