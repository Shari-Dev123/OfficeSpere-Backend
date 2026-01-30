const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    designation: {
      type: String,
      default: 'System Administrator',
    },
    department: {
      type: String,
      default: 'Administration',
    },
    permissions: {
      manageEmployees: { type: Boolean, default: true },
      manageClients: { type: Boolean, default: true },
      manageProjects: { type: Boolean, default: true },
      manageTasks: { type: Boolean, default: true },
      manageAttendance: { type: Boolean, default: true },
      manageMeetings: { type: Boolean, default: true },
      viewReports: { type: Boolean, default: true },
      manageSettings: { type: Boolean, default: true },
    },
    
    // ============================================
    // COMPANY SETTINGS
    // ============================================
    companyInfo: {
      companyName: { 
        type: String, 
        default: 'OfficeSphere Solutions' 
      },
      email: { 
        type: String, 
        default: 'info@officesphere.com' 
      },
      phone: { 
        type: String, 
        default: '+1 (555) 123-4567' 
      },
      address: { 
        type: String, 
        default: '123 Business Street, Suite 100' 
      },
      city: { 
        type: String, 
        default: 'San Francisco' 
      },
      state: { 
        type: String, 
        default: 'CA' 
      },
      zipCode: { 
        type: String, 
        default: '94102' 
      },
      country: { 
        type: String, 
        default: 'USA' 
      },
      website: { 
        type: String, 
        default: 'www.officesphere.com' 
      },
      logo: { 
        type: String, 
        default: '' 
      },
      // Old fields for backward compatibility
      companyEmail: String,
      companyPhone: String,
      companyAddress: String,
      companyWebsite: String,
      taxId: String,
    },

    // ============================================
    // WORK SETTINGS
    // ============================================
    workSettings: {
      workingDays: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      startTime: { 
        type: String, 
        default: '09:00' 
      },
      endTime: { 
        type: String, 
        default: '18:00' 
      },
      lunchBreak: { 
        type: String, 
        default: '60' 
      },
      timezone: { 
        type: String, 
        default: 'America/Los_Angeles' 
      },
      weekendDays: {
        type: [String],
        default: ['Saturday', 'Sunday'],
      },
    },

    // ============================================
    // ATTENDANCE SETTINGS
    // ============================================
    attendanceSettings: {
      autoCheckout: { 
        type: Boolean, 
        default: true 
      },
      lateThreshold: { 
        type: String, 
        default: '15' 
      },
      halfDayHours: { 
        type: String, 
        default: '4' 
      },
      fullDayHours: { 
        type: String, 
        default: '8' 
      },
      overtimeRate: { 
        type: String, 
        default: '1.5' 
      },
      allowManualCorrection: { 
        type: Boolean, 
        default: true 
      },
    },

    // ============================================
    // EMAIL NOTIFICATION SETTINGS
    // ============================================
    emailSettings: {
      notifyNewEmployee: { 
        type: Boolean, 
        default: true 
      },
      notifyTaskAssignment: { 
        type: Boolean, 
        default: true 
      },
      notifyMeetings: { 
        type: Boolean, 
        default: true 
      },
      dailyReports: { 
        type: Boolean, 
        default: true 
      },
      weeklyReports: { 
        type: Boolean, 
        default: true 
      },
      monthlyReports: { 
        type: Boolean, 
        default: false 
      },
    },

    // ============================================
    // OLD SETTINGS (for backward compatibility)
    // ============================================
    settings: {
      autoApproveLeave: { type: Boolean, default: false },
      requireApprovalForTasks: { type: Boolean, default: true },
      allowEmployeeTaskCreation: { type: Boolean, default: false },
      workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
      },
      workingDays: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// METHODS
// ============================================

// Get formatted settings for frontend
adminSchema.methods.getFormattedSettings = function() {
  return {
    company: {
      companyName: this.companyInfo.companyName,
      email: this.companyInfo.email,
      phone: this.companyInfo.phone,
      address: this.companyInfo.address,
      city: this.companyInfo.city,
      state: this.companyInfo.state,
      zipCode: this.companyInfo.zipCode,
      country: this.companyInfo.country,
      website: this.companyInfo.website,
      logo: this.companyInfo.logo,
    },
    work: {
      workingDays: this.workSettings.workingDays,
      startTime: this.workSettings.startTime,
      endTime: this.workSettings.endTime,
      lunchBreak: this.workSettings.lunchBreak,
      timezone: this.workSettings.timezone,
      weekendDays: this.workSettings.weekendDays,
    },
    attendance: {
      autoCheckout: this.attendanceSettings.autoCheckout,
      lateThreshold: this.attendanceSettings.lateThreshold,
      halfDayHours: this.attendanceSettings.halfDayHours,
      fullDayHours: this.attendanceSettings.fullDayHours,
      overtimeRate: this.attendanceSettings.overtimeRate,
      allowManualCorrection: this.attendanceSettings.allowManualCorrection,
    },
    email: {
      notifyNewEmployee: this.emailSettings.notifyNewEmployee,
      notifyTaskAssignment: this.emailSettings.notifyTaskAssignment,
      notifyMeetings: this.emailSettings.notifyMeetings,
      dailyReports: this.emailSettings.dailyReports,
      weeklyReports: this.emailSettings.weeklyReports,
      monthlyReports: this.emailSettings.monthlyReports,
    },
  };
};

module.exports = mongoose.model('Admin', adminSchema);