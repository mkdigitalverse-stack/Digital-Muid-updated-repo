/**
 * DigitalMUID Academy — Demonstration Enrolment Records
 * 
 * STRICT COMPLIANCE NOTICE:
 * These 12 records are fictional test entries designed exclusively for UI layout
 * and responsive table verification in development/testing.
 * 
 * In accordance with strict ethical and anti-deception guidelines:
 * 1. These records are NEVER inserted into the production database.
 * 2. These records are NEVER displayed as live social-proof popups or fake recent visitor notifications.
 * 3. All records are explicitly identified as demonstration data.
 */

export interface DemoEnrollmentRecord {
  id: string;
  studentName: string;
  gender: 'Female' | 'Male' | 'Non-Binary';
  city: string;
  state: string;
  courseName: string;
  deliveryMode: 'Online Cohort' | 'In-Person Classroom';
  cohortMonth: string;
  isDemo: true;
}

export const DEMO_ENROLLMENT_RECORDS: DemoEnrollmentRecord[] = [
  {
    id: 'DEMO-ENR-001',
    studentName: 'Aarav Sharma',
    gender: 'Male',
    city: 'Bengaluru',
    state: 'Karnataka',
    courseName: 'Meta & Google Ads Mastery: Algorithmic Scaling',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-002',
    studentName: 'Ananya Deshmukh',
    gender: 'Female',
    city: 'Mumbai',
    state: 'Maharashtra',
    courseName: 'SEO with AI Integration: Intent Dominance',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-003',
    studentName: 'Zubair Ahmad Dar',
    gender: 'Male',
    city: 'Srinagar',
    state: 'Jammu & Kashmir',
    courseName: 'Digital Marketing & Growth Architecture',
    deliveryMode: 'In-Person Classroom',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-004',
    studentName: 'Meera Krishnan',
    gender: 'Female',
    city: 'Chennai',
    state: 'Tamil Nadu',
    courseName: 'AI & Automation for Business Operations',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-005',
    studentName: 'Rohan Banerjee',
    gender: 'Male',
    city: 'Kolkata',
    state: 'West Bengal',
    courseName: 'Meta & Google Ads Mastery: Algorithmic Scaling',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Dec 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-006',
    studentName: 'Pooja Verma',
    gender: 'Female',
    city: 'Delhi NCR',
    state: 'Delhi',
    courseName: 'SEO with AI Integration: Intent Dominance',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Dec 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-007',
    studentName: 'Kabir Patel',
    gender: 'Non-Binary',
    city: 'Ahmedabad',
    state: 'Gujarat',
    courseName: 'AI & Automation for Business Operations',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-008',
    studentName: 'Fatima Zohra',
    gender: 'Female',
    city: 'Hyderabad',
    state: 'Telangana',
    courseName: 'Digital Marketing & Growth Architecture',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-009',
    studentName: 'Vikramaditya Rathore',
    gender: 'Male',
    city: 'Jaipur',
    state: 'Rajasthan',
    courseName: 'Meta & Google Ads Mastery: Algorithmic Scaling',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Dec 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-010',
    studentName: 'Sneha Kulkarni',
    gender: 'Female',
    city: 'Pune',
    state: 'Maharashtra',
    courseName: 'SEO with AI Integration: Intent Dominance',
    deliveryMode: 'Online Cohort',
    cohortMonth: 'Nov 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-011',
    studentName: 'Gurpreet Singh',
    gender: 'Male',
    city: 'Chandigarh',
    state: 'Punjab',
    courseName: 'Digital Marketing & Growth Architecture',
    deliveryMode: 'In-Person Classroom',
    cohortMonth: 'Dec 2026',
    isDemo: true
  },
  {
    id: 'DEMO-ENR-012',
    studentName: 'Nida Mir',
    gender: 'Female',
    city: 'Srinagar',
    state: 'Jammu & Kashmir',
    courseName: 'AI & Automation for Business Operations',
    deliveryMode: 'In-Person Classroom',
    cohortMonth: 'Nov 2026',
    isDemo: true
  }
];
