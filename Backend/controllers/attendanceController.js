// controllers/attendanceController.js
// Attendance Check-in/Check-out, Corrections, Leave Requests

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// ==================== HELPER FUNCTIONS ====================

const getPKTDate = (dateString) => {
  const PKT_OFFSET = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
  
  if (dateString) {
    const date = new Date(dateString);
    const utcDate = new Date(date.getTime() + PKT_OFFSET);
    utcDate.setUTCHours(0, 0, 0, 0);
    return utcDate;
  } else {
    const now = new Date();
    const pktNow = new Date(now.getTime() + PKT_OFFSET);
    pktNow.setUTCHours(0, 0, 0, 0);
    return pktNow;
  }
};

const getEndOfDayPKT = (dateString) => {
  const PKT_OFFSET = 5 * 60 * 60 * 1000;
  const date = new Date(dateString || new Date());
  const utcDate = new Date(date.getTime() + PKT_OFFSET);
  utcDate.setUTCHours(23, 59, 59, 999);
  return utcDate;
};

// ==================== EMPLOYEE ATTENDANCE ====================

// @desc    Check in (Clock in)
// @route   POST /api/employee/attendance/checkin
// @access  Private (Employee)
exports.checkIn = async (req, res) => {
  try {
    console.log('====================================');
    console.log('🔐 CHECK-IN REQUEST');
    console.log('====================================');

    const { location, notes } = req.body;
    const userId = req.user._id;

    // Find employee
    const employee = await Employee.findOne({ userId });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    console.log('✅ Employee found:', employee.name);

    // Get today's date in PKT
    const todayStart = getPKTDate();
    const todayEnd = getEndOfDayPKT();
    
    console.log('📅 Today (PKT):', todayStart.toISOString());

    // Check existing attendance
    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });

    if (existingAttendance && existingAttendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in today'
      });
    }

    const checkInTime = new Date();
    
    // Check if late (after 9 AM PKT)
    const hour = new Date(checkInTime.getTime() + (5 * 60 * 60 * 1000)).getUTCHours();
    const isLate = hour >= 9;

    // Create attendance
    const attendanceData = {
      employeeId: employee._id,
      date: todayStart,
      checkInTime: checkInTime,
      checkInMethod: 'Manual', // Valid enum value
      status: 'present',
      isLate: isLate,
      checkInIpAddress: req.ip,
      checkInDeviceInfo: req.headers['user-agent'],
      notes: notes || ''
    };

    // Add location if provided
    if (location?.latitude && location?.longitude) {
      attendanceData.checkInCoordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      };
      attendanceData.checkInLocation = 'Remote';
    } else {
      attendanceData.checkInLocation = 'Office';
    }

    let attendance;
    if (existingAttendance) {
      attendance = await Attendance.findByIdAndUpdate(
        existingAttendance._id,
        attendanceData,
        { new: true }
      );
    } else {
      attendance = await Attendance.create(attendanceData);
    }

    console.log('✅ CHECK-IN SUCCESSFUL');

    // Emit socket event
    try {
      const io = getIO();
      io.to('admin').emit('attendance-marked', {
        employeeId: employee._id,
        employeeName: employee.name || 'Unknown',
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
      message: isLate ? 'Checked in (Late)' : 'Checked in successfully',
      data: attendance,
      isLate
    });
  } catch (error) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Check out
// @route   POST /api/employee/attendance/checkout
// @access  Private (Employee)
exports.checkOut = async (req, res) => {
  try {
    console.log('====================================');
    console.log('🚪 CHECK-OUT REQUEST RECEIVED');
    console.log('====================================');

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

    // ✅ USE PKT TIMEZONE (same as check-in)
    const todayStart = getPKTDate();
    const todayEnd = getEndOfDayPKT();

    console.log('📅 Looking for attendance between:', todayStart.toISOString(), 'and', todayEnd.toISOString());

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: todayStart,
        $lte: todayEnd
      }
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

    // Set checkout time
    const checkOutTime = timestamp ? new Date(timestamp) : new Date();
    attendance.checkOutTime = checkOutTime;

    console.log('⏰ Check-out time:', checkOutTime);
    console.log('⏰ Check-in time:', attendance.checkInTime);

    // Handle location
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

    attendance.checkOutMethod = 'Manual'; // Valid enum value
    attendance.checkOutIpAddress = req.ip;
    attendance.checkOutDeviceInfo = req.headers['user-agent'];

    // Auto-checkout notes
    if (autoCheckout) {
      attendance.notes = (attendance.notes || '') + ` | Auto checkout: ${reason}`;
    }

    // Calculate work hours (will be done by pre-save hook)
    await attendance.save();

    console.log('✅ Work hours calculated:', attendance.workHours);

    // Emit socket event
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

    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: {
        ...attendance.toObject(),
        checkOut: attendance.checkOutTime
      },
      checkOut: attendance.checkOutTime,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      workHours: attendance.workHours
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ CHECK-OUT ERROR');
    console.error('====================================');
    console.error('Error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check out'
    });
  }
};

// @desc    Get attendance status
// @route   GET /api/employee/attendance/status
// @access  Private (Employee)
exports.getAttendanceStatus = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📊 GET ATTENDANCE STATUS CALLED');
    console.log('====================================');

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

    // ✅ USE PKT TIMEZONE (same as check-in and check-out)
    const todayStart = getPKTDate();
    const todayEnd = getEndOfDayPKT();

    console.log('📅 Looking for attendance between:', todayStart.toISOString(), 'and', todayEnd.toISOString());

    // Find today's attendance
    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: todayStart,
        $lte: todayEnd
      }
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
        checkOut: attendance.checkOutTime
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

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get attendance status'
    });
  }
};

