"use client";

import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  School,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SyntheticEvent, useEffect, useState } from "react";
import BrandLogo from "@/components/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Role = "teacher" | "student";
type Section = "overview" | "attendance" | "students" | "classes" | "trackers" | "courses" | "events" | "activity";
type AttendanceStatus = "Present" | "Absent" | "Excused";
type AttendanceAnalytics = Record<string, { present: number; absent: number; excused: number }>;
type PortalDialog = "event" | "class" | "course" | "tracker";

type Student = { id: string; userId: string | null; name: string; level: string };
type CommunityEvent = { id: string | number; title: string; date: string; month: string; place: string; registered: boolean; isPaid: boolean; startsAt?: string };
type ClassItem = { id: string; name: string; teacher: string; teacherUserId: string | null; weekdays: number[]; startsAt: string; time: string; courseIds: string[]; courseTitles: string[] };
type StudentTracker = { id: string; title: string; description: string; classIds: string[]; studentIds: string[]; markedStudentIds: string[] };
type CourseItem = { id: string; title: string; description: string; parentCourseId: string | null };
type TeacherOption = { id: string; name: string };
type StudentAccessRequest = { id: string; userId: string; name: string; createdAt: string; status: string };
type TeacherRequest = { id: string; name: string; createdAt: string };
type AuditEntry = { id: string; actorName: string; tableName: string; operation: string; recordId: string; oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null; changedAt: string };

const navItems: { key: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "attendance", label: "Attendance", icon: ClipboardCheck },
  { key: "students", label: "Students", icon: Users },
  { key: "classes", label: "Classes", icon: BookOpen },
  { key: "trackers", label: "Trackers", icon: ClipboardCheck },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "activity", label: "Activity log", icon: History },
];

const roleLabels: Record<Role, string> = {
  teacher: "Teacher",
  student: "Student",
};

const sectionCopy: Record<Section, { title: string; eyebrow: string; description: string }> = {
  overview: { title: "Your learning community", eyebrow: "Paathshala", description: "Your classes and community in one place." },
  attendance: { title: "Attendance", eyebrow: "Weekly learning", description: "Keep each class roster accurate and visible to families." },
  students: { title: "Students", eyebrow: "Paathshala community", description: "Student profiles, class assignments, and access requests." },
  classes: { title: "Classes", eyebrow: "Learning groups", description: "Weekly sessions, teachers, and course levels." },
  trackers: { title: "Student trackers", eyebrow: "Paathshala activities", description: "Track scenario-based checklists across selected classes." },
  courses: { title: "Courses", eyebrow: "Paathshala curriculum", description: "Organize learning topics and nested courses." },
  events: { title: "Community events", eyebrow: "Beyond the classroom", description: "Gatherings and special programs hosted by this paathshala." },
  activity: { title: "Paathshala activity", eyebrow: "Accountability", description: "A record of changes made in this paathshala." },
};

type PortalProps = Readonly<{
  tenantSlug: string;
  tenantId: string;
  tenantName: string;
  tenantCity: string;
  viewerRoles: Role[];
  viewerName: string;
  userId: string;
  availableTenants: { slug: string; name: string; location: string }[];
}>;

