# TrustVault Threat Model & Security Defense Matrix

This document describes the TrustVault threat model, likely attack scenarios, intended defenses, verification evidence, and known limitations. It is a security design and review artifact; implementation status must be confirmed against the current source code, tests, configuration, and deployment.

> **Status and evidence note:** The matrix below records defenses described for TrustVault. A path, test name, or commit reference is not proof that the control is currently implemented or that a test passes. Mark a control as implemented only after checking the current code and running the relevant test. Avoid absolute guarantees such as “no risk,” “instantaneous,” or “zero-window” unless they are supported by evidence and clearly scoped.

---

## 1. System Philosophy: Zero Trust & Separation of Duties

TrustVault's security design follows these principles:

1. **Deny access by default:** A user must not be able to access a document unless they own it or have an explicit permission grant.
2. **Server-side authorization:** The backend must enforce access controls on every protected API request. Client-side UI state is not an authorization boundary.
3. **Revocation-aware access:** Protected read and download requests should check the current permission state. Avoid distributing long-lived direct-access URLs when the requirement is that revoked access must stop working.
4. **Separation of duties:** Administrative privileges should not automatically grant access to confidential document contents. Administrative access to a document should require an explicit, documented authorization rule.
5. **Tamper-evident auditability:** Record relevant successful and denied access attempts without logging passwords, bearer tokens, or document contents. Hash chaining can help detect modifications, but does not make a database absolutely immutable.

---

## 2. Threat Analysis Matrix (STRIDE-Informed)

| Threat ID | Threat vector and attack scenario | Severity | Intended / documented mitigation | Verification evidence to check | Residual risk / trade-off |
| --- | --- | --- | --- | --- | --- |
| **TV-T01** | **Insecure Direct Object Reference (IDOR):** An attacker changes the document ID in `/api/documents/:id` or `/api/documents/:id/download` to try to access another user's document. | **Critical** | Backend authorization should load the requested document and verify that the requester is the owner or has an explicit permission grant. Unauthorized requests should be denied. | Check `checkDocumentAccess` and all document routes. Run relevant cases in `tests/documentAccess.test.js`, including metadata and download access using another user's document ID. | Route-by-route omissions, alternate endpoints, or inconsistent permission logic can reintroduce IDOR. Do not claim “no risk”; verify every protected route. |
| **TV-T02** | **Stale authorization after revocation:** A user continues accessing a document using an old link or cached permission state after their access is revoked. | **Critical** | The documented design uses an authenticated download endpoint such as `GET /api/documents/:id/download`, with current permissions checked server-side for each new request. Avoid direct-access URLs that remain valid after revocation. | Check the download implementation and run `tests/revocation.test.js` if present. Revoke a grant and verify a subsequent request is denied. | A request already in progress may not be cancellable. Database consistency, caching, and streaming behavior affect when revocation takes effect. Avoid claiming a fixed millisecond guarantee without measurements. |
| **TV-T03** | **Audit trail tampering:** An attacker or insider with database access alters or deletes records to conceal unauthorized access. | **High** | The documented design uses sequence numbers and a SHA-256 hash chain with a `previousHash` link, a verification routine such as `verifyAuditChain`, and model hooks to block selected update/delete operations. | Inspect the audit model and logger. Run `tests/auditIntegrity.test.js` if present. Test modified, missing, reordered, and inserted records. | A database administrator with broad write access may rewrite the chain. External immutable storage, separate credentials, or periodic external hash anchoring would improve detection. |
| **TV-T04** | **Unrestricted administrative access:** An administrator uses elevated privileges to read confidential documents without the owner's permission. | **High** | Administrative privileges should not bypass document-level authorization. Require ownership or an explicit permission grant for document contents, unless a separately documented policy says otherwise. | Inspect authorization middleware and test admin access to metadata and downloads for documents not granted to that admin. Check `tests/documentAccess.test.js` if present. | An attacker with direct server or database access may bypass application-level checks. Restrict infrastructure access and use appropriate encryption and monitoring. |
| **TV-T05** | **File-type spoofing:** An attacker uploads an executable or malformed file while claiming it is a PDF or image. | **High** | Validate file signatures (magic bytes) from the file buffer; do not trust the client-provided MIME type alone. Enforce size and type limits. Consider malware scanning and safe file-serving headers. | Inspect upload middleware and `validateFileSignature` or equivalent. Test valid files, mismatched MIME types, malformed files, and unsupported types. Confirm relevant tests exist and pass. | Magic-byte checks alone do not prove a file is safe or fully valid. Polyglot files and parser vulnerabilities remain possible; antivirus scanning and content-specific validation may be needed. |
| **TV-T06** | **Path traversal through filenames:** An attacker supplies a filename such as `../../etc/passwd` or a Windows traversal path to attempt unsafe file writes. | **High** | Do not use the client filename as the storage path. Generate a server-side UUID or other opaque storage key, constrain storage to a private directory, and sanitize the displayed original filename separately. | Inspect the upload storage code and file-security helpers, such as `backend/src/utils/fileSecurity.js` or `uploadValidator.js` if those files exist. Test traversal-style filenames on supported platforms. | Incorrect path construction elsewhere or unsafe use of a displayed filename can still create risks. Verify storage paths are resolved and constrained correctly. |
| **TV-T07** | **Direct access to private files:** Files are exposed through a public web root or an `express.static` mapping such as `/uploads/secret.pdf`. | **Critical** | Store files outside the public web root and serve them through authenticated, authorized routes only. Ensure no static mapping exposes the private storage directory. | Inspect server setup, static route mappings, storage configuration, and download routes. Attempt to request a stored file directly without authentication. | Misconfiguration in another service, backup, or deployment may expose files. Recheck production configuration, not just local development. |
| **TV-T08** | **Privilege escalation at registration:** A user sends `"role": "admin"` in the public registration payload. | **High** | Public registration should assign a fixed low-privilege role on the server and ignore or reject client-supplied privileged roles. | Inspect `/api/auth/register` and the user model. Run `tests/auth.test.js` if present; register with a forged role and verify the stored and returned role remains the allowed default. | Other user-update or admin-management endpoints may contain separate privilege-escalation paths. Test those routes independently. |
| **TV-T09** | **Credential stuffing and brute-force login attempts:** An automated client repeatedly guesses passwords at `/api/auth/login`. | **Medium** | Use password hashing (the project documentation references `bcryptjs` with 12 salt rounds) and configure login rate limiting, for example with `express-rate-limit`. Log failed attempts without recording credentials. | Inspect login middleware and configuration to confirm the actual limits. Test rate-limit behavior and failed-login audit events if relevant tests exist. | IP-based rate limits can be bypassed by distributed sources and may affect users behind shared IPs. Consider progressive delays, account protections, monitoring, and a challenge service where appropriate. |
| **TV-T10** | **Sensitive data in audit logs:** Logs accidentally contain passwords, bearer tokens, or document contents. | **High** | Use an explicit allowlist of audit fields. Exclude passwords, tokens, file bytes, and other secrets; sanitize values before logging. | Inspect the audit logger (the source document references `src/utils/auditLogger.js`) and tests/fixtures. Search for secret-bearing fields and verify redaction behavior. | Metadata such as document IDs, names, email addresses, or IP addresses can still be sensitive. Restrict access and define retention and redaction policies. |
| **TV-T11** | **Unauthorized metadata enumeration:** A user lists documents and learns the titles or existence of documents they have not been granted. | **High** | The document-list endpoint should filter results to documents owned by the requester or explicitly shared with them. Apply authorization before returning metadata. | Inspect the `/api/documents` query and test that an ungranted document is absent from list results and cannot be fetched directly. Check `tests/documentAccess.test.js` if present. | Search, count, pagination, error messages, or alternate endpoints may still leak metadata if they use different authorization logic. |
| **TV-T12** | **Client-side authorization bypass:** An attacker changes React state, browser storage, or UI controls to reveal an Edit button or claim an administrator role. | **Critical** | Treat frontend permissions as presentation only. Enforce authorization on the backend for every read, download, create, edit, and delete action. | Call protected API routes directly with a low-privilege account and verify unauthorized operations are denied, regardless of UI state. Review backend authorization tests. | A frontend-only test cannot establish backend security. Every sensitive route and object-level operation must be covered. |

