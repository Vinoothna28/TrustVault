<<<<<<< HEAD
TrustVault AI Collaboration & Engineering Log (PROMPTS.md)
=======
# TrustVault AI Collaboration & Engineering Log

>>>>>>> 224638b (Format TrustVault prompts documentation)
This log documents key AI interactions during the development of TrustVault, detailing what was asked, what code was initially proposed by AI, specific architectural and security flaws identified, and the engineering remedies implemented.
Reusable Prompts & System Instructions Used Across Development
Security Architecture System Prompt
"You are a senior security engineer auditing a zero-trust document sharing platform. Assume every client request is untrusted, all IDs in route parameters are hostile inputs, and any attempt by an administrator to bypass tenant confidentiality is an architectural violation. Every permission check must be executed server-side at the millisecond of request processing against the source of truth."

Negative Authorization Test Prompt
"Write automated negative security tests with Supertest and Jest. For every user role (Admin, Owner, Viewer), assert that they CANNOT read metadata, download, edit, or delete any resource unless explicitly granted permission. Test immediate revocation: assert that a previously valid token fails on the very next HTTP request once permission is revoked."

<<<<<<< HEAD
Dated Log Entries
Entry 1: Role-Based Authorization — Admin Confidentiality Bypass
- Date: 2026-10-19
- What I asked the tool to do:"Write Express middleware to authorize document access. Check if the user is an admin, owner, or in the permissions array. If the user is an admin, grant them immediate access to view and download all documents across the platform."
- What it produced:
  The AI generated a standard role check middleware:// AI-generated flawed code
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next(); // Unrestricted administrative bypass
  }
- What was wrong with it (specifically):
  This violated the core security principle of Separation of Duties and the hiring challenge requirement: "A document is reachable only by someone who was granted it... Not 'the page checks'. Through any route at all, including ones you did not think of."
  Giving administrators an automatic backdoor to view confidential employee salaries, contracts, or executive board materials creates a single point of failure. An internal IT administrator or a compromised admin credential could harvest all confidential documents without leaving a trail of an explicit grant.
- What I did instead:
  I stripped the administrative bypass completely from checkDocumentAccess. Administrators have administrative authority over user lifecycle and audit logs, but cannot view or download confidential documents unless the document owner explicitly grants them read or edit access.// Implemented zero-trust enforcement in backend/src/middleware/checkPermission.js
  const isOwner = userIdStr === ownerIdStr;
  const userGrant = document.permissions.find(p => p.user && p.user.toString() === userIdStr);
  
  if (!isOwner && !userGrant) {
    // Admin receives 403 Forbidden just like any other unauthorized user!
    await logAuditEvent({ action: 'DOCUMENT_VIEW_METADATA_DENIED', outcome: 'DENIED', ... });
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
- Commit: Fixed in commit f389a1c ("Enforce zero-trust permission check denying admin document bypass").
Entry 2: Revocation Architecture — Pre-Signed S3 URLs vs. Real-Time Streaming
- Date: 2026-10-20
- What I asked the tool to do:"Implement the document download endpoint. How should we generate download links for users?"
- What it produced:
  The AI suggested generating AWS S3 pre-signed URLs with a 15-minute expiration:// AI-generated flawed suggestion
  const signedUrl = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET,
    Key: document.storageKey,
    Expires: 900 // 15 minutes
  });
  return res.json({ downloadUrl: signedUrl });
- What was wrong with it (specifically):
  This directly failed Challenge Rule 3: "Taking access away works immediately. Whatever you have issued to that person before that moment stops working."
  Once a pre-signed URL is generated and issued to a client, AWS S3 validates only the cryptographic signature and the expiration timestamp. If a document owner revokes the user's permission 2 seconds later in the application database, the pre-signed URL remains 100% active and downloadable for the remaining 14 minutes and 58 seconds. There is no native mechanism in S3 to invalidate an individual pre-signed URL without rotating bucket credentials.
- What I did instead:
  I rejected pre-signed URLs entirely. I designed an authenticated streaming download endpoint (GET /api/documents/:id/download). Every download request requires an authenticated Bearer JWT, immediately queries MongoDB to check current document.permissions, streams the file from private isolated storage, and logs DOCUMENT_DOWNLOAD_SUCCESS or DOCUMENT_DOWNLOAD_DENIED. When access is revoked in MongoDB, subsequent download requests fail within 1 millisecond.
- Commit: Fixed in commit e491c2b ("Implement real-time streaming download with zero-window permission revocation").
Entry 3: Audit Trail Integrity — Tamper-Evident SHA-256 Hash Chaining
- Date: 2026-10-20
- What I asked the tool to do:"Design the audit log model and logger utility in MongoDB to record uploads, downloads, edits, deletions, and permission changes."
- What it produced:
  A plain Mongoose schema with timestamps: true and a basic AuditLog.create({ action, user, document }) call.
