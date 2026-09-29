import { z } from "zod";

/**
 * Shared Auth validation schema
 */
export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Attendance punch validation schema
 * FlowHRMS policy requires GPS accuracy < 200m
 */
export const attendancePunchSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().max(200, "GPS accuracy must be 200 meters or better"),
  photoUrl: z.string().url().optional(),
  note: z.string().max(500).optional(),
});

export type AttendancePunchInput = z.infer<typeof attendancePunchSchema>;

/**
 * Leave application validation schema
 */
export const applyLeaveSchema = z.object({
  leaveType: z.string().min(1, "Please select a leave type"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  reason: z.string().min(5, "Please provide a reason (at least 5 characters)").max(500),
  isHalfDay: z.boolean().default(false),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
