namespace shrutam.backend.srv;
using { shrutam.backend.db as db } from '../db/schema';

service BoardService {

    /**
     * Main Board Profiles
     */
    entity ExaminationBoards as projection on db.ExaminationBoards;

    /**
     * Centralized Curriculums.
     * Composition back-link allows Fiori to manage Course Materials 
     * directly inside the Course Object Page using a structural layout.
     */
    entity Courses as projection on db.Courses;

    /**
     * Media Attachments managed by the board
     */
    entity CourseMaterials as projection on db.CourseMaterials;

    /**
     * Global Center Registry overview.
     * Board admins need to see and assign new centers to their board.
     */
    entity Paathshalas as projection on db.Paathshalas;

    /**
     * Global User provisioning visibility.
     * Used by boards to audit roles or assign Center Admins across systems.
     */
    @readonly
    entity Users as projection on db.Users;

    /**
     * Dynamic Cross-Center Examination Master Hub.
     * Allows boards to schedule a unified exam paper across all centers.
     */
    entity Exams as projection on db.Exams;
}