export default function Portal({ tenantSlug, tenantId, tenantName, tenantCity, viewerRoles, viewerName, userId, availableTenants }: PortalProps) {
  const router = useRouter();
  const { role, roleLabel, hasTeacherRole, hasStudentRole } = getPortalRoleContext(viewerRoles);
  const [section, setSection] = useState<Section>("overview");
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentTrackers, setStudentTrackers] = useState<StudentTracker[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceDate, setAttendanceDate] = useState(getLocalDate());
  const [attendanceAnalytics, setAttendanceAnalytics] = useState<AttendanceAnalytics>({});
  const [attendanceSessionCount, setAttendanceSessionCount] = useState(0);
  const [myStudentIds, setMyStudentIds] = useState<string[]>([]);
  const [studentRequests, setStudentRequests] = useState<StudentAccessRequest[]>([]);
  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [classRosterIds, setClassRosterIds] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [dialog, setDialog] = useState<PortalDialog | null>(null);
  const [toast, setToast] = useState("");

  const tenantOptions = availableTenants;
  const tenant = { slug: tenantSlug, name: tenantName, location: tenantCity || "Paathshala" };
  const currentUser = viewerName || "Community member";
  const presentCount = Object.values(attendance).filter((value) => value === "Present").length;
  const attendanceRate = Math.round((presentCount / Math.max(Object.keys(attendance).length, 1)) * 100);
  const copy = sectionCopy[section];

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void loadPortalData(supabase, tenantId, userId, role, hasStudentRole, hasTeacherRole).then((data) => {
      if (!active) return;
      setStudents(data.students);
      setEvents(data.events);
      setClasses(data.classes);
      setStudentTrackers(data.studentTrackers);
      setCourses(data.courses);
      setTeacherOptions(data.teacherOptions);
      setAttendance(data.attendance);
      setAttendanceAnalytics(data.attendanceAnalytics);
      setAttendanceSessionCount(data.attendanceSessionCount);
      setMyStudentIds(data.myStudentIds);
      setClassRosterIds(data.classRosterIds);
      setSelectedClassId(data.selectedClassId);
      setStudentRequests(data.studentRequests);
      setTeacherRequests(data.teacherRequests);
      setAuditEntries(data.auditEntries);
      setLiveLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setLiveError(error instanceof Error ? error.message : "Unable to load paathshala records");
      setLiveLoading(false);
    });
    return () => { active = false; };
  }, [role, hasStudentRole, hasTeacherRole, tenantId, userId]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function updateAttendance(studentId: string | number, status: AttendanceStatus) {
    setAttendance((current) => ({ ...current, [String(studentId)]: status }));
  }
  async function changeClass(classId: string) {
    setSelectedClassId(classId);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    try {
      const rosterIds = await loadClassRosterIds(supabase, classId);
      const [records, history] = await Promise.all([
        loadAttendanceForDate(supabase, classId, attendanceDate),
        loadClassAttendanceHistory(supabase, classId),
      ]);
      setClassRosterIds(rosterIds);
      setAttendance(records);
      setAttendanceAnalytics(history.analytics);
      setAttendanceSessionCount(history.sessionCount);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load this class roster");
    }
  }

  async function changeAttendanceDate(date: string) {
    setAttendanceDate(date);
    if (!selectedClassId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    try {
      setAttendance(await loadAttendanceForDate(supabase, selectedClassId, date));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load attendance for this date");
    }
  }

  async function toggleRegistration(eventId: string | number) {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const result = target.registered
      ? await supabase.from("event_registrations").delete().eq("event_id", eventId).eq("registrant_user_id", userId)
      : await supabase.from("event_registrations").insert({ paathshala_id: tenantId, event_id: eventId, registrant_user_id: userId });
    if (result.error) {
      notify(result.error.message);
      return;
    }
    setEvents((current) => current.map((event) => event.id === eventId ? { ...event, registered: !event.registered } : event));
    notify(target.registered ? "Registration cancelled" : "You’re on the guest list");
  }

  async function addEvent(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const titleValue = formData.get("title");
    const placeValue = formData.get("place");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    const place = typeof placeValue === "string" ? placeValue.trim() : "";
    const isPaid = formData.get("isPaid") === "on";
    if (!title || !place) return;
    const startsAtValue = formData.get("startsAt");
    const startsAt = typeof startsAtValue === "string" && startsAtValue ? new Date(startsAtValue) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      notify("Choose a valid event date and time");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { data, error } = await supabase.from("events").insert({
      paathshala_id: tenantId,
      title,
      venue: place,
      is_paid: isPaid,
      starts_at: startsAt.toISOString(),
      status: "published",
      created_by: userId,
    }).select("id").single();
    if (error || !data) {
      notify(error?.message ?? "Could not create this event");
      return;
    }
    setEvents((current) => [...current, {
      id: data.id,
      title,
      place,
      date: startsAt.toLocaleDateString("en", { day: "2-digit" }),
      month: startsAt.toLocaleDateString("en", { month: "short" }).toUpperCase(),
      registered: false,
      isPaid,
      startsAt: startsAt.toISOString(),
    }]);
    setDialog(null);
    notify("Event added to this paathshala");
  }

  async function addClass(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = readFormText(formData, "className");
    const level = readFormText(formData, "level");
    const weekdays = formData.getAll("weekdays").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    const startsAt = readFormText(formData, "startsAt");
    const courseIds = formData.getAll("courseIds").filter((value): value is string => typeof value === "string");
    if (!name || !level || weekdays.length === 0 || !startsAt) {
      notify("Choose at least one class day and a start time");
      return;
    }
    const teacherUserIdValue = readFormText(formData, "teacherUserId");
    let courseAssignmentError = "";
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { data, error } = await supabase.from("classes").insert({ paathshala_id: tenantId, name, learning_level: level, weekdays, starts_at: startsAt, teacher_user_id: teacherUserIdValue || null }).select("id").single();
    if (error || !data) {
      notify(error?.message ?? "Could not create this class");
      return;
    }
    if (courseIds.length > 0) {
      const { error: courseError } = await supabase.from("class_courses").insert(courseIds.map((courseId) => ({ paathshala_id: tenantId, class_id: data.id, course_id: courseId })));
      if (courseError) courseAssignmentError = courseError.message;
    }
    const newClass: ClassItem = {
      id: data.id,
      name,
      teacher: teacherOptions.find((teacher) => teacher.id === teacherUserIdValue)?.name ?? "Teacher to be assigned",
      teacherUserId: teacherUserIdValue || null,
      weekdays,
      startsAt,
      time: formatClassTime(weekdays, startsAt),
      courseIds,
      courseTitles: courseIds.map((id) => courses.find((course) => course.id === id)?.title ?? "Course"),
    };
    setClasses((current) => [...current, newClass]);
    setSelectedClassId(newClass.id);
    setClassRosterIds([]);
    setAttendance({});
    setDialog(null);
    notify(courseAssignmentError ? `Class created, but course assignment failed: ${courseAssignmentError}` : "Class added to this paathshala");
  }

  async function addCourse(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = readFormText(formData, "courseTitle");
    const description = readFormText(formData, "description");
    const parentValue = readFormText(formData, "parentCourseId");
    if (!title) return;
    const parentCourseId = parentValue || null;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { data, error } = await supabase.from("courses").insert({
      paathshala_id: tenantId,
      title,
      description,
      parent_course_id: parentCourseId,
      sort_order: courses.length,
      created_by: userId,
    }).select("id").single();
    if (error || !data) {
      notify(error?.message ?? "Could not create this course");
      return;
    }
    setCourses((current) => [...current, { id: data.id, title, description, parentCourseId }]);
    setDialog(null);
    notify("Course added to this paathshala");
  }

  async function updateClassCourses(classId: string, courseIds: string[]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const classItem = classes.find((item) => item.id === classId);
    if (!classItem) return;
    const oldIds = classItem.courseIds;
    const removedIds = oldIds.filter((id) => !courseIds.includes(id));
    const addedIds = courseIds.filter((id) => !oldIds.includes(id));
    if (removedIds.length > 0) {
      const { error } = await supabase.from("class_courses").delete().eq("class_id", classId).in("course_id", removedIds);
      if (error) {
        notify(error.message);
        return;
      }
    }
    if (addedIds.length > 0) {
      const { error } = await supabase.from("class_courses").insert(addedIds.map((courseId) => ({ paathshala_id: tenantId, class_id: classId, course_id: courseId })));
      if (error) {
        notify(error.message);
        return;
      }
    }
    const courseTitles = courseIds.map((id) => courses.find((course) => course.id === id)?.title ?? "Course");
    setClasses((current) => current.map((item) => item.id === classId ? { ...item, courseIds, courseTitles } : item));
    notify("Class courses updated");
  }

  async function assignClassTeacher(classId: string, teacherUserId: string | null) {
    const teacher = teacherOptions.find((item) => item.id === teacherUserId);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { error } = await supabase.from("classes").update({ teacher_user_id: teacherUserId }).eq("id", classId);
    if (error) {
      notify(error.message);
      return;
    }
    setClasses((current) => current.map((classItem) => classItem.id === classId ? {
      ...classItem,
      teacherUserId,
      teacher: teacher?.name ?? "Teacher to be assigned",
    } : classItem));
    notify(teacher ? `${teacher.name} assigned to class` : "Class is now unassigned");
  }

  async function updateClassSchedule(classId: string, weekdays: number[], startsAt: string) {
    const classDays = [...new Set(weekdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);
    if (classDays.length === 0 || !startsAt) {
      notify("Choose at least one class day and a start time");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { error } = await supabase.from("classes").update({ weekdays: classDays, starts_at: startsAt }).eq("id", classId);
    if (error) {
      notify(error.message);
      return;
    }
    setClasses((current) => current.map((item) => item.id === classId ? {
      ...item,
      weekdays: classDays,
      startsAt,
      time: formatClassTime(classDays, startsAt),
    } : item));
    notify("Class schedule updated. Previous attendance is unchanged.");
  }

  async function saveAttendance() {
    if (!selectedClassId) {
      notify("Choose a class before saving attendance");
      return;
    }
    const rosterStudents = students.filter((student) => classRosterIds.includes(String(student.id)));
    if (rosterStudents.length === 0 || rosterStudents.some((student) => !attendance[String(student.id)])) {
      notify("Mark each learner before saving");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const sessionDate = attendanceDate;
    const { data: session, error: sessionError } = await supabase.from("attendance_sessions").upsert({
      paathshala_id: tenantId,
      class_id: selectedClassId,
      session_date: sessionDate,
      marked_by: userId,
    }, { onConflict: "class_id,session_date" }).select("id").single();
    if (sessionError || !session) {
      notify(sessionError?.message ?? "Could not save this attendance session");
      return;
    }
    const rows = rosterStudents.map((student) => ({
      paathshala_id: tenantId,
      session_id: session.id,
      student_id: student.id,
      status: attendance[String(student.id)].toLowerCase(),
    }));
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "session_id,student_id" });
    if (error) {
      notify(error.message);
      return;
    }
    const history = await loadClassAttendanceHistory(supabase, selectedClassId);
    setAttendanceAnalytics(history.analytics);
    setAttendanceSessionCount(history.sessionCount);
    notify("Attendance saved");
  }

  async function approveStudentMembership(membershipId: string) {
    const request = studentRequests.find((item) => item.id === membershipId);
    if (!request) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { data: studentId, error } = await supabase.rpc("approve_student_membership", { p_membership_id: membershipId });
    if (error) {
      notify(error.message);
      return;
    }
    setStudentRequests((current) => current.filter((item) => item.id !== membershipId));
    setStudents((current) => [...current, { id: studentId, userId: request.userId, name: request.name, level: "Not set" }]);
    notify(`${request.name} added to this paathshala`);
  }

  async function approveTeacherRequest(membershipId: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.rpc("approve_teacher_membership", { p_membership_id: membershipId });
    if (error) {
      notify(error.message);
      return;
    }
    setTeacherRequests((current) => current.filter((request) => request.id !== membershipId));
    notify("Teacher access approved");
  }

  async function enrollStudent(studentId: string | number, classId: string) {
    if (!classId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { error } = await supabase.from("class_enrollments").upsert({
      paathshala_id: tenantId,
      class_id: classId,
      student_id: studentId,
    }, { onConflict: "class_id,student_id" });
    notify(error ? error.message : "Learner enrolled in class");
  }

  async function addStudentTracker(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = readFormText(formData, "trackerTitle");
    const description = readFormText(formData, "trackerDescription");
    const classIds = [...new Set(formData.getAll("classIds").filter((value): value is string => typeof value === "string"))]
      .filter((classId) => classes.some((classItem) => classItem.id === classId));
    if (!title || classIds.length === 0) {
      notify("Enter a tracker name and choose at least one class");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { data: tracker, error } = await supabase.from("student_trackers").insert({
      paathshala_id: tenantId,
      title,
      description,
      created_by: userId,
    }).select("id").single();
    if (error || !tracker) {
      notify(error?.message ?? "Could not create this tracker");
      return;
    }
    const { error: classError } = await supabase.from("student_tracker_classes").insert(classIds.map((classId) => ({
      paathshala_id: tenantId,
      tracker_id: tracker.id,
      class_id: classId,
    })));
    if (classError) {
      await supabase.from("student_trackers").delete().eq("id", tracker.id);
      notify(classError.message);
      return;
    }
    const { data: enrollments, error: rosterError } = await supabase.from("class_enrollments")
      .select("student_id")
      .in("class_id", classIds);
    if (rosterError) {
      await supabase.from("student_trackers").delete().eq("id", tracker.id);
      notify(rosterError.message);
      return;
    }
    const studentIds = [...new Set((enrollments ?? []).map((enrollment) => String(enrollment.student_id)))];
    setStudentTrackers((current) => [{ id: tracker.id, title, description, classIds, studentIds, markedStudentIds: [] }, ...current]);
    setDialog(null);
    notify("Student tracker created");
  }

  async function toggleStudentTrackerRecord(trackerId: string, studentId: string, isMarked: boolean) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Supabase is not configured");
      return;
    }
    const { error } = await supabase.from("student_tracker_records").upsert({
      paathshala_id: tenantId,
      tracker_id: trackerId,
      student_id: studentId,
      is_marked: isMarked,
      marked_by: userId,
      marked_at: new Date().toISOString(),
    }, { onConflict: "tracker_id,student_id" });
    if (error) {
      notify(error.message);
      return;
    }
    setStudentTrackers((current) => current.map((tracker) => {
      if (tracker.id !== trackerId) return tracker;
      const markedStudentIds = new Set(tracker.markedStudentIds);
      if (isMarked) markedStudentIds.add(studentId);
      else markedStudentIds.delete(studentId);
      return { ...tracker, markedStudentIds: [...markedStudentIds] };
    }));
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo variant="icon" className="brand-mark-image" alt="" />
          <div><div className="brand-name">Shrutam</div><div className="brand-subtitle">Learning together</div></div>
        </div>
        <div className="tenant-block">
          <label className="tenant-label" htmlFor="tenant-select">Paathshala space</label>
          <select
            className="tenant-select"
            id="tenant-select"
            value={tenant.slug}
            onChange={(event) => router.push(`/${event.target.value}`)}
            aria-label="Choose paathshala space"
          >
            {tenantOptions.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
        <div className="nav-label">Your space</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.filter((item) => hasTeacherRole || (item.key !== "activity" && item.key !== "courses")).map(({ key, label, icon: Icon }) => (
            <button className={`nav-item ${section === key ? "active" : ""}`} key={key} onClick={() => setSection(key)} aria-current={section === key ? "page" : undefined}>
              <Icon size={17} strokeWidth={1.8} />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note"><span className="status-dot" />{tenant.location}<br />Learning in community, every week.</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <BrandLogo variant="text" className="mobile-brand-logo" priority />
          <div className="breadcrumb">{tenant.name} <span aria-hidden="true">/</span> {roleLabels[role]}</div>
          <div className="topbar-actions">
            <span className="role-label">{roleLabel}</span>
            <button type="button" className="secondary-button signout-button" onClick={signOut}><LogOut size={14} /><span>Sign out</span></button>
            <div className="avatar" title={currentUser}>{currentUser.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
          </div>
        </header>

        <main className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{copy.eyebrow} · {tenant.location}</p>
              <h1>{section === "overview" ? `Namaste, ${currentUser.split(" ")[0]}` : copy.title}</h1>
              <p className="heading-note">{copy.description}</p>
            </div>
            {section === "events" && role === "teacher" && <button className="primary-button" onClick={() => setDialog("event")}><Plus size={15} /> Create event</button>}
            {section === "trackers" && hasTeacherRole && <button className="primary-button" onClick={() => setDialog("tracker")}><Plus size={15} /> Create tracker</button>}
            {section === "courses" && role === "teacher" && <button className="primary-button" onClick={() => setDialog("course")}><Plus size={15} /> Create course</button>}
          </div>

          {liveLoading && <output className="notice">Loading paathshala records...</output>}
          {liveError && <div className="notice" role="alert">Couldn’t load paathshala records: {liveError}</div>}
          {section === "overview" && <Overview role={role} hasStudentRole={hasStudentRole} students={students} myStudentIds={myStudentIds} classes={classes} events={events} attendance={attendance} attendanceRate={attendanceRate} attendanceAnalytics={attendanceAnalytics} attendanceDate={attendanceDate} classRosterIds={classRosterIds} selectedClassId={selectedClassId} onClassChange={changeClass} onAttendanceChange={updateAttendance} onSaveAttendance={saveAttendance} onNavigate={setSection} onRegister={toggleRegistration} />}
          {section === "attendance" && <AttendancePanel role={role} students={students} rosterIds={classRosterIds} classes={classes} selectedClassId={selectedClassId} onClassChange={changeClass} attendance={attendance} onChange={updateAttendance} onSave={saveAttendance} analytics={attendanceAnalytics} sessionCount={attendanceSessionCount} date={attendanceDate} onDateChange={changeAttendanceDate} />}
          {section === "students" && <StudentsPanel role={role} students={students} classes={classes} studentRequests={studentRequests} teacherRequests={teacherRequests} onApproveStudent={approveStudentMembership} onApproveTeacher={approveTeacherRequest} onEnroll={enrollStudent} />}
          {section === "classes" && <ClassesPanel role={role} classes={classes} courses={courses} teachers={teacherOptions} onCreate={() => setDialog("class")} onAssignTeacher={assignClassTeacher} onAssignCourses={updateClassCourses} onScheduleChange={updateClassSchedule} />}
          {section === "trackers" && <StudentTrackersPanel role={role} trackers={studentTrackers} students={students} classes={classes} onToggle={toggleStudentTrackerRecord} />}
          {section === "courses" && role === "teacher" && <CoursesPanel courses={courses} />}
          {section === "events" && <EventsPanel role={role} events={events} onRegister={toggleRegistration} onCreate={() => setDialog("event")} />}
          {section === "activity" && hasTeacherRole && <ActivityPanel entries={auditEntries} />}
        </main>
      </div>

      {dialog && <PortalDialogForm dialog={dialog} teachers={teacherOptions} courses={courses} classes={classes} onClose={() => setDialog(null)} onEvent={addEvent} onClass={addClass} onCourse={addCourse} onTracker={addStudentTracker} />}
      {toast && <output className="toast">{toast}</output>}
    </div>
  );
}

function PortalDialogForm({ dialog, teachers, courses, classes, onClose, onEvent, onClass, onCourse, onTracker }: Readonly<{
  dialog: PortalDialog;
  teachers: TeacherOption[];
  courses: CourseItem[];
  classes: ClassItem[];
  onClose: () => void;
  onEvent: (event: SyntheticEvent<HTMLFormElement>) => void;
  onClass: (event: SyntheticEvent<HTMLFormElement>) => void;
  onCourse: (event: SyntheticEvent<HTMLFormElement>) => void;
  onTracker: (event: SyntheticEvent<HTMLFormElement>) => void;
}>) {
  let form = <form onSubmit={onClass} className="wide-form">
    <label className="form-label">Class name<input className="form-control" name="className" placeholder="e.g. Bal Bodh 2" required /></label>
    <label className="form-label">Learning level<input className="form-control" name="level" required /></label>
    <fieldset className="course-checklist"><legend>Class days</legend><div className="weekday-options">{weekdayOptions.map((day) => <label className="course-choice" key={day.value}><input type="checkbox" name="weekdays" value={day.value} defaultChecked={day.value === 0} />{day.label}</label>)}</div></fieldset>
    <label className="form-label">Start time<input className="form-control" type="time" name="startsAt" required /></label>
    <label className="form-label">Assigned teacher<select className="form-control" name="teacherUserId" defaultValue=""><option value="">Unassigned</option>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</select></label>
    <fieldset className="course-checklist"><legend>Courses in this class</legend>{courses.length === 0 ? <p className="row-detail">Create courses first, or leave this class without courses.</p> : courses.map((course) => <label className="course-choice" key={course.id}><input type="checkbox" name="courseIds" value={course.id} />{getCourseLabel(course, courses)}</label>)}</fieldset>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Create class</button></div>
  </form>;

  if (dialog === "event") {
    form = <form onSubmit={onEvent} className="wide-form">
      <label className="form-label">Event name<input className="form-control" name="title" required /></label>
      <label className="form-label">Location<input className="form-control" name="place" placeholder="Paathshala hall" required /></label>
      <label className="form-label">Date and time<input className="form-control" type="datetime-local" name="startsAt" required /></label>
      <label className="course-choice"><input type="checkbox" name="isPaid" />Paid event</label>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Create event</button></div>
    </form>;
  }
  if (dialog === "course") {
    form = <form onSubmit={onCourse} className="wide-form">
      <label className="form-label">Course title<input className="form-control" name="courseTitle" required /></label>
      <label className="form-label">Description<textarea className="form-control" name="description" rows={3} /></label>
      <label className="form-label">Parent course<select className="form-control" name="parentCourseId" defaultValue=""><option value="">Top-level course</option>{courses.map((course) => <option value={course.id} key={course.id}>{getCourseLabel(course, courses)}</option>)}</select></label>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Create course</button></div>
    </form>;
  }
  if (dialog === "tracker") {
    form = <form onSubmit={onTracker} className="wide-form">
      <label className="form-label">Tracker name<input className="form-control" name="trackerTitle" placeholder="e.g. Diwali cracker-free reward" required /></label>
      <label className="form-label">Scenario or criteria<textarea className="form-control" name="trackerDescription" rows={3} placeholder="Describe what the checked status means." /></label>
      <fieldset className="course-checklist"><legend>Include classes</legend>{classes.length === 0 ? <p className="row-detail">Create a class and enroll students first.</p> : classes.map((classItem) => <label className="course-choice" key={classItem.id}><input type="checkbox" name="classIds" value={classItem.id} />{classItem.name}</label>)}</fieldset>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={classes.length === 0}>Create tracker</button></div>
    </form>;
  }
  if (dialog === "class") {
    form = <form onSubmit={onClass} className="wide-form">
      <label className="form-label">Class name<input className="form-control" name="className" placeholder="e.g. Bal Bodh 2" required /></label>
      <label className="form-label">Learning level<input className="form-control" name="level" required /></label>
      <fieldset className="course-checklist"><legend>Class days</legend><div className="weekday-options">{weekdayOptions.map((day) => <label className="course-choice" key={day.value}><input type="checkbox" name="weekdays" value={day.value} defaultChecked={day.value === 0} />{day.label}</label>)}</div></fieldset>
      <label className="form-label">Start time<input className="form-control" type="time" name="startsAt" required /></label>
      <label className="form-label">Assigned teacher<select className="form-control" name="teacherUserId" defaultValue=""><option value="">Unassigned</option>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</select></label>
      <fieldset className="course-checklist"><legend>Courses in this class</legend>{courses.length === 0 ? <p className="row-detail">Create courses first, or leave this class without courses.</p> : courses.map((course) => <label className="course-choice" key={course.id}><input type="checkbox" name="courseIds" value={course.id} />{getCourseLabel(course, courses)}</label>)}</fieldset>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Create class</button></div>
    </form>;
  }

  return <div className="backdrop"><dialog open className="dialog" aria-labelledby="dialog-title">
    <div className="dialog-header"><h2 className="dialog-title" id="dialog-title">{getDialogTitle(dialog)}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
    {form}
  </dialog></div>;
}

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type StudentRow = { id: string; user_id: string | null; full_name: string; learning_level: string };
type ClassRow = { id: string; name: string; teacher_user_id: string | null; weekdays: number[]; starts_at: string | null };
type CourseRow = { id: string; title: string; description: string; parent_course_id: string | null; sort_order: number };
type ClassCourseRow = { class_id: string; course_id: string };

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function loadPortalData(supabase: SupabaseBrowserClient, tenantId: string, userId: string, role: Role, hasStudentRole: boolean, hasTeacherRole: boolean) {
  const studentQuery = supabase.from("students").select("id, user_id, full_name, learning_level").eq("paathshala_id", tenantId).eq("is_active", true).order("full_name");
  const eventQuery = supabase.from("events").select("id, title, starts_at, venue, is_paid").eq("paathshala_id", tenantId).eq("status", "published").order("starts_at");
  const courseQuery = supabase.from("courses").select("id, title, description, parent_course_id, sort_order").eq("paathshala_id", tenantId).eq("is_active", true).order("sort_order").order("title");
  const classCourseQuery = supabase.from("class_courses").select("class_id, course_id").eq("paathshala_id", tenantId);
  const classQuery = supabase.from("classes").select("id, name, teacher_user_id, weekdays, starts_at").eq("paathshala_id", tenantId).eq("is_active", true);
  const teacherQuery = supabase.from("paathshala_memberships").select("user_id").eq("paathshala_id", tenantId).eq("role", "teacher").eq("status", "active");
  const [studentResult, eventResult, courseResult, classCourseResult, classResult, registrationResult, teacherResult] = await Promise.all([
    studentQuery,
    eventQuery,
    courseQuery,
    classCourseQuery,
    classQuery,
    supabase.from("event_registrations").select("event_id").eq("paathshala_id", tenantId).eq("registrant_user_id", userId),
    teacherQuery,
  ]);
  const firstError = studentResult.error ?? eventResult.error ?? courseResult.error ?? classCourseResult.error ?? classResult.error ?? registrationResult.error ?? teacherResult.error;
  if (firstError) throw firstError;

  const studentRows = (studentResult.data ?? []) as StudentRow[];
  const allClassRows = (classResult.data ?? []) as ClassRow[];
  const courseRows = (courseResult.data ?? []) as CourseRow[];
  const classCourseRows = (classCourseResult.data ?? []) as ClassCourseRow[];
  const courseById = new Map(courseRows.map((course) => [course.id, course]));
  const students = filterStudentsForRole(studentRows, role, userId);
  const myStudentIds = hasStudentRole ? students.map((student) => student.id) : [];
  const enrollmentResult = hasStudentRole && myStudentIds.length > 0
    ? await supabase.from("class_enrollments").select("class_id, student_id").eq("paathshala_id", tenantId).in("student_id", myStudentIds)
    : { data: [], error: null };
  if (enrollmentResult.error) throw enrollmentResult.error;
  const studentClassIds = new Set((enrollmentResult.data ?? []).map((enrollment) => enrollment.class_id));
  const classRows = hasStudentRole ? allClassRows.filter((classRow) => studentClassIds.has(classRow.id)) : allClassRows;
  const firstClassId = classRows[0]?.id ?? null;
  const classRosterIds = await loadClassRosterIds(supabase, firstClassId);
  const [attendance, attendanceHistory, studentAttendanceHistory] = await Promise.all([
    loadAttendanceForDate(supabase, firstClassId, getLocalDate()),
    loadClassAttendanceHistory(supabase, firstClassId),
    hasStudentRole ? loadStudentAttendanceHistory(supabase, myStudentIds) : Promise.resolve({ analytics: {} as AttendanceAnalytics, sessionCount: 0 }),
  ]);
  const studentRequests = hasTeacherRole ? await loadPendingStudentRequests(supabase, tenantId) : [];
  const teacherRequests = hasTeacherRole ? await loadPendingTeacherRequests(supabase, tenantId) : [];
  const auditEntries = hasTeacherRole ? await loadAuditEntries(supabase, tenantId) : [];
  const activeTeacherIds = (teacherResult.data ?? []).map((teacher) => teacher.user_id);
  const teacherNames = await loadProfileNames(supabase, [...activeTeacherIds, ...classRows.flatMap((classRow) => classRow.teacher_user_id ? [classRow.teacher_user_id] : [])]);
  const teacherOptions = activeTeacherIds.map((id) => ({ id, name: teacherNames.get(id) || "Teacher" }));
  const registeredEventIds = new Set((registrationResult.data ?? []).map((registration) => String(registration.event_id)));
  const events = (eventResult.data ?? []).map((event) => mapEvent(event, registeredEventIds));
  const classes = classRows.map((classRow) => ({
    id: classRow.id,
    name: classRow.name,
    teacher: classRow.teacher_user_id ? teacherNames.get(classRow.teacher_user_id) ?? "Assigned teacher" : "Teacher to be assigned",
    teacherUserId: classRow.teacher_user_id,
    weekdays: classRow.weekdays ?? [0],
    startsAt: classRow.starts_at ?? "",
    time: formatClassTime(classRow.weekdays ?? [0], classRow.starts_at),
    courseIds: classCourseRows.filter((item) => item.class_id === classRow.id).map((item) => item.course_id),
    courseTitles: classCourseRows.filter((item) => item.class_id === classRow.id).map((item) => courseById.get(item.course_id)?.title ?? "Course"),
  }));
  const courses: CourseItem[] = courseRows.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    parentCourseId: course.parent_course_id,
  }));
  const studentTrackers = await loadStudentTrackers(supabase, tenantId);

  return {
    students,
    events,
    classes,
    studentTrackers,
    courses,
    teacherOptions,
    attendance,
    attendanceAnalytics: hasStudentRole ? studentAttendanceHistory.analytics : attendanceHistory.analytics,
    attendanceSessionCount: hasStudentRole ? studentAttendanceHistory.sessionCount : attendanceHistory.sessionCount,
    myStudentIds,
    classRosterIds,
    selectedClassId: firstClassId,
    studentRequests,
    teacherRequests,
    auditEntries,
  };
}

async function loadClassRosterIds(supabase: SupabaseBrowserClient, classId: string | null) {
  if (!classId) return [];
  const { data, error } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
  if (error) throw error;
  return (data ?? []).map((enrollment) => String(enrollment.student_id));
}

async function loadStudentTrackers(supabase: SupabaseBrowserClient, tenantId: string): Promise<StudentTracker[]> {
  const { data: trackerRows, error: trackerError } = await supabase.from("student_trackers")
    .select("id, title, description")
    .eq("paathshala_id", tenantId)
    .order("created_at", { ascending: false });
  if (trackerError) throw trackerError;
  const trackers = trackerRows ?? [];
  if (trackers.length === 0) return [];
  const trackerIds = trackers.map((tracker) => tracker.id);
  const { data: classLinks, error: classError } = await supabase.from("student_tracker_classes")
    .select("tracker_id, class_id")
    .eq("paathshala_id", tenantId)
    .in("tracker_id", trackerIds);
  if (classError) throw classError;
  const links = classLinks ?? [];
  const classIds = [...new Set(links.map((link) => link.class_id))];
  const [enrollmentResult, recordResult] = await Promise.all([
    classIds.length
      ? supabase.from("class_enrollments").select("class_id, student_id").eq("paathshala_id", tenantId).in("class_id", classIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("student_tracker_records").select("tracker_id, student_id, is_marked").eq("paathshala_id", tenantId).in("tracker_id", trackerIds),
  ]);
  if (enrollmentResult.error || recordResult.error) throw enrollmentResult.error ?? recordResult.error;
  const classIdsByTracker = new Map<string, Set<string>>();
  for (const link of links) {
    const assignedClasses = classIdsByTracker.get(link.tracker_id) ?? new Set<string>();
    assignedClasses.add(link.class_id);
    classIdsByTracker.set(link.tracker_id, assignedClasses);
  }
  const studentIdsByTracker = new Map<string, Set<string>>();
  for (const enrollment of enrollmentResult.data ?? []) {
    for (const [trackerId, assignedClasses] of classIdsByTracker) {
      if (!assignedClasses.has(enrollment.class_id)) continue;
      const studentIds = studentIdsByTracker.get(trackerId) ?? new Set<string>();
      studentIds.add(String(enrollment.student_id));
      studentIdsByTracker.set(trackerId, studentIds);
    }
  }
  const markedIdsByTracker = new Map<string, Set<string>>();
  for (const record of recordResult.data ?? []) {
    if (!record.is_marked) continue;
    const markedIds = markedIdsByTracker.get(record.tracker_id) ?? new Set<string>();
    markedIds.add(String(record.student_id));
    markedIdsByTracker.set(record.tracker_id, markedIds);
  }
  return trackers.map((tracker) => ({
    id: tracker.id,
    title: tracker.title,
    description: tracker.description,
    classIds: [...(classIdsByTracker.get(tracker.id) ?? [])],
    studentIds: [...(studentIdsByTracker.get(tracker.id) ?? [])],
    markedStudentIds: [...(markedIdsByTracker.get(tracker.id) ?? [])],
  }));
}

async function loadAttendanceForDate(supabase: SupabaseBrowserClient, classId: string | null, date: string) {
  if (!classId) return {};
  const { data: session, error: sessionError } = await supabase.from("attendance_sessions").select("id").eq("class_id", classId).eq("session_date", date).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return {};
  const { data: records, error } = await supabase.from("attendance_records").select("student_id, status").eq("session_id", session.id);
  if (error) throw error;
  return Object.fromEntries((records ?? []).map((record) => [String(record.student_id), toAttendanceStatus(record.status)]));
}

async function loadClassAttendanceHistory(supabase: SupabaseBrowserClient, classId: string | null) {
  if (!classId) return { analytics: {} as AttendanceAnalytics, sessionCount: 0 };
  const { data: sessions, error: sessionError } = await supabase.from("attendance_sessions")
    .select("id")
    .eq("class_id", classId)
    .lte("session_date", getLocalDate());
  if (sessionError) throw sessionError;
  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (sessionIds.length === 0) return { analytics: {} as AttendanceAnalytics, sessionCount: 0 };
  const { data: records, error } = await supabase.from("attendance_records")
    .select("student_id, status")
    .in("session_id", sessionIds);
  if (error) throw error;
  const analytics: AttendanceAnalytics = {};
  for (const record of records ?? []) {
    const stats = analytics[String(record.student_id)] ?? { present: 0, absent: 0, excused: 0 };
    if (record.status === "present") stats.present += 1;
    if (record.status === "absent") stats.absent += 1;
    if (record.status === "excused") stats.excused += 1;
    analytics[String(record.student_id)] = stats;
  }
  return { analytics, sessionCount: sessionIds.length };
}

async function loadStudentAttendanceHistory(supabase: SupabaseBrowserClient, studentIds: string[]) {
  if (studentIds.length === 0) return { analytics: {} as AttendanceAnalytics, sessionCount: 0 };
  const { data: records, error } = await supabase.from("attendance_records")
    .select("student_id, session_id, status")
    .in("student_id", studentIds);
  if (error) throw error;
  const analytics: AttendanceAnalytics = {};
  const sessionIds = new Set<string>();
  for (const record of records ?? []) {
    sessionIds.add(record.session_id);
    const stats = analytics[String(record.student_id)] ?? { present: 0, absent: 0, excused: 0 };
    if (record.status === "present") stats.present += 1;
    if (record.status === "absent") stats.absent += 1;
    if (record.status === "excused") stats.excused += 1;
    analytics[String(record.student_id)] = stats;
  }
  return { analytics, sessionCount: sessionIds.size };
}

async function loadPendingStudentRequests(supabase: SupabaseBrowserClient, tenantId: string): Promise<StudentAccessRequest[]> {
  const { data, error } = await supabase.from("paathshala_memberships")
    .select("id, user_id, created_at")
    .eq("paathshala_id", tenantId)
    .eq("role", "student")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  const memberships = data ?? [];
  const names = await loadProfileNames(supabase, memberships.map((membership) => membership.user_id));
  return memberships.map((membership) => ({
    id: membership.id,
    userId: membership.user_id,
    name: names.get(membership.user_id) ?? "Student applicant",
    createdAt: membership.created_at,
    status: "pending",
  }));
}

async function loadPendingTeacherRequests(supabase: SupabaseBrowserClient, tenantId: string): Promise<TeacherRequest[]> {
  const { data, error } = await supabase.from("paathshala_memberships")
    .select("id, user_id, created_at")
    .eq("paathshala_id", tenantId)
    .eq("role", "teacher")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  const memberships = data ?? [];
  const names = await loadProfileNames(supabase, memberships.map((membership) => membership.user_id));
  return memberships.map((membership) => ({
    id: membership.id,
    name: names.get(membership.user_id) ?? "Teacher applicant",
    createdAt: membership.created_at,
  }));
}

async function loadProfileNames(supabase: SupabaseBrowserClient, userIds: string[]) {
  const distinctUserIds = [...new Set(userIds)];
  if (distinctUserIds.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", distinctUserIds);
  if (error) throw error;
  return new Map((data ?? []).map((profile) => [profile.user_id, profile.full_name]));
}

async function loadAuditEntries(supabase: SupabaseBrowserClient, tenantId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("audit_logs")
    .select("id, actor_name, table_name, operation, record_id, old_values, new_values, changed_at")
    .eq("paathshala_id", tenantId)
    .order("changed_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((entry) => ({
    id: entry.id,
    actorName: entry.actor_name,
    tableName: entry.table_name,
    operation: entry.operation,
    recordId: entry.record_id,
    oldValues: entry.old_values,
    newValues: entry.new_values,
    changedAt: entry.changed_at,
  }));
}

function filterStudentsForRole(rows: StudentRow[], role: Role, userId: string): Student[] {
  if (role === "teacher") return rows.map(mapStudent);
  return rows.filter((student) => student.user_id === userId).map(mapStudent);
}

function mapStudent(student: StudentRow): Student {
  return { id: student.id, userId: student.user_id, name: student.full_name, level: student.learning_level };
}

function mapEvent(event: { id: string; title: string; starts_at: string; venue: string; is_paid: boolean }, registeredEventIds: Set<string>): CommunityEvent {
  const startsAt = new Date(event.starts_at);
  return {
    id: event.id,
    title: event.title,
    date: startsAt.toLocaleDateString("en", { day: "2-digit", timeZone: "UTC" }),
    month: startsAt.toLocaleDateString("en", { month: "short", timeZone: "UTC" }).toUpperCase(),
    place: event.venue,
    registered: registeredEventIds.has(event.id),
    isPaid: event.is_paid,
    startsAt: event.starts_at,
  };
}

function getPortalRoleContext(roles: Role[]) {
  const hasTeacherRole = roles.includes("teacher");
  const hasStudentRole = roles.includes("student");
  const role: Role = hasTeacherRole ? "teacher" : "student";
  const roleLabel = hasTeacherRole && hasStudentRole ? "Teacher & Student" : roleLabels[role];
  return { role, roleLabel, hasTeacherRole, hasStudentRole };
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function formatClassTime(weekdays: number[], startsAt: string | null) {
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = weekdays.length ? [...weekdays].sort((a, b) => a - b).map((weekday) => weekdayNames[weekday]).join(", ") : "Weekly";
  if (!startsAt) return day;
  return `${day} · ${formatStartTime(startsAt)}`;
}

function formatStartTime(startsAt: string) {
  if (!startsAt) return "Time not set";
  const [hours = "0", minutes = "00"] = startsAt.split(":");
  const hour = Number(hours);
  const period = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function getUpcomingClassOccurrences(classes: ClassItem[], now = new Date()) {
  return classes.flatMap((classItem) => {
    if (!classItem.startsAt) return [];
    const [hours = "0", minutes = "00"] = classItem.startsAt.split(":");
    return classItem.weekdays.map((weekday) => {
      const date = new Date(now);
      const daysUntil = (weekday - now.getDay() + 7) % 7;
      date.setDate(now.getDate() + daysUntil);
      date.setHours(Number(hours), Number(minutes), 0, 0);
      if (date <= now) date.setDate(date.getDate() + 7);
      return { classItem, date };
    });
  }).sort((first, second) => first.date.getTime() - second.date.getTime());
}

function toAttendanceStatus(status: string): AttendanceStatus {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  return "Excused";
}

function getDialogTitle(dialog: PortalDialog) {
  if (dialog === "event") return "Create an event";
  if (dialog === "tracker") return "Create a student tracker";
  if (dialog === "class") return "Create a weekly class";
  return "Create a course";
}

function getCourseLabel(course: CourseItem, courses: CourseItem[]): string {
  const parent = courses.find((item) => item.id === course.parentCourseId);
  return parent ? `${getCourseLabel(parent, courses)} / ${course.title}` : course.title;
}

function AttendanceChoice({ status, selected, onChange }: Readonly<{
  status: AttendanceStatus;
  selected: boolean;
  onChange: () => void;
}>) {
  let choiceClass = "choice-button";
  if (selected) choiceClass = status === "Absent" ? "choice-button selected absent" : "choice-button selected";
  let label = "E";
  if (status === "Present") label = "P";
  if (status === "Absent") label = "A";
  return <button type="button" className={choiceClass} onClick={onChange} aria-label={status} aria-pressed={selected}>{label}</button>;
}

function Overview({ role, hasStudentRole, students, myStudentIds, classes, events, attendance, attendanceRate, attendanceAnalytics, attendanceDate, classRosterIds, selectedClassId, onClassChange, onAttendanceChange, onSaveAttendance, onNavigate, onRegister }: Readonly<{
  role: Role;
  hasStudentRole: boolean;
  students: Student[];
  myStudentIds: string[];
  classes: ClassItem[];
  events: CommunityEvent[];
  attendance: Record<string, AttendanceStatus>;
  attendanceRate: number;
  attendanceAnalytics: AttendanceAnalytics;
  attendanceDate: string;
  classRosterIds: string[];
  selectedClassId: string | null;
  onClassChange: (id: string) => void;
  onAttendanceChange: (id: string | number, status: AttendanceStatus) => void;
  onSaveAttendance: () => void;
  onNavigate: (section: Section) => void;
  onRegister: (id: string | number) => void;
}>) {
  const isStaff = role === "teacher";
  const myStudents = hasStudentRole ? students.filter((student) => myStudentIds.includes(String(student.id))) : [];
  const rosterStudents = students.filter((student) => classRosterIds.includes(String(student.id)));
  const studentAttendanceTotals = myStudents.reduce((totals, student) => {
    const stats = attendanceAnalytics[String(student.id)];
    if (stats) {
      totals.present += stats.present;
      totals.absent += stats.absent;
      totals.excused += stats.excused;
    }
    return totals;
  }, { present: 0, absent: 0, excused: 0 });
  const studentMarkCount = studentAttendanceTotals.present + studentAttendanceTotals.absent + studentAttendanceTotals.excused;
  const studentRate = Math.round((studentAttendanceTotals.present / Math.max(studentMarkCount, 1)) * 100);
  const upcomingClasses = getUpcomingClassOccurrences(classes);
  const nextClass = upcomingClasses[0];
  const upcomingEventCount = events.filter((event) => event.startsAt && new Date(event.startsAt) >= new Date()).length;
  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId);
  const markedAttendanceCount = Object.keys(attendance).length;
  const metrics = isStaff
    ? [{ label: "Enrolled learners", value: String(students.length), note: "Active paathshala learners", icon: Users }, { label: "Weekly classes", value: String(classes.length), note: "Current class schedule", icon: BookOpen }, { label: "Selected class attendance", value: markedAttendanceCount ? `${attendanceRate}%` : "—", note: `${selectedClass?.name ?? "No class selected"} · ${attendanceDate}`, icon: ClipboardCheck }, { label: "Upcoming events", value: String(upcomingEventCount), note: "Published future events", icon: CalendarDays }]
    : [{ label: "My learning", value: String(myStudents.length), note: "Student membership", icon: GraduationCap }, { label: "Attendance", value: studentMarkCount ? `${studentRate}%` : "—", note: studentMarkCount ? `${studentMarkCount} saved marks` : "No attendance records", icon: ClipboardCheck }, { label: "Next class", value: nextClass ? nextClass.date.toLocaleDateString("en", { weekday: "short" }) : "—", note: nextClass ? `${nextClass.classItem.name} · ${formatStartTime(nextClass.classItem.startsAt)}` : "No upcoming class", icon: BookOpen }, { label: "Community events", value: String(upcomingEventCount), note: "Published future events", icon: CalendarDays }];

  return <>
    <div className="metrics">
      {metrics.map(({ label, value, note, icon: Icon }) => <div className="metric" key={label}>
        <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={15} /></span></div>
        <div className="metric-value">{value}</div><div className="metric-caption">{note}</div>
      </div>)}
    </div>
    <div className="content-grid">
      <div>
        {isStaff ? <AttendancePanel role={role} students={rosterStudents} rosterIds={classRosterIds} classes={classes} selectedClassId={selectedClassId} onClassChange={onClassChange} attendance={attendance} onChange={onAttendanceChange} onSave={onSaveAttendance} analytics={attendanceAnalytics} compact /> : <SchedulePanel students={myStudents} classes={classes} />}
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Coming together</h2><p className="panel-subtitle">Upcoming events at your paathshala</p></div><button className="quiet-button" onClick={() => onNavigate("events")}>All events <ArrowUpRight size={14} /></button></div>
          <div className="panel-body">
            {events.slice(0, 2).map((event) => <EventRow event={event} key={event.id} onRegister={onRegister} />)}
          </div>
        </section>
      </div>
      <div>
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Upcoming classes</h2><p className="panel-subtitle">From the current weekly schedules</p></div><span className="pill">{upcomingClasses.length} sessions</span></div>
          <div className="panel-body">
            {upcomingClasses.slice(0, 3).map(({ classItem, date }) => <div className="schedule-row" key={`${classItem.id}-${date.toISOString()}`}><div className="date-tile"><strong>{String(date.getDate()).padStart(2, "0")}</strong><span>{formatStartTime(date.toTimeString().slice(0, 5))}</span></div><div className="row-main"><p className="row-title">{classItem.name}</p><p className="row-detail">{classItem.teacher} · {date.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })} · {formatStartTime(classItem.startsAt)}</p></div><span className="pill">{classItem.courseTitles.length ? `${classItem.courseTitles.length} courses` : "Scheduled"}</span></div>)}
            {upcomingClasses.length === 0 && <div className="empty-state">No classes are scheduled yet.</div>}
            <div style={{ paddingTop: 13 }}><button className="secondary-button" onClick={() => onNavigate("classes")}><BookOpen size={14} /> View classes</button></div>
          </div>
        </section>
        <section className="panel" style={{ marginTop: 15 }}>
          <div className="panel-header"><div><h2 className="panel-title">Class teachers</h2><p className="panel-subtitle">Teacher assignment by class</p></div></div>
          <div className="panel-body">{classes.filter((classItem) => classItem.teacher !== "Teacher to be assigned").length === 0
            ? <div className="empty-state">No teachers are assigned to a class yet.</div>
            : classes.filter((classItem) => classItem.teacher !== "Teacher to be assigned").map((classItem) => <div className="teacher-card" key={classItem.id}><div className="teacher-initial">{classItem.teacher.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="row-main"><p className="row-title">{classItem.teacher}</p><p className="row-detail">{classItem.name} · {classItem.time}</p></div></div>)}</div>
        </section>
      </div>
    </div>
  </>;
}

function SchedulePanel({ students, classes }: Readonly<{ students: Student[]; classes: ClassItem[] }>) {
  const upcomingClasses = getUpcomingClassOccurrences(classes).slice(0, 3);
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Paathshala schedule</h2><p className="panel-subtitle">Upcoming scheduled sessions</p></div><span className="pill">{classes.length} classes</span></div>
    <div className="panel-body">
      {upcomingClasses.map(({ classItem, date }) => <div className="schedule-row" key={`${classItem.id}-${date.toISOString()}`}><div className="date-tile"><strong>{String(date.getDate()).padStart(2, "0")}</strong><span>{formatStartTime(classItem.startsAt).split(" ")[1]?.toUpperCase()}</span></div><div className="row-main"><p className="row-title">{classItem.name}</p><p className="row-detail">{date.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })} · {formatStartTime(classItem.startsAt)} · {classItem.teacher}</p></div></div>)}
      {upcomingClasses.length === 0 && <div className="empty-state">No classes are scheduled yet.</div>}
      {students.map((student) => <div className="student-row" key={student.id}><div className="avatar">{student.name.split(" ").map((part) => part[0]).join("")}</div><div className="row-main"><p className="row-title">{student.name}</p><p className="row-detail">{student.level} · enrolled</p></div></div>)}
    </div>
  </section>;
}

