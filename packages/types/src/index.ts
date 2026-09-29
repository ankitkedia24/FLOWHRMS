/**
 * FlowHRMS Core Shared Types
 * Pure TypeScript interfaces shared between Next.js Web and Expo Mobile.
 */

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
}

export interface AttendancePunchPayload {
  coordinates: Coordinates;
  accuracyM: number;
  photoUrl?: string;
  note?: string;
}

export interface AttendanceStatusResponse {
  checkedIn: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkingMinutes?: number;
  isInsideGeofence: boolean;
  nearestBranchName?: string;
  distanceM?: number;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveBalance {
  type: string;
  total: number;
  used: number;
  available: number;
}

export interface LeaveRequestPayload {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED";
  dueDate?: string;
}
