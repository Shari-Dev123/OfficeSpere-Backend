// controllers/attendanceController.js
// Attendance Check-in/Check-out, Corrections, Leave Requests

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// ==================== EMPLOYEE ATTENDANCE ====================

// @desc    Check in (Clock in)
// @route   POST /api/employee/attendance/checkin
// @access  Private (Employee)
exports.markAttendance = async (req, res) => {
  try {
    const { employeeId, date, checkInTime, checkInLocation, status } = req.body;

    // Check if attendance already exists for today
    const existingAttendance = await Attendance.findOne({
      employeeId,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (existingAttendance && existingAttendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    // Get employee details
    const employee = await Employee.findById(employeeId).populate('userId', 'name email');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create or update attendance
    const attendance = await Attendance.findOneAndUpdate(
      { employeeId, date: new Date(date).setHours(0, 0, 0, 0) },
      {
        checkInTime: checkInTime || new Date(),
        checkInLocation: checkInLocation || 'Office',
        status: status || 'present',
        checkInIpAddress: req.ip,
        checkInDeviceInfo: req.headers['user-agent']
      },
      { new: true, upsert: true }
    ).populate('employeeId', 'name email department');

    // ✅ EMIT SOCKET EVENT TO ALL ADMINS
    try {
      const io = getIO();
      io.to('admin').emit('attendance-marked', {
        employeeId: employeeId,
        employeeName: employee.userId?.name || employee.name || 'Unknown',
        checkIn: attendance.checkInTime,
        status: attendance.status,
        date: attendance.date,
        location: attendance.checkInLocation
      });
      console.log('📡 Attendance event emitted to admins');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// REPLACE YOUR checkOut FUNCTION WITH THIS:
exports.checkOut = async (req, res) => {
  try {
    const { employeeId, checkOutTime } = req.body;
    const today = new Date().setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out'
      });
    }

    // Update checkout
    attendance.checkOutTime = checkOutTime || new Date();
    attendance.checkOutIpAddress = req.ip;
    attendance.checkOutDeviceInfo = req.headers['user-agent'];
    await attendance.save();

    // Get employee details
    const employee = await Employee.findById(employeeId).populate('userId', 'name');

    // ✅ EMIT SOCKET EVENT
    try {
      const io = getIO();
      io.to('admin').emit('attendance-updated', {
        employeeId: employeeId,
        employeeName: employee?.userId?.name || 'Unknown',
        checkOut: attendance.checkOutTime,
        checkIn: attendance.checkInTime,
        workHours: attendance.workHours,
        date: attendance.date
      });
      console.log('📡 Check-out event emitted to admins');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: attendance
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

// Fixed checkIn function for attendanceController.js
// Replace your existing checkIn function with this

// controllers/attendanceController.js
// UPDATED - Fixed employeeId resolution


// ==========================================
// EMPLOYEE - Check In
// ==========================================
exports.checkIn = async (req, res) => {
  try {
    console.log('====================================');
    console.log('🔐 CHECK-IN REQUEST RECEIVED');
    console.log('====================================');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);

    // ✅ FIX: Get employeeId from User's ID
    const userId = req.user._id || req.user.id;

    console.log('👤 Looking for employee with userId:', userId);

    // Find employee document by userId
    const employee = await Employee.findOne({ userId: userId })
      .populate('userId', 'name email');

    if (!employee) {
      console.error('❌ Employee not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.',
        debug: { userId }
      });
    }

    console.log('✅ Employee found:', {
      _id: employee._id,
      employeeId: employee.employeeId,
      name: employee.userId?.name
    });

    const { location, notes, timestamp } = req.body;

    // ✅ Get today's date at midnight (local timezone)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const today = new Date(year, month, day, 0, 0, 0, 0);

    console.log('📅 Today date (start of day):', today);

    // ✅ Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: today
    });

    console.log('🔍 Existing attendance:', existingAttendance);

    if (existingAttendance && existingAttendance.checkInTime && !existingAttendance.checkOutTime) {
      console.log('⚠️ Already checked in today');
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today',
        data: existingAttendance
      });
    }

    // ✅ Prepare check-in time
    const checkInTime = timestamp ? new Date(timestamp) : new Date();

    console.log('⏰ Check-in time:', checkInTime);

    // ✅ Build attendance data object
    const attendanceData = {
      employeeId: employee._id, // ✅ Use Employee document _id
      date: today, // ✅ Use start of day
      checkInTime: checkInTime,
      checkInMethod: 'Manual',
      status: 'present'
    };

    // ✅ Handle location data properly
    if (location?.latitude !== undefined && location?.longitude !== undefined) {
      attendanceData.checkInCoordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      };
      attendanceData.checkInLocation = 'Remote';
    } else {
      attendanceData.checkInLocation = 'Office';
    }

    // Add IP and device info
    attendanceData.checkInIpAddress = req.ip || req.connection.remoteAddress;
    attendanceData.checkInDeviceInfo = req.headers['user-agent'];

    if (notes) {
      attendanceData.notes = notes;
    }

    console.log('💾 Saving attendance data:', attendanceData);

    // ✅ Create or update attendance record
    let attendance;
    if (existingAttendance) {
      Object.assign(existingAttendance, attendanceData);
      attendance = await existingAttendance.save();
      console.log('✅ Updated existing attendance record');
    } else {
      attendance = await Attendance.create(attendanceData);
      console.log('✅ Created new attendance record');
    }

    // ✅ Emit socket event to admin
    try {
      const io = getIO();
      io.to('admin').emit('attendance-marked', {
        employeeId: employee._id,
        employeeName: employee.userId?.name || 'Unknown',
        checkIn: attendance.checkInTime,
        status: attendance.status,
        date: attendance.date,
        location: attendance.checkInLocation
      });
      console.log('📡 Socket event emitted to admin');
    } catch (socketError) {
      console.error('⚠️ Socket emit error:', socketError.message);
    }

    console.log('====================================');
    console.log('✅ CHECK-IN SUCCESSFUL');
    console.log('Attendance ID:', attendance._id);
    console.log('====================================');

    res.status(200).json({
      success: true,
      message: 'Checked in successfully',
      data: attendance,
      checkInTime: attendance.checkInTime
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ CHECK-IN ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('====================================');

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check in',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// ==========================================
// EMPLOYEE - Check Out
// ==========================================
exports.checkOut = async (req, res) => {
  try {
    console.log('====================================');
    console.log('🚪 CHECK-OUT REQUEST RECEIVED');
    console.log('====================================');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);

    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId: userId })
      .populate('userId', 'name email');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    console.log('✅ Employee found:', employee.employeeId);

    const { location, timestamp, totalSeconds, autoCheckout, reason } = req.body;

    // ✅ Get today's date
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const today = new Date(year, month, day, 0, 0, 0, 0);

    console.log('📅 Looking for attendance on:', today);

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: today
    });

    console.log('🔍 Found attendance:', attendance ? 'YES' : 'NO');

    if (!attendance || !attendance.checkInTime) {
      console.log('❌ No check-in record found');
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    if (attendance.checkOutTime) {
      console.log('⚠️ Already checked out');
      return res.status(400).json({
        success: false,
        message: 'Already checked out',
        data: attendance
      });
    }

    // ✅ Set checkout time
    const checkOutTime = timestamp ? new Date(timestamp) : new Date();
    attendance.checkOutTime = checkOutTime;

    console.log('⏰ Check-out time:', checkOutTime);
    console.log('⏰ Check-in time:', attendance.checkInTime);

    // ✅ Handle location
    if (location?.latitude && location?.longitude) {
      attendance.checkOutCoordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      };
      attendance.checkOutLocation = 'Remote';
    } else {
      attendance.checkOutLocation = 'Office';
    }

    attendance.checkOutMethod = 'Manual';
    attendance.checkOutIpAddress = req.ip;
    attendance.checkOutDeviceInfo = req.headers['user-agent'];

    // ✅ Auto-checkout notes
    if (autoCheckout) {
      attendance.notes = (attendance.notes || '') + ` | Auto checkout: ${reason}`;
    }

    // ✅ Calculate work hours (will be done by pre-save hook)
    await attendance.save();

    console.log('✅ Work hours calculated:', attendance.workHours);

    // ✅ Emit socket event
    try {
      const io = getIO();
      io.to('admin').emit('attendance-updated', {
        employeeId: employee._id,
        employeeName: employee.userId?.name || 'Unknown',
        checkOut: attendance.checkOutTime,
        checkIn: attendance.checkInTime,
        workHours: attendance.workHours,
        date: attendance.date
      });
      console.log('📡 Socket event emitted to admin');
    } catch (socketError) {
      console.error('⚠️ Socket error:', socketError.message);
    }

    console.log('====================================');
    console.log('✅ CHECK-OUT SUCCESSFUL');
    console.log('====================================');

    // ✅ Return complete data with both field names for compatibility
    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: {
        ...attendance.toObject(),
        checkOut: attendance.checkOutTime // ✅ Add alias
      },
      checkOut: attendance.checkOutTime,  // ✅ Top-level for backward compatibility
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      workHours: attendance.workHours
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ CHECK-OUT ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('====================================');

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check out'
    });
  }
};



