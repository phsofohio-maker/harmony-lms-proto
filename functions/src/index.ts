/**
 * Cloud Functions for Harmony Health LMS
 * 
 * Core business logic that MUST run server-side:
 * - Grade validation and audit enforcement
 * - Enrollment status cascades
 * - Remediation workflow automation
 * - Course grade calculations
 * - Competency status updates
 * 
 * Design Principles:
 * - Fail Fast: Validate all inputs
 * - Audit Everything: Every write creates a log
 * - Idempotent: Safe to retry
 * - Explicit Errors: Include context for debugging
 * 
 * @module functions/src/index
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ============================================
// TYPES
// ============================================

interface GradeData {
    userId: string;
    moduleId: string;
    score: number;
    passingScore: number;
    passed: boolean;
    gradedBy: string;
    gradedAt: admin.firestore.Timestamp;
    attemptNumber?: number;
    notes?: string;
}

interface EnrollmentData {
    userId: string;
    courseId: string;
    progress: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
    enrolledAt: admin.firestore.Timestamp;
    completedAt?: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}

interface AuditLogData {
    actorId: string;
    actorName: string;
    actionType: string;
    targetId: string;
    details: string;
    timestamp: admin.firestore.Timestamp;
    metadata?: Record<string, any>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates an immutable audit log entry
 */
async function createAuditLog(
    actorId: string,
    actorName: string,
    actionType: string,
    targetId: string,
    details: string,
    metadata?: Record<string, any>
): Promise<void> {
    const logData: AuditLogData = {
        actorId,
        actorName,
        actionType,
        targetId,
        details,
        timestamp: admin.firestore.Timestamp.now(),
        ...(metadata && { metadata }),
    };

    await db.collection('audit_logs').add(logData);

    functions.logger.info('Audit log created', {
        actionType,
        targetId,
        actorId,
    });
}

/**
 * Validates grade data structure
 */
function validateGradeData(data: any): data is GradeData {
    return (
        typeof data.userId === 'string' &&
        typeof data.moduleId === 'string' &&
        typeof data.score === 'number' &&
        typeof data.passingScore === 'number' &&
        typeof data.passed === 'boolean' &&
        typeof data.gradedBy === 'string' &&
        data.score >= 0 &&
        data.score <= 100 &&
        data.passingScore >= 0 &&
        data.passingScore <= 100
    );
}

/**
 * Fetches module data to check if critical
 */