// @desc    Get my attendance records
// @route   GET /api/employee/attendance
// @access  Private (Employee)
exports.getMyAttendance = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const employee = await Employee.findOne({ userId });

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

// @desc    Get attendance summary
// @route   GET /api/employee/attendance/summary
// @access  Private (Employee)
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

// @desc    Request correction
// @route   POST /api/employee/attendance/correction
// @access  Private (Employee)
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

    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: targetDate
    });

    if (!attendance) {
      // Create attendance record if it doesn't exist
      attendance = await Attendance.create({
        employeeId: employee._id,
        date: targetDate,
        status: 'absent',
        notes: 'Correction requested'
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

// @desc    Request leave
// @route   POST /api/employee/attendance/leave
// @access  Private (Employee)
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

    const { startDate, endDate, leaveType, reason } = req.body;

    if (!startDate || !endDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, leave type, and reason are required'
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

    // Create leave requests for each day
    const leaveRequests = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const leaveDate = new Date(currentDate);

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
    console.error('❌ Request leave error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request leave'
    });
  }
};

// @desc    Get my correction requests
// @route   GET /api/employee/attendance/corrections
// @access  Private (Employee)
exports.getMyCorrections = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId });

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
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId });

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
    const userId = req.user._id || req.user.id;

    const employee = await Employee.findOne({ userId });

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
    console.log('====================================');
    console.log('📥 GET DAILY ATTENDANCE CALLED');
    console.log('Query params:', req.query);
    console.log('====================================');

    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    
    // USE PKT TIMEZONE
    const queryDate = getPKTDate(dateParam);
    const nextDay = getEndOfDayPKT(dateParam);
    
    console.log('📅 Query date (PKT):', queryDate.toISOString());
    console.log('📅 End of day (PKT):', nextDay.toISOString());

    // Get all active employees
    const employees = await Employee.find({ isActive: true }).select('employeeId name email department position');
    console.log('👥 Total active employees:', employees.length);

    // Query attendance records for the PKT date range
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: queryDate,
        $lte: nextDay
      }
    }).populate('employeeId', 'employeeId name email department');

    console.log('✅ Attendance records found:', attendanceRecords.length);

    // Create attendance status for each employee
    const attendanceData = employees.map(employee => {
      const record = attendanceRecords.find(
        att => att.employeeId && att.employeeId._id.toString() === employee._id.toString()
      );

      if (record) {
        return {
          _id: record._id,
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          position: employee.position,
          status: record.status,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          workingHours: record.workingHours,
          isLate: record.isLate,
          hasCheckIn: !!record.checkInTime,
          hasCheckOut: !!record.checkOutTime,
          date: record.date
        };
      } else {
        return {
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          position: employee.position,
          status: 'absent',
          hasCheckIn: false,
          hasCheckOut: false,
        };
      }
    });

    const stats = {
      total: employees.length,
      present: attendanceData.filter(a => a.status === 'present').length,
      late: attendanceData.filter(a => a.isLate).length,
      absent: attendanceData.filter(a => a.status === 'absent').length
    };

    console.log('📊 Stats:', stats);
    console.log('====================================');

    res.status(200).json({
      success: true,
      attendance: attendanceData,
      stats,
      date: dateParam
    });
  } catch (error) {
    console.error('❌ Get daily attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get monthly attendance
// @route   GET /api/admin/attendance/monthly
// @access  Private (Admin)
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetYear, targetMonth + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log('📅 Getting monthly attendance for:', {
      month: targetMonth + 1,
      year: targetYear,
      startDate,
      endDate
    });

    // Get all attendance records for the month
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate({
      path: 'employeeId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    }).sort({ date: 1 });

    // Get all active employees
    const employees = await Employee.find({ isActive: true })
      .populate('userId', 'name email');

    // Group attendance by employee
    const employeeAttendance = employees.map(employee => {
      const records = attendanceRecords.filter(
        record => record.employeeId && record.employeeId._id.toString() === employee._id.toString()
      );

      const presentDays = records.filter(r => r.status === 'present').length;
      const absentDays = records.filter(r => r.status === 'absent').length;
      const lateDays = records.filter(r => r.isLate).length;
      const leaveDays = records.filter(r => r.status === 'leave').length;
      const totalWorkHours = records.reduce((sum, r) => sum + (r.workHours || 0), 0);

      return {
        employeeId: employee.employeeId,
        name: employee.userId?.name || employee.name,
        email: employee.userId?.email || employee.email,
        department: employee.department,
        position: employee.position,
        summary: {
          totalDays: records.length,
          presentDays,
          absentDays,
          lateDays,
          leaveDays,
          totalWorkHours: totalWorkHours.toFixed(2),
          averageWorkHours: records.length > 0 ? (totalWorkHours / records.length).toFixed(2) : 0,
          attendanceRate: records.length > 0 ? ((presentDays / records.length) * 100).toFixed(2) : 0
        },
        records
      };
    });

    // Overall statistics
    const stats = {
      totalEmployees: employees.length,
      totalRecords: attendanceRecords.length,
      totalPresent: attendanceRecords.filter(r => r.status === 'present').length,
      totalAbsent: attendanceRecords.filter(r => r.status === 'absent').length,
      totalLate: attendanceRecords.filter(r => r.isLate).length,
      totalLeave: attendanceRecords.filter(r => r.status === 'leave').length,
      totalWorkHours: attendanceRecords.reduce((sum, r) => sum + (r.workHours || 0), 0).toFixed(2)
    };

    res.status(200).json({
      success: true,
      month: targetMonth + 1,
      year: targetYear,
      stats,
      data: employeeAttendance
    });

  } catch (error) {
    console.error('❌ Get monthly attendance error:', error);
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

// @desc    Get pending corrections
// @route   GET /api/admin/attendance/corrections/pending
// @access  Private (Admin)
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

module.exports = exports;