function AttendancePanel({ role, students, rosterIds, classes, selectedClassId, onClassChange, attendance, onChange, onSave, analytics = {}, sessionCount = 0, date = getLocalDate(), onDateChange = () => {}, compact = false }: Readonly<{
  role: Role;
  students: Student[];
  rosterIds: string[];
  classes: ClassItem[];
  selectedClassId: string | null;
  onClassChange: (id: string) => void;
  attendance: Record<string, AttendanceStatus>;
  onChange: (id: string | number, status: AttendanceStatus) => void;
  onSave: () => void;
  analytics?: AttendanceAnalytics;
  sessionCount?: number;
  date?: string;
  onDateChange?: (date: string) => void;
  compact?: boolean;
}>) {
  const isStaff = role === "teacher";
  let visibleStudents = students;
  if (isStaff) visibleStudents = students.filter((student) => rosterIds.includes(String(student.id)));
  const historyTotals = visibleStudents.reduce((totals, student) => {
    const stats = analytics[String(student.id)];
    if (stats) {
      totals.present += stats.present;
      totals.absent += stats.absent;
      totals.excused += stats.excused;
    }
    return totals;
  }, { present: 0, absent: 0, excused: 0 });
  const recordedMarks = historyTotals.present + historyTotals.absent + historyTotals.excused;
  const historyRate = Math.round((historyTotals.present / Math.max(recordedMarks, 1)) * 100);
  const markedCount = visibleStudents.filter((student) => attendance[String(student.id)]).length;
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">{isStaff ? "Class attendance roster" : "Learning attendance"}</h2><p className="panel-subtitle">{isStaff ? "Mark students and review their attendance history" : "Your attendance history this term"}</p></div>{isStaff && classes.length > 1 && <select className="role-select" aria-label="Attendance class" value={selectedClassId ?? ""} onChange={(event) => onClassChange(event.target.value)}>{classes.map((classItem) => <option value={classItem.id} key={classItem.id}>{classItem.name}</option>)}</select>}</div>
    {isStaff && !compact && <>
      <div className="attendance-toolbar"><label className="form-label">Session date<input className="form-control" aria-label="Attendance session date" type="date" value={date} max={getLocalDate()} onChange={(event) => onDateChange(event.target.value)} /></label></div>
      <div className="attendance-summary">
        <div><span>Class roster</span><strong>{visibleStudents.length}</strong></div>
        <div><span>Sessions recorded</span><strong>{sessionCount}</strong></div>
        <div><span>Historical attendance</span><strong>{recordedMarks ? `${historyRate}%` : "—"}</strong></div>
        <div><span>Marked on this date</span><strong>{markedCount}/{visibleStudents.length}</strong></div>
      </div>
    </>}
    <div className="panel-body">
      {!isStaff && <div className="attendance-bar"><div className="attendance-percent">{recordedMarks ? `${historyRate}%` : "—"}</div><div className="bar-track"><div className="bar-fill" style={{ width: `${historyRate}%` }} /></div><span className="row-detail">{recordedMarks ? `${recordedMarks} saved marks` : "No attendance records"}</span></div>}
      {isStaff ? <div className="roster-table-wrap"><table className="roster-table"><thead><tr><th>Student</th><th>Mark</th>{!compact && <th>History</th>}</tr></thead><tbody>
        {visibleStudents.slice(0, compact ? 3 : undefined).map((student) => {
          const stats = analytics[String(student.id)];
          const total = stats ? stats.present + stats.absent + stats.excused : 0;
          const rate = total ? Math.round((stats.present / total) * 100) : null;
          return <tr key={student.id}>
            <td><strong>{student.name}</strong><div className="row-detail">{student.level}</div></td>
            <td><div className="attendance-choice">{(["Present", "Absent", "Excused"] as AttendanceStatus[]).map((status) => <AttendanceChoice key={status} status={status} selected={attendance[String(student.id)] === status} onChange={() => onChange(student.id, status)} />)}</div></td>
            {!compact && <td><strong>{rate === null ? "No history" : `${rate}% · ${total} sessions`}</strong><div className="row-detail">{stats ? `${stats.present} present · ${stats.absent} absent · ${stats.excused} excused` : "No recorded marks"}</div></td>}
          </tr>;
        })}
      </tbody></table></div> : visibleStudents.map((student) => {
        const stats = analytics[String(student.id)];
        const total = stats ? stats.present + stats.absent + stats.excused : 0;
        const rate = total ? Math.round((stats.present / total) * 100) : null;
        return <div className="attendance-row" key={student.id}><div className="row-main"><p className="row-title">{student.name}</p><p className="row-detail">{stats ? `${stats.present} present · ${stats.absent} absent · ${stats.excused} excused` : "No attendance records yet"}</p></div><span className="pill">{rate === null ? "No history" : `${rate}% attendance`}</span></div>;
      })}
    </div>
    {isStaff && !compact && <div className="panel-header attendance-footer"><span className="row-detail">{markedCount} of {visibleStudents.length} learners marked for {date}</span><button type="button" className="primary-button" onClick={onSave}>Save attendance <Check size={14} /></button></div>}
  </section>;
}

