# Scouting photo privacy policy

Implementation update: byte-magic validation supports JPEG/PNG/WebP (HEIC is rejected until a safe converter is deployed), maximum original size is 8 MB, five photos per observation, twenty per visit and 100 MB per local graph. Server-generated scoped keys, SHA-256 verification, temporary/finalized states and five-minute signed reads are implemented. GPS is stored only from explicitly approved form context. The original is never overwritten; normalized annotations are separate JSON.

Original files must live in private object storage; PostgreSQL stores only farm-scoped metadata, checksum and private key. Delivery must be authenticated or use short-lived scoped URLs. Accepted formats are JPEG, PNG and WebP after MIME/content validation; metadata not needed for capture time and optional GPS is removed. Original and annotations are separate. No face recognition or external AI upload is allowed without explicit farmer action and policy consent.

Target limits: 5 photos/observation, 4 MB compressed/photo, 100 MB local queue/user/farm. Duplicate checksum is rejected per farm. The current Sprint 27 slice defines the secure model but does not claim production object-storage or offline-binary validation; those remain NO-GO gates.
