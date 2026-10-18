# Course Timetable Modal Homework Integration Implementation Plan

Enhance the course details modal (opened when clicking a subject in the Timetable) to display a dedicated assignment card list with completion status, due dates, and direct checkbox toggling for that specific course.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Course Homework Section**: When clicking a course in the timetable, the course modal will display all homework assignments associated with that course name.
> - **Interactive Toggling**: Users can check off homework directly within the course modal with real-time state sync.

## 1. Overview & Core Concept

- **What It Does**: When a user clicks a course card in the timetable (`TimetableTab.tsx` / `CourseModal.tsx`), the modal displays a dedicated "课程相关作业" (Course Assignments) section listing brief titles, deadlines, and interactive completion checkboxes.
- **Key Value**: Streamlines the workflow so students can instantly view and check off homework tied to a specific class right from their timetable view.

## 2. Technical Architecture & Data Strategy

- **Component Updates (`CourseModal.tsx`)**:
  - Accept `homework` prop (list of all homework items).
  - Filter homework items matching `activeCourse.name`.
  - Render an assignment card list inside the modal with completion toggles (`onToggleHomework`).