function StudentsPanel({ role, students, classes, studentRequests, teacherRequests, onApproveStudent, onApproveTeacher, onEnroll }: Readonly<{
  role: Role;
  students: Student[];
  classes: ClassItem[];
  studentRequests: StudentAccessRequest[];
  teacherRequests: TeacherRequest[];
  onApproveStudent: (id: string) => void;
  onApproveTeacher: (id: string) => void;
  onEnroll: (studentId: string | number, classId: string) => void;
}>) {
  return <div className="content-grid">
    <section className="panel"><div className="panel-header"><div><h2 className="panel-title">{role === "teacher" ? "Active students" : "My student profile"}</h2><p className="panel-subtitle">{students.length} {students.length === 1 ? "student" : "students"} in this view</p></div></div>
      <div className="panel-body">{students.length === 0 ? <div className="empty-state">No active student membership is linked to this account yet.</div> : students.map((student) => <div className="student-row" key={student.id}><div className="avatar">{student.name.split(" ").map((part) => part[0]).join("")}</div><div className="row-main"><p className="row-title">{student.name}</p><p className="row-detail">{student.level}</p></div>{role === "teacher" ? <StudentEnrollmentControl studentId={student.id} classes={classes} onEnroll={onEnroll} /> : <span className="pill">Active</span>}</div>)}</div>
    </section>
    {role === "teacher" && <div>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Student access requests</h2><p className="panel-subtitle">Approve students joining this paathshala</p></div><span className="pill warm">{studentRequests.length} pending</span></div>
        <div className="panel-body">{studentRequests.length === 0 ? <div className="empty-state">No pending Student requests.</div> : studentRequests.map((request) => <div className="student-row" key={request.id}><div className="row-main"><p className="row-title">{request.name}</p><p className="row-detail">Requested {new Date(request.createdAt).toLocaleDateString()}</p></div><button type="button" className="secondary-button" onClick={() => onApproveStudent(request.id)}><Check size={13} /> Approve student</button></div>)}</div>
      </section>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Teacher access requests</h2><p className="panel-subtitle">Approve teachers joining this paathshala</p></div><span className="pill warm">{teacherRequests.length} pending</span></div>
        <div className="panel-body">{teacherRequests.length === 0 ? <div className="empty-state">No pending teacher requests.</div> : teacherRequests.map((request) => <div className="student-row" key={request.id}><div className="row-main"><p className="row-title">{request.name}</p><p className="row-detail">Requested {new Date(request.createdAt).toLocaleDateString()}</p></div><button type="button" className="secondary-button" onClick={() => onApproveTeacher(request.id)}><Check size={13} /> Approve teacher</button></div>)}</div>
      </section>
    </div>}
  </div>;
}