---

## 3. Known Limitations and Accepted Trade-offs

### 3.1 In-database hash chaining vs. independent integrity anchors

- **Documented design:** Audit records are linked with SHA-256 hashes and sequence information inside MongoDB.
- **Limitation:** An attacker with sufficient write access to the database may alter records and recompute subsequent hashes. Mongoose hooks do not stop direct database writes.
- **Trade-off and improvement:** Hash chaining can help detect isolated or accidental changes. For stronger assurance, store periodic chain checkpoints outside the database, use independently controlled immutable storage, and restrict database credentials.

### 3.2 Streaming performance vs. revocation-aware downloads

- **Documented design:** Document downloads are intended to pass through the Express server so current permissions can be checked for each new request.
- **Limitation:** Streaming large files through application servers consumes bandwidth, connections, and compute resources. A request that has already started may continue after a permission change unless the application explicitly handles cancellation.
- **Trade-off and improvement:** This design supports revocation checks for new requests but requires load testing, stream limits, timeouts, and careful handling of concurrent revocation. Do not claim revocation occurs within a specific number of milliseconds without measured evidence.

### 3.3 Soft deletion vs. secure erasure

- **Documented design:** The original threat model describes marking a document as deleted (for example, `isDeleted: true`) while retaining its audit reference.
- **Limitation:** Soft deletion does not erase the underlying file bytes. The actual deletion behavior must be confirmed in the current code.
- **Trade-off and improvement:** Retaining audit references can support investigation, but retention requirements vary by jurisdiction and data type. If secure erasure is required, consider a documented retention policy, backup-expiration behavior, and encryption-key destruction where appropriate. Do not assume that regulatory rules always require retaining every document.

---

## 4. Verification Checklist Before Claiming a Control Is Implemented

- [ ] Confirm the referenced source files exist in the current repository.
- [ ] Confirm every protected document route performs server-side authorization.
- [ ] Run the relevant automated tests and record their actual results.
- [ ] Test unauthorized access, administrator access without a grant, and access after revocation.
- [ ] Verify private storage is not exposed by static routes or deployment configuration.
- [ ] Verify upload signature checks, size limits, storage-key generation, and filename handling.
- [ ] Verify audit records exclude secrets and that hash-chain verification detects tampering.
- [ ] Review residual risks and avoid absolute claims that are not supported by evidence.

## 5. Summary

TrustVault's intended security approach centers on least privilege, server-side authorization, revocation-aware downloads, private file storage, input validation, and tamper-evident audit logging. The effectiveness of these controls depends on their implementation and testing. This threat model should be kept aligned with the current codebase and updated when architecture, routes, storage, or permissions change.