// ==========================================
// EMPLOYEE - Get Attendance Status
// ==========================================
exports.getAttendanceStatus = async (req, res) => {
  try {
    // ✅ FIX: Handle different ways employeeId might be stored
    let employeeId = req.user.employeeId || req.user.employee || req.user._id || req.user.id;

    if (!employeeId && req.user.role === 'employee') {
      employeeId = req.user._id || req.user.id;
    }

    console.log('📊 Getting attendance status for:', {
      fullUser: req.user,
      employeeId
    });

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID not found'
      });
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance
    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        message: 'No attendance record for today',
        data: null,
        isCheckedIn: false,
        isCheckedOut: false
      });
    }

    const isCheckedIn = !!attendance.checkInTime && !attendance.checkOutTime;
    const isCheckedOut = !!attendance.checkInTime && !!attendance.checkOutTime;

    res.status(200).json({
      success: true,
      data: attendance,
      isCheckedIn,
      isCheckedOut,
      checkInTime: attendance.checkInTime,
      checkOut: attendance.checkOutTime,
      status: attendance.status
    });

  } catch (error) {
    console.error('❌ Get attendance status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get attendance status'
    });
  }
};

// ==========================================
// EMPLOYEE - Get My Attendance
// ==========================================
exports.getAttendanceStatus = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📊 GET ATTENDANCE STATUS CALLED');
    console.log('====================================');
    console.log('req.user:', req.user);

    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      console.log('❌ Employee not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    console.log('✅ Employee found:', employee.employeeId);

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('📅 Looking for attendance on:', today);

    // Find today's attendance
    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: today
    });

    console.log('🔍 Attendance found:', attendance ? 'YES' : 'NO');

    if (!attendance) {
      console.log('⭕ No attendance record for today');
      return res.status(200).json({
        success: true,
        message: 'No attendance record for today',
        data: null,
        isCheckedIn: false,
        isCheckedOut: false
      });
    }

    const isCheckedIn = Boolean(attendance.checkInTime && !attendance.checkOutTime);
    const isCheckedOut = Boolean(attendance.checkInTime && attendance.checkOutTime);

    console.log('Status:', {
      isCheckedIn,
      isCheckedOut,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime
    });

    console.log('====================================');

    res.status(200).json({
      success: true,
      data: {
        ...attendance.toObject(),
        checkOut: attendance.checkOutTime // ✅ Add alias
      },
      isCheckedIn,
      isCheckedOut,
      checkInTime: attendance.checkInTime,
      checkOut: attendance.checkOutTime,
      checkOutTime: attendance.checkOutTime,
      status: attendance.status
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ GET STATUS ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('====================================');

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get attendance status'
    });
  }
};


