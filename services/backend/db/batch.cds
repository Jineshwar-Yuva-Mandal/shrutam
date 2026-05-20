namespace shrutam.backend.db;
using { cuid, managed } from '@sap/cds/common';
using { shrutam.backend.db.Users } from './identity_and_role_matrix';
using { shrutam.backend.db.Paathshalas } from './board_and_paathshala';
using { shrutam.backend.db.Courses } from './course';

// ==========================================
// 4. LOCAL BATCHES & ENROLLMENTS (The Classes)
// ==========================================

/**
 * Specific classes running inside a Paathshala (e.g., "Level 2 Sunday Morning")
 */
entity Batches : cuid, managed {
    paathshala   : Association to Paathshalas; // The tenant boundary for this class
    name         : String(100); // e.g., "Senior Batch A"
    academicYear : String(10);  // e.g., "2026-2027"
    course       : Association to Courses;
    primaryTeacher : Association to Users;
}

/**
 * Roster mapping students to their active classes/batches
 */
entity BatchEnrollments : cuid, managed {
    paathshala : Association to Paathshalas; // Kept for fast tenant filtering
    batch      : Association to Batches;
    student    : Association to Users;
}