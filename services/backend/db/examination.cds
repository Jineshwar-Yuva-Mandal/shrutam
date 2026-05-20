namespace shrutam.backend.db;
using { cuid, managed } from '@sap/cds/common';
using { shrutam.backend.db.Users } from './identity_and_role_matrix';
using { shrutam.backend.db.ExaminationBoards, shrutam.backend.db.Paathshalas } from './board_and_paathshala';
using { shrutam.backend.db.Courses } from './course';
using { shrutam.backend.db.Batches } from './batch';


// ==========================================
// 5. EXAMINATIONS, GRADING & RANKINGS
// ==========================================

/**
 * Master Exam table supporting both Board-level and local Paathshala tests
 */
entity Exams : cuid, managed {
    paathshala   : Association to Paathshalas; // Nullable if scope is 'BOARD'
    board        : Association to ExaminationBoards; // Filled if board-driven
    course       : Association to Courses;
    batch        : Association to Batches;     // Nullable if it's a board-wide exam targeting multiple batches
    title        : String(150);                // e.g., "Central Annual Exam" or "Surprise Test 1"
    examDate     : Date;
    scope        : String(20) enum { BOARD; LOCAL_CENTER; CLASS_BATCH; };
    maxWritten   : Decimal(5, 2) default 0.00; // Maximum marks for written paper
    maxViva      : Decimal(5, 2) default 0.00; // Maximum marks for oral/recitation recitation
    passingMarks : Decimal(5, 2);
}

/**
 * Student Scoresheet Roster
 */
entity ExamMarks : cuid, managed {
    paathshala   : Association to Paathshalas; // Kept for fast tenant isolation
    exam         : Association to Exams;
    student      : Association to Users;       // Role must be STUDENT
    scoreWritten : Decimal(5, 2) default 0.00;
    scoreViva    : Decimal(5, 2) default 0.00;
    totalScore   : Decimal(5, 2);              // Calculated dynamically in application layer
    isPassed     : Boolean;
    remarks      : String(255);
}