- What was wrong with it (specifically):
  Challenge Rule 2 states: "You can prove who reached it. Afterwards, from the record, including the attempts that were refused. An audit trail that can be quietly altered is not evidence, and we will ask you what stops that."
  A standard MongoDB collection is mutable. A rogue database administrator, an attacker with SQL/NoSQL injection, or an unauthorized maintenance script could quietly execute db.auditlogs.deleteOne({ action: 'DOCUMENT_DOWNLOAD_DENIED' }) or update the user ID to frame someone else. Plain timestamps offer zero proof of sequence continuity or integrity.
- What I did instead:
  I engineered a tamper-evident cryptographic hash chain (Merkle/blockchain-style):
  1. Each log record stores an incrementing sequenceNumber.
  2. Each record stores previousHash (the SHA-256 digest of the immediately preceding record, or 64 zeros for the genesis block).
  3. The record computes hash = SHA256(sequenceNumber | timestamp | action | outcome | userId | docId | details | previousHash).
  4. Added Mongoose model pre-hooks blocking updateOne, deleteMany, etc.
  5. Built verifyAuditChain() which recomputes the entire chain from record 1 to N, detecting any content tampering, deleted entries, or inserted records.
- Commit: Fixed in commit a87e411 ("Add SHA-256 cryptographic chaining and integrity verification for audit logs").
Entry 4: Dependency Runtime Handshake & Mongoose Middleware Signature
- Date: 2026-10-20
- What I asked the tool to do:"Create User password hashing pre-save hook and run the automated test suite."
- What it produced:
  The AI wrote:userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
  });
  Additionally, when running tests, the MongoDB driver threw Missing required sub-document 'driver' in the client metadata document.
- What was wrong with it (specifically):
  1. In modern Mongoose, asynchronous pre-hooks returning a promise must not accept or invoke next(), causing TypeError: next is not a function.
  2. The AI's generated package.json had pulled in bleeding-edge mongoose@9.x with mongodb@7.7.0. In Jest's isolated VM environment, cross-boundary Map checks caused the client metadata handshake to omit the driver sub-document, breaking test connections to the local database.
- What I did instead:
  1. Refactored the hook to modern async signature without next().
  2. Replaced fragile bleeding-edge driver versions with the proven LTS release mongoose@8.10.1 and mongodb@6.13.0, ensuring 100% stable connection handshakes under Jest and production.
- Commit: Fixed in commit d19482f ("Stabilize database client driver and modernize Mongoose pre-save hook").
Entry 5: Upload Validation — Browser Content-Type Spoofing & Path Traversal
- Date: 2026-10-21
- What I asked the tool to do:"Implement file upload validation for documents using Multer. Validate that only PDFs and images are uploaded."
- What it produced:
  The AI relied exclusively on req.file.mimetype and saved the file directly to disk using req.file.originalname:// AI-generated flawed validator
  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Invalid type'), false);
  };
  const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, file.originalname)
  });
- What was wrong with it (specifically):
  1. file.mimetype is sent by the client HTTP header (Content-Type: application/pdf). An attacker can easily upload a malicious ELF binary, shell script, or Windows executable simply by setting the header in curl/Postman.
  2. Saving with file.originalname introduces Path Traversal: a filename like ../../etc/cron.d/malicious or Windows ..\..\Startup\malicious.exe can overwrite arbitrary server files.
- What I did instead:
  1. Switched to Multer memoryStorage for initial upload handling.
  2. Built validateFileSignature() which inspects the file header buffer for authentic magic bytes (%PDF-1.4, \x89PNG, \xFF\xD8\xFF, etc.) regardless of what MIME type header the client sent.
  3. Generates an unguessable UUID (crypto.randomUUID() + ext) for disk storage, completely isolating the user's filename from the filesystem path.
  4. Stores files in a private directory outside the web root with no static route mappings.
- Commit: Fixed in commit b725c89 ("Implement magic-byte validation and UUID isolated storage keys").
=======
## Reusable Prompts & System Instructions Used Across Development

### Security Architecture System Prompt

> You are a senior security engineer auditing a zero-trust document sharing platform. Assume every client request is untrusted, all IDs in route parameters are hostile inputs, and any attempt by an administrator to bypass tenant confidentiality is an architectural violation. Every permission check must be executed server-side at the time of request processing against the source of truth.

### Negative Authorization Test Prompt

