# ADR-001: Multi-Tenant Architecture & Certificate Issuance

**Status:** Accepted
**Date:** 2026-04-10
**Authors:** Parrish Health Systems Engineering

---

## Context

HHCALMS is entering Phase 3, which introduces the CE Credit Vault (clinical certifications). Before building the certificate pipeline, we must resolve architectural questions about multi-tenancy and certificate identity that affect data modeling, security rules, and credential format.

Parrish Health Systems is the sole tenant today. However, the architecture should not preclude adding a second organization without a rewrite. The decisions below balance "ship now for Parrish" against "don't paint ourselves into a corner."

---

## Decision 1: Organization Isolation Model

**Decision:** `orgId` field on every top-level document.

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Subcollection pattern (`organizations/{orgId}/courses/...`) | Strongest Firestore rule isolation; queries scoped by default | Requires restructuring all existing queries; breaks current data; higher migration cost |
| `orgId` field on every document | Zero migration for existing data (default all docs to `parrish`); simpler queries with `where` clause; existing code works unchanged | Relies on `where('orgId', '==', ...)` discipline; weaker isolation without security rules |

**Rationale:** The `orgId` field approach requires zero structural migration. All existing documents receive `orgId: 'parrish'` as a default. New queries add a `where` clause. When a second tenant is onboarded, Firestore security rules can enforce `request.resource.data.orgId == request.auth.token.orgId` at that time. For a single-tenant deployment, the field is informational overhead only.

**Migration Plan:**
1. Add `orgId: 'parrish'` to all new document writes immediately
2. Backfill existing documents via a one-time script (non-blocking — queries work without it)
3. When second tenant is added: enforce `orgId` in security rules and add composite indexes

---

## Decision 2: Auth Claims for Multi-Org

**Decision:** Single-org model: `{ role: 'instructor', orgId: 'parrish' }`.

**Options Considered:**

| Option | Format | When to adopt |
|--------|--------|---------------|
| Single org (chosen) | `{ role: 'instructor', orgId: 'parrish' }` | Now — matches current `UserRoleType` model |
| Multi-org | `{ roles: { parrish: 'instructor', other: 'admin' } }` | Only if a user must belong to 2+ orgs simultaneously |

**Rationale:** No current or near-term requirement for cross-org users. The multi-org model adds complexity to every role check. If needed later, a migration adds the `roles` map and deprecates the flat `role` field — this is a one-time change to `AuthContext` and security rules, not a rewrite.

---

## Decision 3: Certification Scope

**Decision:** `orgName` and `issuerName` are global org-level config stored in `organizations/{orgId}`.

**Document structure:**
```typescript
// organizations/parrish
{
  id: 'parrish',
  name: 'Parrish Health Systems',
  issuerName: 'Parrish Health Systems Education Department',
  certPrefix: 'PHS',
  logoUrl: '...',
  createdAt: Timestamp,
}
```

**Rationale:** Organization-level config changes rarely and applies uniformly to all certificates. Per-course override is unnecessary — if a course needs a different issuer, it belongs to a different org. Storing this in a single document avoids duplicating org metadata across every course.

---

## Decision 4: Certificate ID Format

**Decision:** Org-prefixed with date and short unique suffix: `PHS-20260410-A7F3`

**Format:** `{ORG_PREFIX}-{YYYYMMDD}-{4-char hex}`

**Options Considered:**

| Format | Example | Pros | Cons |
|--------|---------|------|------|
| UUID | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | Globally unique, zero collision | Not human-readable; hard to communicate verbally |
| Sequential | `PARRISH-CERT-001` | Clean, simple | Requires atomic counter; leaks issuance volume |
| Org-prefixed + date + hash (chosen) | `PHS-20260410-A7F3` | Human-readable; date context; org-identifiable; no counter needed | Theoretical collision (1-in-65536 per org per day) — acceptable at current scale |

**Collision mitigation:** If a collision occurs (same org, same day, same 4 hex chars), append an additional 4 hex chars. At Parrish's volume (~50 certs/month), this will never trigger.

---

## Decision 5: Email Notification on Certificate Issuance

**Decision:** Out of scope for v1.

**Rationale:** The Firebase Trigger Email extension requires SMTP configuration and testing. Certificates are accessible immediately via MyGrades. Email notification can be added as a Phase 4 enhancement using the `mail` collection pattern (write a doc → extension sends email). The certificate pipeline is designed so that adding email is a single `db.collection('mail').add(...)` call after certificate creation — no architectural changes needed.

---

## Summary of Decisions

| Question | Decision |
|----------|----------|
| Org isolation | `orgId` field on documents |
| Auth claims | Single-org: `{ role, orgId }` |
| Cert scope | Global org config in `organizations` collection |
| Cert ID format | `{PREFIX}-{YYYYMMDD}-{4hex}` |
| Email on issuance | Out of scope for v1 |

---

## Certificate Data Model

```typescript
interface Certificate {
  id: string;              // e.g., "PHS-20260410-A7F3"
  certId: string;          // Same as id — human-readable cert number
  userId: string;
  courseId: string;
  orgId: string;
  issuedAt: Timestamp;
  grade: number;
  ceCredits: number;
  courseName: string;
  studentName: string;
  issuerName: string;
  pdfStoragePath: string;  // Firebase Storage path
  templateDocId?: string;  // Google Doc template ID (if generated via Docs API)
  generatedDocId?: string; // Generated Google Doc ID
  status: 'pending' | 'generated' | 'failed';
}
```

**Firestore path:** `certificates/{certId}`
**Storage path:** `certificates/{orgId}/{userId}/{courseId}/{certId}.pdf`

---

*Harmony Health LMS -- Parrish Health Systems*
*ADR approved April 10, 2026*
