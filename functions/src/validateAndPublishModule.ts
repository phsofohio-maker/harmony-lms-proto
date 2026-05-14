/**
 * Module Validation Publish Gate — Cloud Function.
 *
 * Callable: `validateAndPublishModule`
 * Behavior:
 *   1. Verify caller has content-author role (admin or instructor).
 *   2. Load the module, course, and per-course glossary terms.
 *   3. Run the deterministic validator.
 *   4. Persist the report to `moduleValidationReports/{moduleId}`.
 *   5. If `summary.canPublish` is true, set the module's status to "published".
 *   6. Otherwise, do not change status. Caller gets the report and a reason.
 *
 * Source of truth for module publish-readiness. Admin SDK writes bypass
 * Firestore rules — only this function can flip the module's status to
 * "published". The companion rule prevents client-side writes that would
 * change `status` to "published" through any other path.
 *
 * @module functions/src/validateAndPublishModule
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import type { Module, Course } from "./types";
import { runValidation } from "./moduleValidation/validator";
import type {
  ValidationReport,
  ValidatorGlossaryTerm,
} from "./moduleValidation/types";

const db = admin.firestore();

/**
 * Drops keys with `undefined` values so Firestore writes do not reject them.
 * @param {T} obj Source object.
 * @return {T} Same shape with undefined-valued keys removed.
 */
function sanitize<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/**
 * Loads a module document and its blocks subcollection, returning the shape
 * the validator expects (`Module.blocks: ContentBlock[]`).
 * @param {string} courseId Parent course ID.
 * @param {string} moduleId Module document ID.
 * @return {Promise<Module>} Hydrated module with blocks merged in.
 */
async function loadModule(courseId: string, moduleId: string): Promise<Module> {
  const ref = db.collection("courses").doc(courseId).collection("modules").doc(moduleId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Module ${moduleId} not found in course ${courseId}.`);
  }
  const data = snap.data() ?? {};

  // Module blocks live in a subcollection; merge them onto the module shape
  // that the validator expects (Module.blocks: ContentBlock[]).
  const blocksSnap = await ref.collection("blocks").orderBy("order").get();
  const blocks = blocksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

  return {
    id: snap.id,
    courseId,
    title: data.title ?? "",
    description: data.description ?? "",
    status: data.status ?? "draft",
    passingScore: data.passingScore ?? 0,
    estimatedMinutes: data.estimatedMinutes ?? 0,
    order: data.order,
    blocks: blocks as Module["blocks"],
    weight: data.weight ?? 0,
    isCritical: !!data.isCritical,
    availability: data.availability,
  };
}

/**
 * Loads a course document. Modules array is intentionally left empty since
 * the validator only needs the course-level fields (CE credits, category).
 * @param {string} courseId Course document ID.
 * @return {Promise<Course>} Hydrated course.
 */
async function loadCourse(courseId: string): Promise<Course> {
  const snap = await db.collection("courses").doc(courseId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Course ${courseId} not found.`);
  }
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    title: data.title ?? "",
    description: data.description ?? "",
    category: data.category ?? "compliance",
    ceCredits: data.ceCredits ?? 0,
    thumbnailUrl: data.thumbnailUrl ?? "",
    status: data.status,
    modules: [],
    estimatedHours: data.estimatedHours ?? 0,
    availability: data.availability,
    certificateTemplateDocId: data.certificateTemplateDocId,
  };
}

/**
 * Loads glossary terms for the course. Returns an empty array (logging a
 * warning) on any failure — the glossary check is advisory, not blocking.
 * @param {string} courseId Course document ID.
 * @return {Promise<ValidatorGlossaryTerm[]>} Glossary terms, or [] on failure.
 */
async function loadGlossary(courseId: string): Promise<ValidatorGlossaryTerm[]> {
  try {
    const snap = await db.collection("glossary").doc(courseId).collection("terms").get();
    return snap.docs.map((d) => ({
      id: d.id,
      term: (d.data() as { term?: string }).term ?? "",
    }));
  } catch (err) {
    logger.warn("Failed to load glossary terms; continuing without", { courseId, err });
    return [];
  }
}

