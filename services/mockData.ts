import { Course, User, AuditLog } from '../types';

export const MOCK_USERS: User[] = [
  {
    uid: 'admin_001',
    displayName: 'Dr. Sarah Admin',
    email: 'sarah@harmony.health',
    role: 'admin'
  },
  {
    uid: 'staff_001',
    displayName: 'Nurse John Doe',
    email: 'john@harmony.health',
    role: 'staff',
    department: 'Hospice Care'
  }
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'c_001',
    title: 'Understanding Hospice Care',
    description: 'Fundamental principles of palliative care and hospice philosophy for new staff.',
    category: 'hospice',
    ceCredits: 2.5,
    thumbnailUrl: 'https://picsum.photos/400/200?random=1',
    modules: [
      {
        id: 'm_001',
        courseId: 'c_001',
        title: 'Introduction to Palliative Care',
        description: 'Defining the scope of practice and patient comfort goals.',
        status: 'published',
        passingScore: 80,
        estimatedMinutes: 15,
        blocks: [
          {
            id: 'b_001',
            moduleId: 'm_001',
            type: 'heading',
            order: 0,
            required: false,
            data: { content: 'Welcome to Hospice Care' }
          },
          {
            id: 'b_002',
            moduleId: 'm_001',
            type: 'text',
            order: 1,
            required: true,
            data: { content: 'Hospice care focuses on the quality of life for people and their caregivers who are experiencing an advanced, life-limiting illness.' }
          }
        ]
      }
    ]
  },
  {
    id: 'c_002',
    title: 'HIPAA Compliance 2025',
    description: 'Mandatory annual training for data privacy and security.',
    category: 'compliance',
    ceCredits: 1.0,
    thumbnailUrl: 'https://picsum.photos/400/200?random=2',
    modules: []
  }
];