function StudentEnrollmentControl({ studentId, classes, onEnroll }: Readonly<{
  studentId: string | number;
  classes: ClassItem[];
  onEnroll: (studentId: string | number, classId: string) => void;
}>) {
  const [classId, setClassId] = useState("");
  return <div className="enroll-controls">
    <select className="form-control" aria-label="Class to enroll student in" value={classId} onChange={(event) => setClassId(event.target.value)}>
      <option value="">Assign class</option>
      {classes.map((classItem) => <option value={classItem.id} key={classItem.id}>{classItem.name}</option>)}
    </select>
    <button type="button" className="secondary-button" disabled={!classId} onClick={() => onEnroll(studentId, classId)}>Enroll</button>
  </div>;
}

function ClassesPanel({ role, classes, courses, teachers, onCreate, onAssignTeacher, onAssignCourses, onScheduleChange }: Readonly<{
  role: Role;
  classes: ClassItem[];
  courses: CourseItem[];
  teachers: TeacherOption[];
  onCreate: () => void;
  onAssignTeacher: (classId: string, teacherId: string | null) => void;
  onAssignCourses: (classId: string, courseIds: string[]) => void;
  onScheduleChange: (classId: string, weekdays: number[], startsAt: string) => void;
}>) {
  return <div className="content-grid"><section className="panel"><div className="panel-header"><div><h2 className="panel-title">Weekly classes</h2><p className="panel-subtitle">Your paathshala learning groups</p></div>{role === "teacher" && <button type="button" className="secondary-button" onClick={onCreate}><Plus size={14} /> Add class</button>}</div>
    <div className="panel-body">{classes.map((item) => <div className="event-row class-row" key={item.name}><div className="metric-icon"><BookOpen size={16} /></div><div className="row-main"><p className="row-title">{item.name}</p><p className="row-detail">{item.time} · {item.teacher}</p><p className="course-summary">{item.courseTitles.length ? item.courseTitles.join(" · ") : "No courses attached"}</p></div>{role === "teacher" && <div className="class-controls"><ClassTeacherControl classItem={item} teachers={teachers} onAssign={onAssignTeacher} /><ClassCourseControl classItem={item} courses={courses} onAssign={onAssignCourses} /><ClassScheduleControl classItem={item} onSave={onScheduleChange} /></div>}</div>)}</div>
  </section><div className="notice"><strong><School size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Learning year</strong>Classes follow the paathshala calendar. Your paathshala admin can update levels, teachers, and weekly timings.</div></div>;
}