// ==========================================
// EMPLOYEE - Get Attendance Summary
// ==========================================
exports.getAttendanceSummary = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetYear, targetMonth + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate }
    });

    const summary = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.isLate).length,
      leaves: attendance.filter(a => a.status === 'leave').length,
      workFromHome: attendance.filter(a => a.status === 'work-from-home').length,
      totalWorkHours: attendance.reduce((sum, a) => sum + (a.workHours || 0), 0),
      averageWorkHours: attendance.length > 0
        ? attendance.reduce((sum, a) => sum + (a.workHours || 0), 0) / attendance.length
        : 0
    };

    res.status(200).json({
      success: true,
      data: summary,
      month: targetMonth + 1,
      year: targetYear
    });

  } catch (error) {
    console.error('❌ Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get attendance summary'
    });
  }
};

// ==========================================
// EMPLOYEE - Request Correction
// ==========================================
exports.requestCorrection = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const { date, reason, correctCheckInTime, correctCheckOutTime } = req.body;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: targetDate
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found for this date'
      });
    }

    attendance.correctionRequest = {
      requestedBy: userId,
      reason,
      correctCheckInTime: correctCheckInTime ? new Date(correctCheckInTime) : undefined,
      correctCheckOutTime: correctCheckOutTime ? new Date(correctCheckOutTime) : undefined,
      status: 'pending',
      requestedAt: new Date()
    };

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Correction request submitted successfully',
      data: attendance
    });

  } catch (error) {
    console.error('❌ Request correction error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request correction'
    });
  }
};