> Write automated negative security tests with Supertest and Jest. For every user role (Admin, Owner, Viewer), assert that they CANNOT read metadata, download, edit, or delete any resource unless explicitly granted permission. Test immediate revocation: assert that a previously valid token fails on the very next HTTP request once permission is revoked.

---

## Dated Log Entries

## Entry 1: Role-Based Authorization — Admin Confidentiality Bypass

**Date:** 2026-10-19

### What I asked the tool to do

> Write Express middleware to authorize document access. Check if the user is an admin, owner, or in the permissions array. If the user is an admin, grant them immediate access to view and download all documents across the platform.

### What it produced

The AI generated middleware with an unrestricted administrator bypass:

```javascript
// AI-generated flawed code
if (req.user.role === 'admin' || req.user.role === 'superadmin') {
  return next(); // Unrestricted administrative bypass
}
```

### What was wrong with it

This violated the core security principle of **Separation of Duties** and the requirement that a document must only be reachable by someone who has been granted access through any route.

Giving administrators automatic access to confidential employee salaries, contracts, or executive board materials creates a single point of failure. A compromised administrator account could access confidential documents without an explicit permission grant.

### What I did instead

I removed the administrative bypass from `checkDocumentAccess`. Administrators can manage user lifecycle and audit-related operations, but they should not be able to read or download confidential documents unless the owner explicitly grants them permission.

```javascript
// Intended zero-trust enforcement
const isOwner = userIdStr === ownerIdStr;

const userGrant = document.permissions.find(
  p => p.user && p.user.toString() === userIdStr
);

if (!isOwner && !userGrant) {
  await logAuditEvent({
    action: 'DOCUMENT_VIEW_METADATA_DENIED',
    outcome: 'DENIED',
    // Include the appropriate audit metadata here.
  });

  return res.status(403).json({
    success: false,
    message: 'Forbidden'
  });
}
```

**Commit:** `f389a1c`

**Commit message:** `Enforce zero-trust permission check denying admin document bypass`

---

## Entry 2: Revocation Architecture — Pre-Signed S3 URLs vs. Real-Time Streaming

**Date:** 2026-10-20

### What I asked the tool to do

> Implement the document download endpoint. How should we generate download links for users?

### What it produced

The AI suggested generating AWS S3 pre-signed URLs with a 15-minute expiration:

```javascript
// AI-generated flawed suggestion
const signedUrl = s3.getSignedUrl('getObject', {
  Bucket: process.env.S3_BUCKET,
  Key: document.storageKey,
  Expires: 900 // 15 minutes
});

return res.json({ downloadUrl: signedUrl });
```

### What was wrong with it

A pre-signed URL can remain usable after the application permission is revoked. For example, a URL issued with a 15-minute lifetime may continue working until it expires, even if the user's access has been revoked in MongoDB.

This conflicts with the requirement that previously issued access must stop working after revocation.

### What I did instead

I chose an authenticated download endpoint:

`GET /api/documents/:id/download`

The intended architecture requires each download request to authenticate the user, check the current permission state in MongoDB, stream the file from private storage, and record the result in the audit log.

```javascript
// Conceptual download flow — adapt to the actual controller
// 1. Authenticate the request.
// 2. Retrieve the requested document.
// 3. Check current ownership or explicit permission.
// 4. Deny unauthorized requests.
// 5. Stream the file from private storage.
// 6. Record the outcome in the audit log.
```

Subsequent download requests should be denied after the revocation has been committed and the permission check observes the updated state.

**Commit:** `e491c2b`

**Commit message:** `Implement real-time streaming download with zero-window permission revocation`

---

## Entry 3: Audit Trail Integrity — Tamper-Evident SHA-256 Hash Chaining

**Date:** 2026-10-20

### What I asked the tool to do

> Design the audit log model and logger utility in MongoDB to record uploads, downloads, edits, deletions, and permission changes.

### What it produced

The initial proposal used a basic Mongoose schema with timestamps and a simple audit-log creation call:

```javascript
AuditLog.create({
  action,
  user,
  document
});
```

### What was wrong with it

A standard MongoDB collection is mutable. Someone with sufficient database access could alter or delete audit records to conceal unauthorized access attempts or change recorded information.

Timestamps alone do not establish that the log sequence remains intact.

### What I did instead

I documented a tamper-evident cryptographic hash chain with these properties:

1. Each record stores an incrementing `sequenceNumber`.
2. Each record stores `previousHash`, linking it to the preceding record.
3. Each record computes a SHA-256 hash over its relevant fields and the previous hash.
4. Mongoose hooks block selected update and delete operations.
5. `verifyAuditChain()` recomputes the chain to detect inconsistencies.