function ClassScheduleControl({ classItem, onSave }: Readonly<{
  classItem: ClassItem;
  onSave: (classId: string, weekdays: number[], startsAt: string) => void;
}>) {
  const [weekdays, setWeekdays] = useState(classItem.weekdays);
  const [startsAt, setStartsAt] = useState(classItem.startsAt);
  return <details className="schedule-assignment">
    <summary>Change schedule</summary>
    <div className="course-checklist">
      <div className="weekday-options">{weekdayOptions.map((day) => <label className="course-choice" key={day.value}>
        <input type="checkbox" checked={weekdays.includes(day.value)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, day.value].sort((a, b) => a - b) : current.filter((value) => value !== day.value))} />
        {day.label}
      </label>)}</div>
      <label className="form-label">Start time<input className="form-control" type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
      <button type="button" className="secondary-button" onClick={() => onSave(classItem.id, weekdays, startsAt)}>Save schedule</button>
      <p className="row-detail">Past attendance stays with its original date.</p>
    </div>
  </details>;
}

function ClassCourseControl({ classItem, courses, onAssign }: Readonly<{
  classItem: ClassItem;
  courses: CourseItem[];
  onAssign: (classId: string, courseIds: string[]) => void;
}>) {
  const [selectedCourseIds, setSelectedCourseIds] = useState(classItem.courseIds);
  return <details className="course-assignment">
    <summary>Assign courses</summary>
    <div className="course-checklist">{courses.length === 0 ? <p className="row-detail">No courses available.</p> : courses.map((course) => <label className="course-choice" key={course.id}>
      <input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={(event) => setSelectedCourseIds((current) => event.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id))} />
      {getCourseLabel(course, courses)}
    </label>)}</div>
    <button type="button" className="secondary-button" onClick={() => onAssign(classItem.id, selectedCourseIds)}>Save courses</button>
  </details>;
}