// ==========================================
// EMPLOYEE - Request Leave
// ==========================================
exports.requestLeave = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const { date, leaveType, reason } = req.body;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists
    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: targetDate
    });

    if (attendance) {
      attendance.leaveRequest = {
        leaveType,
        reason,
        status: 'pending',
        requestedAt: new Date()
      };
      attendance.status = 'leave';
    } else {
      attendance = await Attendance.create({
        employeeId: employee._id,
        date: targetDate,
        status: 'leave',
        leaveRequest: {
          leaveType,
          reason,
          status: 'pending',
          requestedAt: new Date()
        }
      });
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: attendance
    });

  } catch (error) {
    console.error('❌ Request leave error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request leave'
    });
  }
};

// Placeholder for other functions
exports.getMyCorrections = async (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
};

exports.getMyLeaves = async (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
};

exports.getTodayAttendance = async (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
};

module.exports = exports;
// @desc    Get my attendance records
// @route   GET /api/employee/attendance
// @access  Private (Employee)
exports.getMyAttendance = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const {
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Build query
    const query = { employeeId: employee._id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get current attendance status
// @route   GET /api/employee/attendance/status
// @access  Private (Employee)
exports.getAttendanceStatus = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: today }
    });

    if (!todayAttendance) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'not-checked-in',
          message: 'You have not checked in today',
          attendance: null
        }
      });
    }

    const status = todayAttendance.checkOutTime
      ? 'checked-out'
      : 'checked-in';

    res.status(200).json({
      success: true,
      data: {
        status,
        message: status === 'checked-in'
          ? 'You are currently checked in'
          : 'You have checked out for today',
        attendance: todayAttendance
      }
    });

  } catch (error) {
    console.error('Get attendance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get attendance summary
// @route   GET /api/employee/attendance/summary
// @access  Private (Employee)
exports.getAttendanceSummary = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { month, year } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Default to current month/year
    const targetMonth = month ? parseInt(month) : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Get start and end of month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const attendance = await Attendance.find({
      employeeId: employee._id,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });

    // Calculate statistics
    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const lateDays = attendance.filter(a => a.isLate).length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const leaveDays = attendance.filter(a => a.status === 'leave').length;

    const totalWorkHours = attendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
    const averageWorkHours = totalDays > 0 ? (totalWorkHours / totalDays).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth + 1,
        year: targetYear,
        summary: {
          totalDays,
          presentDays,
          lateDays,
          absentDays,
          leaveDays,
          totalWorkHours: totalWorkHours.toFixed(2),
          averageWorkHours
        },
        attendance
      }
    });

  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Request attendance correction