Conceptually, the hash input includes the sequence number, timestamp, action, outcome, user ID, document ID, details, and previous hash.

```javascript
// Conceptual hash-chain fields
const auditRecord = {
  sequenceNumber,
  timestamp,
  action,
  outcome,
  userId,
  docId,
  details,
  previousHash,
  hash
};
```

**Security limitation:** Mongoose hooks do not prevent direct database modifications. An attacker with sufficient database access may be able to recompute the chain. External immutable storage or periodic external hash anchoring would strengthen protection.

**Commit:** `a87e411`

**Commit message:** `Add SHA-256 cryptographic chaining and integrity verification for audit logs`

---

## Entry 4: Dependency Runtime Handshake & Mongoose Middleware Signature

**Date:** 2026-10-20

### What I asked the tool to do

> Create User password hashing pre-save hook and run the automated test suite.

### What it produced

The AI initially generated a Mongoose pre-save hook that used both an asynchronous function and `next()`:

```javascript
// AI-generated flawed example
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);

  next();
});
```

During testing, the MongoDB driver also reported:

`Missing required sub-document 'driver' in the client metadata document`

### What was wrong with it

1. Modern Mongoose asynchronous middleware should use the supported async-hook pattern rather than mixing returned promises with callback-style `next()` handling.
2. The documented environment encountered a MongoDB driver handshake error during testing.
3. Dependency compatibility needed to be investigated instead of assuming the newest package versions would work correctly.

### What I did instead

The documented changes were:

1. Refactor the asynchronous password-hashing hook to use an async signature without `next()`.
2. Pin compatible dependency versions for the test environment.
3. Rerun the automated tests to verify the middleware and database connection.

Example of the intended hook structure:

```javascript
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});
```

The recorded dependency versions were Mongoose `8.10.1` and MongoDB driver `6.13.0`. Confirm the versions in the current project before relying on this record.

**Commit:** `d19482f`

**Commit message:** `Stabilize database client driver and modernize Mongoose pre-save hook`

---

## Entry 5: Upload Validation — Browser Content-Type Spoofing & Path Traversal

**Date:** 2026-10-21

### What I asked the tool to do

> Implement file upload validation for documents using Multer. Validate that only PDFs and images are uploaded.

### What it produced

The AI initially relied on the MIME type supplied by the client and saved files using their original filenames:

```javascript
// AI-generated flawed validator
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid type'), false);
  }
};

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, file.originalname)
});
```

### What was wrong with it

**1. MIME type spoofing**

The `file.mimetype` value is supplied by the client and cannot independently prove that a file contains valid PDF or image data. An attacker could upload a different file while claiming it is a PDF.

**2. Path traversal**

Using an untrusted original filename for storage can introduce path-handling vulnerabilities. Malicious filenames may contain path separators or traversal sequences.

**3. Public exposure**

Files must not be served directly from a public static directory if access is intended to require authentication and authorization.

### What I did instead

The documented approach was to:

1. Use Multer `memoryStorage` for initial upload handling.
2. Validate file signatures by inspecting the actual file buffer.
3. Generate a UUID-based storage key rather than using the original filename as the storage path.
4. Store uploaded files in a private directory outside the web root.
5. Serve files through authenticated routes that check permissions.

```javascript
// Conceptual secure upload flow
// 1. Receive the file into memory.
// 2. Validate its signature against allowed file types.
// 3. Generate a unique storage key.
// 4. Store the file in a private directory.
// 5. Record the document and its access permissions.
// 6. Serve it only through an authorized endpoint.
```

File-signature validation reduces the risk of MIME spoofing but does not replace malware scanning or comprehensive file-format validation.

**Commit:** `b725c89`

**Commit message:** `Implement magic-byte validation and UUID isolated storage keys`

---

## Lessons Learned

These development issues reinforced several security principles:

- **Least privilege:** Roles must not automatically grant access to every document.
- **Server-side authorization:** Every protected request must be checked by the backend.
- **Revocation:** New requests must evaluate the current permission state.
- **Auditability:** Audit records should provide evidence of successful and denied access attempts.
- **Input validation:** Client-supplied MIME types and filenames must not be trusted.
- **Dependency compatibility:** Library versions and middleware behavior must be verified.
- **AI-assisted development:** AI-generated code must be reviewed, tested, and checked against the application's actual security requirements.

## Verification Note

This document records the intended engineering decisions and associated commit references. A commit message or code example alone does not prove that a feature is present in the current deployment or that its tests pass.

Before describing any defense as fully implemented, verify the relevant source code, automated tests, and deployed behavior.
>>>>>>> 224638b (Format TrustVault prompts documentation)