function ClassTeacherControl({ classItem, teachers, onAssign }: Readonly<{
  classItem: ClassItem;
  teachers: TeacherOption[];
  onAssign: (classId: string, teacherId: string | null) => void;
}>) {
  const [teacherId, setTeacherId] = useState(classItem.teacherUserId ?? "");
  return <div className="enroll-controls">
    <select className="form-control" aria-label={`Teacher for ${classItem.name}`} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
      <option value="">Unassigned</option>
      {teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}
    </select>
    <button type="button" className="secondary-button" onClick={() => onAssign(classItem.id, teacherId || null)}>Save</button>
  </div>;
}

function CoursesPanel({ courses }: Readonly<{ courses: CourseItem[] }>) {
  const roots = courses.filter((course) => !course.parentCourseId);
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Paathshala courses</h2><p className="panel-subtitle">Organized as parent courses and nested topics.</p></div></div>
    <div className="panel-body">{roots.length === 0 ? <div className="empty-state">Create a top-level course to begin the catalogue.</div> : roots.map((course) => <CourseTreeItem key={course.id} course={course} courses={courses} depth={0} />)}</div>
  </section>;
}

function CourseTreeItem({ course, courses, depth }: Readonly<{ course: CourseItem; courses: CourseItem[]; depth: number }>) {
  const children = courses.filter((item) => item.parentCourseId === course.id);
  const parent = courses.find((item) => item.id === course.parentCourseId);
  const detail = [course.description, parent ? `Part of ${parent.title}` : ""].filter(Boolean).join(" · ");
  return <>
    <div className="course-tree-row" style={{ paddingInlineStart: 14 + depth * 22 }}>
      <div className="row-main"><p className="row-title">{course.title}</p>{detail && <p className="row-detail">{detail}</p>}</div>
      <span className="pill">{children.length} topics</span>
    </div>
    {children.map((child) => <CourseTreeItem key={child.id} course={child} courses={courses} depth={depth + 1} />)}
  </>;
}

