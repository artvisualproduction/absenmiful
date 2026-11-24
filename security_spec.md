# Firestore Security Specification — Direct Cloud Firestore Mode

## Architecture Decisions
- **No Firebase Authentication** and **No Firebase Admin SDK**: Requested explicitly by the user so the school's built-in username/password login (`superadmin`, `admin`, `kepsek`, `guru`) and 1-Click Quick Login work directly on both Google AI Studio and Vercel with zero extra configuration.
- **Default Deny**: `match /{document=**} { allow read, write: if false; }` blocks all unlisted paths.
- **Strict Structural Enforcement**: Every active collection validates `isValidId(docId)`, strict `keys().hasAll(...)` + `keys().hasOnly(...)` allowlists (blocking shadow fields), enum allowlists, bounded string lengths, bounded array lengths, and append-only immutability on `activityLogs`.
- **Recommendation**: Before exposing the app on the public internet to untrusted traffic, review `firestore.rules` and consider adding Firebase Authentication (`request.auth != null`) or restricting access.