/**
 * Appends an immutable audit log entry. Metadata is sanitized before write.
 * @param {string} actorId UID of the user performing the action.
 * @param {string} actorName Display name for readability.
 * @param {string} actionType Audit action type (see auditService).
 * @param {string} targetId ID of the resource affected.
 * @param {string} details Human-readable description.
 * @param {Record<string, unknown> | undefined} metadata Optional context.
 * @return {Promise<void>}
 */
async function writeAudit(
  actorId: string,
  actorName: string,
  actionType: string,
  targetId: string,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.collection("audit_logs").add({
    actorId,
    actorName,
    actionType,
    targetId,
    details,
    timestamp: admin.firestore.Timestamp.now(),
    ...(metadata && { metadata: sanitize(metadata) }),
  });
}

export const validateAndPublishModule = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Auth required.");
  }
  const role = request.auth.token?.role;
  if (role !== "admin" && role !== "instructor") {
    throw new HttpsError(
      "permission-denied",
      "Only content authors (admin or instructor) can publish modules."
    );
  }

  const { moduleId, courseId, advisoryOverrideAck } = (request.data ?? {}) as {
    moduleId?: string;
    courseId?: string;
    advisoryOverrideAck?: boolean;
  };
  if (!moduleId || !courseId) {
    throw new HttpsError("invalid-argument", "moduleId and courseId are required.");
  }

  const actorId = request.auth.uid;
  const actorName = (request.auth.token?.name as string | undefined) ?? "unknown";

  const [module, course, glossaryTerms] = await Promise.all([
    loadModule(courseId, moduleId),
    loadCourse(courseId),
    loadGlossary(courseId),
  ]);

  const report = runValidation(module, { course, glossaryTerms });

  // Persist the report (overwrite — last run wins).
  const reportDoc: ValidationReport & {
    courseId: string;
    lastRunBy: string;
    createdAt: admin.firestore.Timestamp;
  } = {
    ...report,
    courseId,
    lastRunBy: actorId,
    createdAt: admin.firestore.Timestamp.now(),
  };
  await db.collection("moduleValidationReports").doc(moduleId).set(reportDoc);

  await writeAudit(
    actorId,
    actorName,
    "MODULE_VALIDATION_RUN",
    moduleId,
    `Validator v${report.validatorVersion} run on module ${moduleId}`,
    {
      courseId,
      blocking: report.summary.blocking,
      advisory: report.summary.advisory,
      informational: report.summary.informational,
      canPublish: report.summary.canPublish,
    }
  );

  if (!report.summary.canPublish) {
    await writeAudit(
      actorId,
      actorName,
      "MODULE_PUBLISH_BLOCKED",
      moduleId,
      `Publish blocked by ${report.summary.blocking} blocking issue(s)`,
      {
        courseId,
        issues: report.issues
          .filter((i) => i.severity === "BLOCKING")
          .map((i) => ({ checkId: i.checkId, message: i.message, location: i.location })),
      }
    );
    return {
      success: false as const,
      report,
      reason: "BLOCKING_ISSUES",
    };
  }

  if (report.summary.advisory > 0) {
    await writeAudit(
      actorId,
      actorName,
      "MODULE_VALIDATION_ADVISORY_OVERRIDE",
      moduleId,
      `Module published with ${report.summary.advisory} advisory warning(s)`,
      {
        courseId,
        acknowledged: !!advisoryOverrideAck,
        issues: report.issues
          .filter((i) => i.severity === "ADVISORY")
          .map((i) => ({ checkId: i.checkId, message: i.message, location: i.location })),
      }
    );
  }

  await db
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .doc(moduleId)
    .update({
      status: "published",
      publishedAt: admin.firestore.Timestamp.now(),
      publishedBy: actorId,
    });

  await writeAudit(
    actorId,
    actorName,
    "MODULE_PUBLISH_SUCCESS",
    moduleId,
    `Module ${moduleId} published`,
    { courseId, validatorVersion: report.validatorVersion }
  );

  return {
    success: true as const,
    report,
  };
});
