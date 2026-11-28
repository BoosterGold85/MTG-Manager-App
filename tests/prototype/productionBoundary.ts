import {readFileSync} from 'node:fs';
// v0.6.27 boundary: production bytes are compared raw against tests/data/production-boundary-v0.6.27.json.
// The v0.6.26 activation exceptions (version strings, mounts, a test version constant) are no longer stripped:
// those bytes are on main and recorded in the new manifest. Reviewed changes are listed in docs/PROTECTION-REVIEW.md.
export function productionBoundaryBytes(path:string):Buffer{
 return readFileSync(new URL('../../'+path,import.meta.url));
}