// @route   POST /api/employee/attendance/correction
// @access  Private (Employee)
exports.requestCorrection = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const {
      date,
      reason,
      correctCheckInTime,
      correctCheckOutTime
    } = req.body;

    if (!date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Date and reason are required'
      });
    }

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Find attendance record for the date
    const requestDate = new Date(date);
    requestDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: requestDate
    });

    // If no attendance record exists, create one
    if (!attendance) {
      attendance = await Attendance.create({
        employeeId: employee._id,
        date: requestDate,
        status: 'absent',
        notes: 'Correction requested'
      });
    }

    // Create correction request
    const correctionRequest = {
      requestedBy: employeeId,
      reason,
      status: 'pending',
      requestedAt: new Date()
    };

    if (correctCheckInTime) {
      correctionRequest.correctCheckInTime = new Date(correctCheckInTime);
    }
    if (correctCheckOutTime) {
      correctionRequest.correctCheckOutTime = new Date(correctCheckOutTime);
    }

    attendance.correctionRequest = correctionRequest;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Correction request submitted successfully',
      data: attendance
    });

  } catch (error) {
    console.error('Request correction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Request leave
// @route   POST /api/employee/attendance/leave
// @access  Private (Employee)
exports.requestLeave = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const {
      startDate,
      endDate,
      leaveType,
      reason
    } = req.body;

    if (!startDate || !endDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, leave type, and reason are required'
      });
    }

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // Validate dates
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    // Check if leave request already exists for these dates
    const existingLeave = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: start, $lte: end },
      'leaveRequest.status': 'pending'
    });

    if (existingLeave) {
      return res.status(400).json({
        success: false,
        message: 'Leave request already exists for these dates'
      });
    }

    // Create leave requests for each day
    const leaveRequests = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const leaveDate = new Date(currentDate);

      // Check if attendance record exists
      let attendance = await Attendance.findOne({
        employeeId: employee._id,
        date: leaveDate
      });

      if (!attendance) {
        attendance = await Attendance.create({
          employeeId: employee._id,
          date: leaveDate,
          status: 'leave',
          leaveRequest: {
            leaveType,
            reason,
            status: 'pending',
            requestedAt: new Date()
          }
        });
      } else {
        attendance.status = 'leave';
        attendance.leaveRequest = {
          leaveType,
          reason,
          status: 'pending',
          requestedAt: new Date()
        };
        await attendance.save();
      }

      leaveRequests.push(attendance);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({
      success: true,
      message: `Leave request submitted for ${leaveRequests.length} day(s)`,
      data: leaveRequests
    });

  } catch (error) {
    console.error('Request leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== ADMIN ATTENDANCE MANAGEMENT ====================

// @desc    Get all attendance records (Admin)
// @route   GET /api/admin/attendance
// @access  Private (Admin)
exports.getAllAttendance = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employeeId,
      status,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    if (employeeId) {
      const employee = await Employee.findOne({ userId: employeeId });
      if (employee) {
        query.employeeId = employee._id;
      }
    }

    if (status) {
      query.status = status;
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    const count = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get daily attendance
// @route   GET /api/admin/attendance/daily
// @access  Private (Admin)
exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({
      date: targetDate
    })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ checkInTime: 1 });

    // Get all employees to find who hasn't checked in
    const allEmployees = await Employee.find()
      .populate('userId', 'name email');

    const checkedInEmployeeIds = attendance.map(a => a.employeeId._id.toString());

    const notCheckedIn = allEmployees.filter(emp =>
      !checkedInEmployeeIds.includes(emp._id.toString())
    );

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.isLate).length,
        absent: notCheckedIn.length,
        attendance,
        notCheckedIn
      }
    });

  } catch (error) {
    console.error('Get daily attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get monthly attendance report
// @route   GET /api/admin/attendance/monthly
// @access  Private (Admin)
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;

    const targetMonth = month ? parseInt(month) : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const attendance = await Attendance.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    // Group by employee
    const employeeStats = {};

    attendance.forEach(record => {
      const empId = record.employeeId._id.toString();

      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employee: {
            id: empId,
            name: record.employeeId.userId.name,
            email: record.employeeId.userId.email,
            employeeId: record.employeeId.employeeId
          },
          totalDays: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          leaveDays: 0,
          totalWorkHours: 0
        };
      }

      employeeStats[empId].totalDays++;

      if (record.status === 'present' || record.isLate) {
        employeeStats[empId].presentDays++;
      }
      if (record.isLate) {
        employeeStats[empId].lateDays++;
      }
      if (record.status === 'absent') {
        employeeStats[empId].absentDays++;
      }
      if (record.status === 'leave') {
        employeeStats[empId].leaveDays++;
      }
      if (record.workHours) {
        employeeStats[empId].totalWorkHours += record.workHours;
      }
    });

    const report = Object.values(employeeStats);

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth + 1,
        year: targetYear,
        report
      }
    });

  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get attendance report
