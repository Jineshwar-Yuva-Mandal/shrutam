namespace shrutam.backend.db;
using { cuid, managed } from '@sap/cds/common';
using { shrutam.backend.db.Courses } from './course';


// ==========================================
// 2. BOARDS & PAATHSHALAS
// ==========================================

/**
 * Global Examination Boards (e.g., Central Jain Board)
 * Can oversee multiple local Paathshala centers.
 */
entity ExaminationBoards : cuid, managed {
    name          : String(100);
    description   : String(255);
    paathshalas   : Association to many Paathshalas on paathshalas.board = $self;
    courses       : Association to many Courses on courses.board = $self;
}

/**
 * Tenant Entity: Each individual Paathshala center
 */
entity Paathshalas : managed {
    key id      : String(100); // e.g., "blr-rajajinagar-mahaveer_paathshala"
    name        : String(100);
    area        : String(100);
    city        : String(50);
    board       : Association to ExaminationBoards;
    isActive    : Boolean default true;
}