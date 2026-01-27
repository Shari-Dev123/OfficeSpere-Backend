const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    tasksCompleted: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Task',
        },
        description: String,
        hoursSpent: Number,
        status: String,
      },
    ],
    tasksInProgress: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Task',
        },
        description: String,
        progress: Number, // percentage
        blockers: String,
      },
    ],
    plannedForTomorrow: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Task',
        },
        description: String,
        estimatedHours: Number,
      },
    ],
    achievements: {
      type: String,
    },
    challenges: {
      type: String,
    },
    blockers: {
      type: String,
    },
    suggestions: {
      type: String,
    },
    totalHoursWorked: {
      type: Number,
      required: true,
      min: 0,
      max: 24,
    },
    productivityRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    mood: {
      type: String,
      enum: ['Excellent', 'Good', 'Okay', 'Low', 'Stressed'],
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    feedback: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Submitted', 'Reviewed', 'Approved'],
      default: 'Submitted',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for employee + date (one report per day)
dailyReportSchema.index({ employee: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ date: 1 });
dailyReportSchema.index({ status: 1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);