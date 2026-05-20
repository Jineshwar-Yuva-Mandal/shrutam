namespace shrutam.backend.db;
using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';
using { shrutam.backend.db.Paathshalas } from './board_and_paathshala';

// ==========================================
// 1. GLOBAL IDENTITY & ROLE MATRIX
// ==========================================

/**
 * Central User Profile Table
 */
entity Users : cuid, managed {
    email       : String(255);
    firstName   : String(100);
    lastName    : String(100);
    age         : Integer;
    phoneNumber : String(15);
    paathshalaAssignments : Association to many UserPaathshalaRoles on paathshalaAssignments.user = $self;
}

/**
 * Role Definitions
 */
entity Roles : CodeList {
    key code : String(20); // Handled cleanly as a string key (BOARD_ADMIN, CENTER_ADMIN, TEACHER, STUDENT, PARENT)
}

/**
 * Intersection Table: Maps users to multiple Paathshalas with specific roles.
 * This is the magic key for your SaaS multi-tenant security!
 */
entity UserPaathshalaRoles : cuid, managed {
    user        : Association to Users;
    paathshala  : Association to Paathshalas; // Acts as the contextual tenant_id
    role        : Roles:code; // Role of the user in that specific Paathshala
}

/**
 * Parent-to-Student Mapping Table (Many-to-Many relationship)
 */
entity ParentStudentMapping : cuid, managed {
    parent    : Association to Users; 
    student   : Association to Users; 
}