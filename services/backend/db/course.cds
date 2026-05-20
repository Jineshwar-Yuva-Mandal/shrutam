namespace shrutam.backend.db;
using { cuid, managed } from '@sap/cds/common';
using { shrutam.backend.db.ExaminationBoards } from './board_and_paathshala';

// ==========================================
// 3. MEDIA-RICH COURSES & STUDY MATERIAL
// ==========================================

/**
 * Centralized Course Curriculum owned by a Board
 */
entity Courses : cuid, managed {
    board       : Association to ExaminationBoards;
    title       : String(100); // e.g., "Bal Bodh Part 1"
    description : String(255);
    contents    : Association to many CourseMaterials on contents.course = $self;
}

/**
 * Rich Media Attachments for Courses (PDFs, Audio, Videos)
 */
entity CourseMaterials : cuid, managed {
    course      : Association to Courses;
    title       : String(100); // e.g., "Chapter 1 PDF" or "Pravachan Video Link"
    mediaType   : String(10) enum { PDF; VIDEO_LINK; AUDIO; };
    resourceURL : String(1000); // Cloud Storage path or YouTube URL
    sequence    : Integer;     // Order of material in the course
}