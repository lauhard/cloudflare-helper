# Cloudflare Helper

A TypeScript utility library for working with Cloudflare Workers, R2 storage, and Cache API in SvelteKit projects.

## Installation

Install directly from GitHub:

```bash
npm install github:lauhard/cloudflare-helper
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "@lauhard/cloudflare-helper": "github:lauhard/cloudflare-helper"
  }
}
```

## Usage

### Prerequisites

This package requires `@cloudflare/workers-types` to be installed in your project:

```bash
npm install -D @cloudflare/workers-types
```

### Basic Usage

```typescript
import { CFR2, CFCacheResponse } from '@lauhard/cloudflare-helper';

// In your SvelteKit +page.server.ts or API routes
export async function GET({ platform }) {
  // R2 Storage
  const r2 = new CFR2(platform);
  const bucket = r2.getBucket('my-bucket');
  
  // Cache
  const cache = new CFCacheResponse(platform);
  const cached = await cache.match(request);
  
  return new Response('OK');
}
```

### Default Usage (einfach)

```typescript
import { CFR2, CFCacheResponse } from '@lauhard/cloudflare-helper';

// Verwendet die Standard-Types des Packages
const r2 = new CFR2(platform);          // ✅ Funktioniert out-of-the-box
const cache = new CFCacheResponse(platform);  // ✅ Verwendet DefaultCloudflareplatform
```

### Custom Platform Types (erweitert)

Wenn Sie spezifische SvelteKit Platform-Types haben:

```typescript
// In Ihrer app.d.ts
declare global {
  namespace App {
    interface Platform {
      env: {
        MY_BUCKET: R2Bucket;
        API_KEY: string;
      };
      cf: CfProperties;
      ctx: ExecutionContext;
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }
}

// Verwenden Sie Ihre spezifischen Types
import { CFR2, CFCacheResponse } from '@lauhard/cloudflare-helper';

// TypeScript wird automatisch Ihre App.Platform Types verwenden
const r2 = new CFR2<App.Platform>(platform);           // ✅ Typsicher mit Ihren Bindings
const cache = new CFCacheResponse<App.Platform>(platform);  // ✅ Perfekte Integration

// Jetzt haben Sie Typsicherheit für Ihre spezifischen Bindings:
const bucket = r2.getBucket('MY_BUCKET'); // TypeScript weiß: das ist ein R2Bucket
```

### Hybrid Approach

```typescript
import type { DefaultCloudflareplatform } from '@lauhard/cloudflare-helper';

// Erweitern Sie nur was Sie brauchen
interface MyPlatform extends DefaultCloudflareplatform {
  env: {
    MY_BUCKET: R2Bucket;
    DATABASE: D1Database;
  } & DefaultCloudflareplatform['env'];
}

const r2 = new CFR2<MyPlatform>(platform);
```