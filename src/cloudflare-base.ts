import { App } from './types';

/**
 * Base class for Cloudflare Workers integrations
 * Provides single point of access to Cloudflare platform APIs
 */
export class CloudflareBase {
    protected platform: Readonly<App.Platform>;
    
    constructor(platform: Readonly<App.Platform>) {
        if (!platform) {
            throw new Error('Platform is required for Cloudflare operations');
        }
        this.platform = platform;
    }
    
    /**
     * Get the platform object
     * @returns The Cloudflare platform object
     */
    protected getPlatform(): Readonly<App.Platform> {
        return this.platform;
    }
    
    /**
     * Get the default cache instance
     * @returns The default Cache instance
     */
    protected getCacheDefault(): Cache {
        if (!this.platform.caches) {
            throw new Error('Caches API is not available in this environment');
        }
        return this.platform.caches.default;
    }
    
    /**
     * Get the execution context for waitUntil operations
     * @returns The execution context
     */
    protected getContext(): App.Platform['ctx'] {
        if (!this.platform.ctx) {
            throw new Error('Execution context is not available');
        }
        return this.platform.ctx;
    }
    
    /**
     * Get environment bindings (R2, D1, KV, etc.)
     * @returns The environment object with bindings
     */
    protected getEnv(): Record<string, unknown> {
        if (!this.platform.env) {
            throw new Error('Environment is not available');
        }
        return this.platform.env;
    }
    
    /**
     * Get a specific environment binding by name
     * @param name - The name of the binding
     * @returns The binding or null if not found
     */
    protected getBinding<T = unknown>(name: string): T | null {
        const env = this.getEnv();
        return (env[name] as T) || null;
    }
    
    /**
     * Check if a binding exists
     * @param name - The name of the binding
     * @returns True if the binding exists
     */
    protected hasBinding(name: string): boolean {
        const env = this.getEnv();
        return name in env && env[name] !== undefined;
    }
}