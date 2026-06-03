// Fix for scratch file listing R2 objects
// Cloudflare worker types are usually not available in the main React Native project node_modules.
// We use 'any' or local interfaces to bypass the type errors in scratch scripts.

export interface Env {
  AUDIO_BUCKET: any; // Using any instead of R2Bucket to avoid "Cannot find name 'R2Bucket'"
}

export default {
  async fetch(request: Request, env: Env) {
    const listed = await env.AUDIO_BUCKET.list();
    
    // Explicitly typing 'obj' to avoid "Parameter 'obj' implicitly has an 'any' type"
    return listed.objects.map((obj: { key: string }) => obj.key);
  }
};
