import type { DefaultCloudflareplatform } from './types';

/**
 * Base class for Cloudflare Workers integrations
 * Provides single point of access to Cloudflare platform APIs
 * 
 * @template TPlatform - Platform interface, defaults to DefaultCloudflareplatform
 */
export class CloudflareBase<TPlatform extends DefaultCloudflareplatform = DefaultCloudflareplatform> {
    protected platform: Readonly<TPlatform>;
    
    constructor(platform: Readonly<TPlatform>) {
        this.platform = platform;
    }

    /**
     * Get the platform object - this contains the Cloudflare Workers environment
     * @returns The readonly platform object
     */
    protected getPlatform(): Readonly<TPlatform> {
        return this.platform;
    }

    /**
     * Get specific binding from environment
     * @param name - Name of the binding
     * @returns The binding value or null if not found
     */
    protected getBinding<T>(name: string): T | null {
        const env = this.getEnv();
        if (name in env) {
            return env[name] as T;
        }
        return null;
    }
    
    /**
     * Get the Cloudflare Workers environment object
     * @returns The environment object containing bindings
     */
    protected getEnv(): TPlatform['env'] {
        return this.platform.env;
    }

    /**
     * Get the execution context for waitUntil and passThroughOnException
     * @returns The execution context
     */
    protected getContext(): TPlatform['ctx'] {
        return this.platform.ctx;
    }

    /**
     * Get the default cache from Cloudflare Workers
     * @returns The default cache instance
     */
    protected getCacheDefault(): Cache {
        return this.platform.caches.default;
    }

    /**
     * Get the Cloudflare request properties
     * @returns The cf properties from the request
     */
    protected getCfProperties(): TPlatform['cf'] {
        return this.platform.cf;
    }

    /**
     * Get the cache storage interface
     * @returns The caches object containing named caches and default cache
     */
    protected getCacheStorage(): TPlatform['caches'] {
        return this.platform.caches;
    }

    /**
     * Get the Cloudflare Workers context functions
     * @returns Object with waitUntil and passThroughOnException functions
     */
    protected getExecutionContext(): TPlatform['ctx'] {
        return this.platform.ctx;
    }
}