// @route   GET /api/admin/attendance/report
// @access  Private (Admin)
exports.getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (employeeId) {
      const employee = await Employee.findOne({ userId: employeeId });
      if (employee) {
        query.employeeId = employee._id;
      }
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ date: -1 });

    // Calculate overall statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present' || a.isLate).length;
    const lateCount = attendance.filter(a => a.isLate).length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const leaveCount = attendance.filter(a => a.status === 'leave').length;

    res.status(200).json({
      success: true,
      data: {
        period: {
          startDate,
          endDate
        },
        statistics: {
          totalRecords,
          presentCount,
          lateCount,
          absentCount,
          leaveCount,
          attendanceRate: totalRecords > 0
            ? ((presentCount / totalRecords) * 100).toFixed(2)
            : 0
        },
        records: attendance
      }
    });

  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve attendance correction
// @route   PUT /api/admin/attendance/correction/:id/approve
// @access  Private (Admin)
exports.approveCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    if (!attendance.correctionRequest || attendance.correctionRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending correction request found'
      });
    }

    // Apply correction
    if (attendance.correctionRequest.correctCheckInTime) {
      attendance.checkInTime = attendance.correctionRequest.correctCheckInTime;
    }
    if (attendance.correctionRequest.correctCheckOutTime) {
      attendance.checkOutTime = attendance.correctionRequest.correctCheckOutTime;
    }

    // Recalculate work hours if both times exist
    if (attendance.checkInTime && attendance.checkOutTime) {
      const workHours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
      attendance.workHours = parseFloat(workHours.toFixed(2));
    }

    attendance.correctionRequest.status = 'approved';
    attendance.correctionRequest.approvedBy = req.user.id;
    attendance.correctionRequest.approvedAt = new Date();
    if (adminNotes) {
      attendance.correctionRequest.adminNotes = adminNotes;
    }

    // Update status if was absent
    if (attendance.status === 'absent' && attendance.checkInTime) {
      attendance.status = 'present';
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Correction request approved',
      data: attendance
    });

  } catch (error) {
    console.error('Approve correction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reject attendance correction
// @route   PUT /api/admin/attendance/correction/:id/reject
// @access  Private (Admin)
exports.rejectCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!adminNotes) {
      return res.status(400).json({
        success: false,
        message: 'Admin notes are required for rejection'
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    if (!attendance.correctionRequest || attendance.correctionRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending correction request found'
      });
    }

    attendance.correctionRequest.status = 'rejected';
    attendance.correctionRequest.approvedBy = req.user.id;
    attendance.correctionRequest.approvedAt = new Date();
    attendance.correctionRequest.adminNotes = adminNotes;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Correction request rejected',
      data: attendance
    });

  } catch (error) {
    console.error('Reject correction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Add these two functions to your attendanceController.js
// Add them right before the "module.exports = exports;" line

// @desc    Get late arrivals
// @route   GET /api/admin/attendance/late
// @access  Private (Admin)
exports.getLateArrivals = async (req, res) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const lateAttendance = await Attendance.find({
      date: targetDate,
      isLate: true
    })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ checkInTime: -1 });

    const lateArrivals = lateAttendance.map(a => ({
      employee: {
        id: a.employeeId._id,
        name: a.employeeId.userId.name,
        email: a.employeeId.userId.email,
        employeeId: a.employeeId.employeeId
      },
      checkInTime: a.checkInTime,
      lateBy: a.lateBy,
      status: a.status,
      notes: a.notes
    }));

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        count: lateArrivals.length,
        lateArrivals
      }
    });

  } catch (error) {
    console.error('Get late arrivals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get specific employee's attendance
// @route   GET /api/admin/attendance/employee/:employeeId
// @access  Private (Admin)
exports.getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, month, year } = req.query;

    // Find employee by userId
    const employee = await Employee.findOne({ userId: employeeId })
      .populate('userId', 'name email');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Build date query
    let query = { employeeId: employee._id };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (month && year) {
      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const start = new Date(targetYear, targetMonth, 1);
      const end = new Date(targetYear, targetMonth + 1, 0);
      query.date = { $gte: start, $lte: end };
    } else {
      // Default: Last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.date = { $gte: thirtyDaysAgo };
    }

    const records = await Attendance.find(query).sort({ date: -1 });

    // Calculate summary
    const summary = {
      totalDays: records.length,
      presentDays: records.filter(r => r.status === 'present' || r.status === 'late').length,
      absentDays: records.filter(r => r.status === 'absent').length,
      lateDays: records.filter(r => r.isLate).length,
      leaveDays: records.filter(r => r.status === 'leave').length,
      halfDays: records.filter(r => r.status === 'half-day').length,
      totalWorkHours: records.reduce((sum, r) => sum + (r.workHours || 0), 0).toFixed(2),
      averageWorkHours: records.length > 0
        ? (records.reduce((sum, r) => sum + (r.workHours || 0), 0) / records.length).toFixed(2)
        : 0,
      attendanceRate: records.length > 0
        ? (((records.filter(r => r.status === 'present' || r.status === 'late').length) / records.length) * 100).toFixed(2)
        : 0
    };

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          userId: employee.userId._id,
          name: employee.userId.name,
          email: employee.userId.email,
          employeeId: employee.employeeId,
          department: employee.department,
          position: employee.position
        },
        summary,
        records
      }
    });

  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getPendingCorrections = async (req, res) => {
  try {
    const pendingCorrections = await Attendance.find({
      'correctionRequest.status': 'pending'
    })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ 'correctionRequest.requestedAt': -1 });

    res.status(200).json({
      success: true,
      data: {
        count: pendingCorrections.length,
        corrections: pendingCorrections
      }
    });

  } catch (error) {
    console.error('Get pending corrections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/admin/attendance/:id
// @access  Private (Admin)
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await attendance.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export attendance data
// @route   GET /api/admin/attendance/export
// @access  Private (Admin)
exports.exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    const attendance = await Attendance.find(query)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ date: -1 });

    // Format data for export
    const exportData = attendance.map(record => ({
      Date: record.date.toISOString().split('T')[0],
      EmployeeID: record.employeeId?.employeeId || 'N/A',
      EmployeeName: record.employeeId?.userId?.name || 'N/A',
      Email: record.employeeId?.userId?.email || 'N/A',
      CheckIn: record.checkInTime ? record.checkInTime.toISOString() : 'N/A',
      CheckOut: record.checkOutTime ? record.checkOutTime.toISOString() : 'N/A',
      WorkHours: record.workHours || 0,
      Status: record.status,
      IsLate: record.isLate ? 'Yes' : 'No',
      Location: record.checkInLocation || 'N/A',
      Notes: record.notes || ''
    }));

    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(exportData[0] || {}).join(',');
      const rows = exportData.map(row =>
        Object.values(row).map(val => `"${val}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_${startDate}_${endDate}.csv`);
      return res.send(csv);
    }

    // Default: JSON format
    res.status(200).json({
      success: true,
      data: {
        period: { startDate, endDate },
        totalRecords: exportData.length,
        records: exportData
      }
    });

  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get my correction requests
// @route   GET /api/employee/attendance/corrections
// @access  Private (Employee)
exports.getMyCorrections = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const corrections = await Attendance.find({
      employeeId: employee._id,
      'correctionRequest': { $exists: true }
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: corrections
    });

  } catch (error) {
    console.error('Get my corrections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get my leave requests
// @route   GET /api/employee/attendance/leaves
// @access  Private (Employee)
exports.getMyLeaves = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const leaves = await Attendance.find({
      employeeId: employee._id,
      'leaveRequest': { $exists: true }
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: leaves
    });

  } catch (error) {
    console.error('Get my leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get today's attendance
// @route   GET /api/employee/attendance/today
// @access  Private (Employee)
exports.getTodayAttendance = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: today }
    });

    if (!todayAttendance) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No attendance record for today'
      });
    }

    res.status(200).json({
      success: true,
      data: todayAttendance
    });

  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


module.exports = exports;