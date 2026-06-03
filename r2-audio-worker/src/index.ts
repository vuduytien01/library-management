/// <reference types="@cloudflare/workers-types" />
export interface Env {
  AUDIO_BUCKET: R2Bucket;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));

    // List all objects
    if (key === 'list' || key === '_list') {
      const listed = await env.AUDIO_BUCKET.list({ limit: 1000 });
      const objects = listed.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded?.toISOString(),
      }));
      return new Response(JSON.stringify(objects, null, 2), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (!key) {
      return new Response('Object key is required in path', { status: 400, headers: CORS_HEADERS });
    }

    // Handle GET/HEAD request with Range support
    if (request.method === 'GET' || request.method === 'HEAD') {
      const range = request.headers.get('range');
      
      let object: R2Object | R2ObjectBody | null;
      
      // Parse Range header for R2
      if (range) {
        // R2 get() accepts an R2Range object or string
        // We can pass the header directly or parse it. Passing it usually works best.
        object = await env.AUDIO_BUCKET.get(key, { range: request.headers });
      } else {
        object = await env.AUDIO_BUCKET.get(key);
      }

      if (object === null) {
        return new Response('Object Not Found', { status: 404, headers: CORS_HEADERS });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      
      // Set proper content type for audio
      const lowKey = key.toLowerCase();
      if (lowKey.endsWith('.mp3')) {
        headers.set('Content-Type', 'audio/mpeg');
      } else if (lowKey.endsWith('.m4a')) {
        headers.set('Content-Type', 'audio/mp4');
      } else if (lowKey.endsWith('.wav')) {
        headers.set('Content-Type', 'audio/wav');
      }

      // Add CORS headers
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        headers.set(k, v);
      }

      // If it's a range request, return 206 Partial Content
      const status = range && (object as R2ObjectBody).body ? 206 : 200;
      
      // For R2ObjectBody, the body property exists
      const body = 'body' in object ? object.body : null;

      return new Response(request.method === 'HEAD' ? null : body, { 
        status,
        headers 
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  },
};