function EventsPanel({ role, events, onRegister, onCreate }: Readonly<{ role: Role; events: CommunityEvent[]; onRegister: (id: string | number) => void; onCreate: () => void }>) {
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Open invitations</h2><p className="panel-subtitle">Hosted by this paathshala · RSVP only</p></div>{role === "teacher" && <button type="button" className="primary-button" onClick={onCreate}><Plus size={14} /> Create event</button>}</div>
    <div className="panel-body">{events.map((event) => <EventRow event={event} key={event.id} onRegister={onRegister} />)}</div>
  </section>;
}

function ActivityPanel({ entries }: Readonly<{ entries: AuditEntry[] }>) {
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Recent changes</h2><p className="panel-subtitle">Who changed what in this paathshala</p></div></div>
    <div className="panel-body">
      {entries.length === 0 ? <div className="empty-state">No recorded changes yet.</div> : entries.map((entry) => <div className="student-row" key={entry.id}>
        <div className="row-main"><p className="row-title">{entry.actorName} {auditVerb(entry.operation)} {entry.tableName.replaceAll("_", " ")}</p><p className="row-detail">Record {entry.recordId} · {new Date(entry.changedAt).toLocaleString()}</p><details className="audit-details"><summary>View changed data</summary><pre>{JSON.stringify({ before: entry.oldValues, after: entry.newValues }, null, 2)}</pre></details></div>
        <span className="pill">{entry.operation}</span>
      </div>)}
    </div>
  </section>;
}

function StudentTrackersPanel({ role, trackers, students, classes, onToggle }: Readonly<{
  role: Role;
  trackers: StudentTracker[];
  students: Student[];
  classes: ClassItem[];
  onToggle: (trackerId: string, studentId: string, isMarked: boolean) => void;
}>) {
  const canManage = role === "teacher";
  const visibleTrackers = trackers.map((tracker) => ({
    ...tracker,
    roster: tracker.studentIds.flatMap((id) => {
      const student = students.find((item) => String(item.id) === id);
      return student ? [student] : [];
    }),
  })).filter((tracker) => canManage || tracker.roster.length > 0);
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Student trackers</h2><p className="panel-subtitle">{canManage ? "Track a scenario across selected classes." : "Read-only status for your linked learners."}</p></div></div>
    <div className="panel-body">{visibleTrackers.length === 0 ? <div className="empty-state">{canManage ? "No student trackers have been created yet." : "No trackers include your linked learners yet."}</div> : visibleTrackers.map((tracker) => {
      const classNames = tracker.classIds.map((id) => classes.find((classItem) => classItem.id === id)?.name).filter(Boolean).join(" · ");
      return <section className="tracker-card" key={tracker.id}>
        <div className="tracker-heading"><div className="row-main"><h3 className="row-title">{tracker.title}</h3>{tracker.description && <p className="row-detail">{tracker.description}</p>}<p className="tracker-classes">Classes: {classNames || "None"}</p></div><span className="pill">{tracker.roster.length} learners</span></div>
        {tracker.roster.length === 0 ? <div className="empty-state">No enrolled learners in these classes.</div> : tracker.roster.map((student) => {
          const studentId = String(student.id);
          const isMarked = tracker.markedStudentIds.includes(studentId);
          return <div className="tracker-student-row" key={studentId}>
            <div className="row-main"><p className="row-title">{student.name}</p><p className="row-detail">{student.level}</p></div>
            {canManage
              ? <label className="tracker-toggle"><input type="checkbox" aria-label={`${tracker.title} status for ${student.name}`} checked={isMarked} onChange={(event) => onToggle(tracker.id, studentId, event.target.checked)} /><span>{isMarked ? "Marked" : "Not marked"}</span></label>
              : <span className={`pill ${isMarked ? "" : "warm"}`}>{isMarked ? "Marked" : "Not marked"}</span>}
          </div>;
        })}
      </section>;
    })}</div>
  </section>;
}

function auditVerb(operation: string) {
  if (operation === "INSERT") return "created";
  if (operation === "UPDATE") return "updated";
  return "deleted";
}

function EventRow({ event, onRegister }: Readonly<{ event: CommunityEvent; onRegister: (id: string | number) => void }>) {
  return <div className="event-card"><div className="event-date"><strong>{event.date}</strong><span>{event.month}</span></div><div className="row-main"><p className="row-title">{event.title}</p><p className="row-detail">{event.place} · Paathshala community · {event.isPaid ? "Paid event" : "Free event"}</p></div><button className={event.registered ? "secondary-button" : "primary-button"} onClick={() => onRegister(event.id)}>{event.registered ? <><Check size={13} /> Registered</> : "Register"}</button></div>;
}