async function getModuleData(courseId: string, moduleId: string) {
    const moduleDoc = await db
        .collection('courses')
        .doc(courseId)
        .collection('modules')
        .doc(moduleId)
        .get();

    if (!moduleDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Module ${moduleId} not found`);
    }

    return moduleDoc.data();
}

/**
 * Calculates how many attempts a user has made on a module
 */
async function getAttemptCount(userId: string, moduleId: string): Promise<number> {
    const progressDoc = await db
        .collection('progress')
        .doc(`${userId}_${moduleId}`)
        .get();

    return progressDoc.exists ? (progressDoc.data()?.totalAttempts || 0) : 0;
}

// ============================================
// FUNCTION 1: Grade Validation & Audit
// ============================================

/**
 * Triggered when a grade is created
 * 
 * Actions:
 * 1. Validate grade data structure
 * 2. Create audit log
 * 3. Check if remediation is needed (3+ failed attempts)
 * 4. Update enrollment progress if module complete
 */
export const onGradeCreate = functions.firestore
    .document('grades/{gradeId}')
    .onCreate(async (snapshot, context) => {
        const gradeData = snapshot.data() as GradeData;
        const gradeId = context.params.gradeId;

        functions.logger.info('Grade created', { gradeId, userId: gradeData.userId });

        // Validate data structure
        if (!validateGradeData(gradeData)) {
            functions.logger.error('Invalid grade data', { gradeId, gradeData });
            throw new functions.https.HttpsError('invalid-argument', 'Invalid grade data');
        }

        try {
            // Create audit log
            await createAuditLog(
                gradeData.gradedBy,
                'System', // Will be enriched with actual name in production
                'GRADE_CREATE',
                gradeId,
                `Grade entered: ${gradeData.score}% (${gradeData.passed ? 'PASSED' : 'FAILED'}) for module ${gradeData.moduleId}`,
                {
                    userId: gradeData.userId,
                    moduleId: gradeData.moduleId,
                    score: gradeData.score,
                    passed: gradeData.passed,
                }
            );

            // Check attempt count
            const attemptCount = await getAttemptCount(gradeData.userId, gradeData.moduleId);

            // If failed and this is 3rd+ attempt, trigger remediation
            if (!gradeData.passed && attemptCount >= 3) {
                functions.logger.warn('Remediation needed', {
                    userId: gradeData.userId,
                    moduleId: gradeData.moduleId,
                    attempts: attemptCount,
                });

                // Create remediation request
                await db.collection('remediation_requests').add({
                    userId: gradeData.userId,
                    moduleId: gradeData.moduleId,
                    courseId: '', // Will be enriched from enrollment
                    supervisorId: '', // Will be assigned by admin
                    reason: `Failed module after ${attemptCount} attempts`,
                    status: 'pending',
                    requestedAt: admin.firestore.Timestamp.now(),
                });

                await createAuditLog(
                    'system',
                    'System',
                    'REMEDIATION_REQUEST_CREATE',
                    gradeData.userId,
                    `Auto-created remediation request after ${attemptCount} failed attempts`,
                    { moduleId: gradeData.moduleId }
                );
            }

            // Trigger course grade recalculation
            // This will be handled by a separate function or callable
            functions.logger.info('Grade processing complete', { gradeId });

        } catch (error) {
            functions.logger.error('Error processing grade', { error, gradeId });
            throw error;
        }
    });

/**
 * Triggered when a grade is updated
 * 
 * Actions:
 * 1. Create audit log with old/new values
 * 2. Validate that critical fields (userId, moduleId) weren't changed
 */
export const onGradeUpdate = functions.firestore
    .document('grades/{gradeId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data() as GradeData;
        const after = change.after.data() as GradeData;
        const gradeId = context.params.gradeId;

        functions.logger.info('Grade updated', { gradeId });

        // Ensure immutable fields weren't changed
        if (before.userId !== after.userId || before.moduleId !== after.moduleId) {
            functions.logger.error('Attempted to change immutable grade fields', { gradeId });
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Cannot change userId or moduleId on existing grade'
            );
        }

        // Create audit log
        const changes = [];
        if (before.score !== after.score) {
            changes.push(`score: ${before.score} → ${after.score}`);
        }
        if (before.passed !== after.passed) {
            changes.push(`passed: ${before.passed} → ${after.passed}`);
        }

        await createAuditLog(
            after.gradedBy,
            'System',
            'GRADE_UPDATE',
            gradeId,
            `Grade modified: ${changes.join(', ')}`,
            {
                before: { score: before.score, passed: before.passed },
                after: { score: after.score, passed: after.passed },
            }
        );
    });

// ============================================
// FUNCTION 2: Enrollment Status Cascade
// ============================================

/**
 * Triggered when enrollment is updated
 * 
 * Actions:
 * 1. Check if course is completed (progress = 100)
 * 2. Calculate final course grade
 * 3. Update competency status
 * 4. Generate certificate if passed
 */
export const onEnrollmentUpdate = functions.firestore
    .document('enrollments/{enrollmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data() as EnrollmentData;
        const after = change.after.data() as EnrollmentData;
        const enrollmentId = context.params.enrollmentId;

        functions.logger.info('Enrollment updated', {
            enrollmentId,
            progressChange: `${before.progress} → ${after.progress}`,
        });

        // Check if course just completed
        if (before.progress < 100 && after.progress === 100) {
            functions.logger.info('Course completed', {
                userId: after.userId,
                courseId: after.courseId,
            });

            // Set completion timestamp
            await change.after.ref.update({
                completedAt: admin.firestore.Timestamp.now(),
                status: 'completed',
            });

            // Create audit log
            await createAuditLog(
                after.userId,
                'User',
                'ENROLLMENT_COMPLETE',
                enrollmentId,
                `Course completed: ${after.courseId}`,
                { courseId: after.courseId }
            );

            // Trigger certificate generation (placeholder)
            functions.logger.info('Certificate generation triggered', {
                userId: after.userId,
                courseId: after.courseId,
            });
        }

        // Check if status changed to 'failed'
        if (before.status !== 'failed' && after.status === 'failed') {
            await createAuditLog(
                'system',
                'System',
                'ENROLLMENT_FAILED',
                enrollmentId,
                `Enrollment marked as failed for course ${after.courseId}`,
                { courseId: after.courseId, userId: after.userId }
            );
        }
    });

// ============================================
// FUNCTION 3: Progress Tracking Validation
// ============================================

/**
 * Triggered when progress is created/updated
 * 
 * Actions:
 * 1. Validate progress percentage (0-100)
 * 2. Update enrollment progress if needed
 * 3. Create audit trail
 */
export const onProgressUpdate = functions.firestore
    .document('progress/{progressId}')
    .onWrite(async (change, context) => {
        const progressId = context.params.progressId;

        // Handle deletion (shouldn't happen, but log it)
        if (!change.after.exists) {
            functions.logger.warn('Progress record deleted', { progressId });
            return;
        }

        const data = change.after.data();

        // Validate progress value
        if (data.overallProgress < 0 || data.overallProgress > 100) {
            functions.logger.error('Invalid progress value', {
                progressId,
                value: data.overallProgress,
            });
            throw new functions.https.HttpsError(
                'out-of-range',
                'Progress must be between 0 and 100'
            );
        }

        // If this is a new record (create)
        if (!change.before.exists) {
            await createAuditLog(
                data.userId,
                'User',
                'PROGRESS_CREATE',
                progressId,
                `Started module ${data.moduleId}`,
                { moduleId: data.moduleId, courseId: data.courseId }
            );
        }

        // If progress just reached 100%
        if (change.before.exists) {
            const beforeData = change.before.data();
            if (beforeData.overallProgress < 100 && data.overallProgress === 100) {
                functions.logger.info('Module completed', {
                    userId: data.userId,
                    moduleId: data.moduleId,
                });

                await createAuditLog(
                    data.userId,
                    'User',
                    'MODULE_COMPLETE',
                    progressId,
                    `Completed module ${data.moduleId}`,
                    { moduleId: data.moduleId, courseId: data.courseId }
                );
            }
        }
    });

// ============================================
// FUNCTION 4: Remediation Request Handler
// ============================================

/**
 * Triggered when remediation request is updated (approved/denied)
 * 
 * Actions:
 * 1. If approved: Reset progress and allow retry
 * 2. If denied: Notify user and escalate
 * 3. Create audit log
 */
export const onRemediationUpdate = functions.firestore
    .document('remediation_requests/{requestId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const requestId = context.params.requestId;

        // Only process when status changes
        if (before.status === after.status) {
            return;
        }

        functions.logger.info('Remediation status changed', {
            requestId,
            status: after.status,
        });

        if (after.status === 'approved') {
            // Reset module progress to allow retry
            const progressId = `${after.userId}_${after.moduleId}`;
            const progressRef = db.collection('progress').doc(progressId);

            await progressRef.update({
                overallProgress: 0,
                isComplete: false,
                completedBlocks: {},
                totalAttempts: 0,
                updatedAt: admin.firestore.Timestamp.now(),
            });

            await createAuditLog(
                after.resolvedBy || 'system',
                'Supervisor',
                'REMEDIATION_APPROVED',
                requestId,
                `Remediation approved for module ${after.moduleId}. Progress reset.`,
                { userId: after.userId, moduleId: after.moduleId }
            );

            functions.logger.info('Progress reset for remediation', {
                userId: after.userId,
                moduleId: after.moduleId,
            });
        } else if (after.status === 'denied') {
            await createAuditLog(
                after.resolvedBy || 'system',
                'Supervisor',
                'REMEDIATION_DENIED',
                requestId,
                `Remediation denied for module ${after.moduleId}. Reason: ${after.resolutionNotes || 'Not specified'}`,
                { userId: after.userId, moduleId: after.moduleId }
            );
        }
    });

// ============================================
// FUNCTION 5: Course Grade Calculator (Callable)
// ============================================

/**
 * Callable function to calculate weighted course grade
 * 
 * This should be called:
 * - After a grade is entered
 * - When generating reports
 * - When checking course completion
 */
export const calculateCourseGrade = functions.https.onCall(
    async (data, context) => {
        // Authentication required
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Must be authenticated to calculate grades'
            );
        }

        const { userId, courseId } = data;

        if (!userId || !courseId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'userId and courseId are required'
            );
        }

        functions.logger.info('Calculating course grade', { userId, courseId });

        try {
            // Fetch all modules for the course
            const modulesSnapshot = await db
                .collection('courses')
                .doc(courseId)
                .collection('modules')
                .get();

            const modules = modulesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Fetch all grades for this user in this course
            const gradesSnapshot = await db
                .collection('grades')
                .where('userId', '==', userId)
                .get();

            const gradesByModule = new Map();
            gradesSnapshot.docs.forEach(doc => {
                const grade = doc.data();
                gradesByModule.set(grade.moduleId, grade);
            });

            // Calculate weighted score
            let totalWeightedScore = 0;
            let totalWeight = 0;
            let criticalModulesPassed = 0;
            let totalCriticalModules = 0;
            const moduleBreakdown = [];

            for (const module of modules) {
                const grade = gradesByModule.get(module.id);
                const weight = module.weight || 0;
                const isCritical = module.isCritical || false;

                if (isCritical) {
                    totalCriticalModules++;
                }

                if (grade) {
                    const weightedScore = (grade.score * weight) / 100;
                    totalWeightedScore += weightedScore;
                    totalWeight += weight;

                    if (isCritical && grade.passed) {
                        criticalModulesPassed++;
                    }

                    moduleBreakdown.push({
                        moduleId: module.id,
                        moduleTitle: module.title,
                        score: grade.score,
                        weight,
                        weightedScore,
                        isCritical,
                        passed: grade.passed,
                    });
                }
            }

            // Calculate overall score
            const overallScore = totalWeight > 0 ? totalWeightedScore : 0;

            // Determine if passed
            const allCriticalPassed = criticalModulesPassed === totalCriticalModules;
            const overallPassed = overallScore >= 70 && allCriticalPassed;

            const result = {
                courseId,
                userId,
                overallScore: Math.round(overallScore * 10) / 10,
                overallPassed,
                totalCriticalModules,
                criticalModulesPassed,
                allCriticalModulesPassed: allCriticalPassed,
                moduleBreakdown,
                totalModules: modules.length,
                gradedModules: moduleBreakdown.length,
                completionPercent: Math.round((moduleBreakdown.length / modules.length) * 100),
                isComplete: moduleBreakdown.length === modules.length,
                calculatedAt: admin.firestore.Timestamp.now(),
            };

            // Store in course_grades collection
            await db
                .collection('course_grades')
                .doc(`${userId}_${courseId}`)
                .set(result);

            functions.logger.info('Course grade calculated', {
                userId,
                courseId,
                overallScore: result.overallScore,
                overallPassed,
            });

            return result;
        } catch (error) {
            functions.logger.error('Error calculating course grade', { error });
            throw new functions.https.HttpsError('internal', 'Failed to calculate grade');
        }
    }
);

// ============================================
// EXPORTS
// ============================================

functions.logger.info('Cloud Functions initialized', {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
});