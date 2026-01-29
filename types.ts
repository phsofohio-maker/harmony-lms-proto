// User Roles
export type UserRoleType = 'admin' | 'instructor' | 'staff' | 'content_author';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRoleType;
  department?: string;
}

// Content Block Types
export type BlockType = 
  | 'heading'
  | 'text'
  | 'image'
  | 'video'
  | 'quiz'
  | 'checklist';

// Specific Data Interfaces
export interface TextBlockData {
  content: string;
  variant?: 'paragraph' | 'callout-info' | 'callout-warning' | 'callout-critical';
}

export interface ImageBlockData {
  url: string;
  caption?: string;
  altText?: string; // Critical for accessibility compliance
}

export interface VideoBlockData {
  url: string;
  title: string;
  duration: number; // seconds
  transcript?: string; // Critical for accessibility compliance
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
  points: number;
}

export interface QuizBlockData {
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}

// Union type for all block data
export type AnyBlockData = TextBlockData | ImageBlockData | VideoBlockData | QuizBlockData | { [key: string]: any };

export interface ContentBlock {
  id: string;
  moduleId: string;
  type: BlockType;
  order: number;
  required: boolean;
  data: AnyBlockData;
}

// Course & Module Hierarchy
export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  passingScore: number;
  estimatedMinutes: number;
  blocks: ContentBlock[]; 
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: 'hospice' | 'compliance' | 'clinical_skills';
  ceCredits: number;
  thumbnailUrl: string;
  modules: Module[];
}

// Audit & Compliance
export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actionType: 'GRADE_ENTRY' | 'MODULE_UPDATE' | 'COURSE_PUBLISH' | 'USER_LOGIN';
  targetId: string;
  details: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // 0-100
  status: 'not_started' | 'in_progress' | 'completed';
}