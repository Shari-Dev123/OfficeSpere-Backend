// models/Attendance.js
// Updated to match attendanceController.js structure

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkInTime: {
      type: Date,
    },
    checkInLocation: {
      type: String,
      enum: ['Office', 'Remote', 'Field'],
      default: 'Office',
    },
    checkInIpAddress: String,
    checkInDeviceInfo: String,
    checkInMethod: {
      type: String,
      enum: ['Auto', 'Manual', 'QR Code', 'WiFi', 'Bluetooth'],
      default: 'Manual',
    },
    checkOutTime: {
      type: Date,
    },
    checkOutLocation: {
      type: String,
      enum: ['Office', 'Remote', 'Field'],
    },
    checkOutIpAddress: String,
    checkOutDeviceInfo: String,
    checkOutMethod: {
      type: String,
      enum: ['Auto', 'Manual', 'QR Code', 'WiFi', 'Bluetooth'],
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'leave', 'half-day', 'work-from-home'],
      default: 'present',
    },
    workHours: {
      type: Number,
      default: 0, // in hours
    },
    breaks: [
      {
        startTime: Date,
        endTime: Date,
        duration: Number, // in minutes
        type: {
          type: String,
          enum: ['Lunch', 'Tea', 'Other'],
          default: 'Other',
        },
      },
    ],
    totalBreakTime: {
      type: Number,
      default: 0, // in minutes
    },
    productiveHours: {
      type: Number,
      default: 0, // work hours - break time
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    lateBy: {
      type: Number,
      default: 0, // in minutes
    },
    earlyLeave: {
      type: Boolean,
      default: false,
    },
    earlyBy: {
      type: Number,
      default: 0, // in minutes
    },
    notes: {
      type: String,
      trim: true,
    },
    // Correction Request (embedded)
    correctionRequest: {
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: String,
      correctCheckInTime: Date,
      correctCheckOutTime: Date,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      approvedAt: Date,
      requestedAt: Date,
      adminNotes: String,
    },
    // Leave Request (embedded)
    leaveRequest: {
      leaveType: {
        type: String,
        enum: ['sick', 'casual', 'vacation', 'emergency', 'unpaid'],
      },
      reason: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      approvedAt: Date,
      requestedAt: Date,
      adminNotes: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for employee + date (unique attendance per day)
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });

// Calculate working hours on save
attendanceSchema.pre('save', function(next) {
  if (this.checkInTime && this.checkOutTime) {
    const diffMs = this.checkOutTime - this.checkInTime;
    const hours = diffMs / (1000 * 60 * 60);
    this.workHours = Math.round(hours * 100) / 100;
    
    // Calculate productive hours (working hours - breaks)
    this.productiveHours = this.workHours - (this.totalBreakTime / 60);
  }
  next();
});



module.exports = mongoose.model('Attendance', attendanceSchema);