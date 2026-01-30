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
        employeeName: employee.userId?.name || employee.name,
        checkOut: attendance.checkOutTime,
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

exports.checkIn = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { location, notes } = req.body;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: today }
    });

    if (existingAttendance) {
      if (existingAttendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message: 'Already checked in today',
          data: existingAttendance
        });
      }
    }

    const checkInTime = new Date();
    
    // Determine if late (assuming office starts at 9:00 AM)
    const officeStartTime = new Date(today);
    officeStartTime.setHours(9, 0, 0, 0);
    
    const isLate = checkInTime > officeStartTime;

    const attendance = await Attendance.create({
      employeeId: employee._id,
      date: today,
      checkInTime,
      checkInLocation: location || 'Office',
      status: isLate ? 'late' : 'present',
      isLate,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: `Checked in successfully${isLate ? ' (Late)' : ''}`,
      data: attendance
    });

  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Check out (Clock out)
// @route   POST /api/employee/attendance/checkout
// @access  Private (Employee)
exports.checkOut = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { location, notes } = req.body;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Find today's attendance record
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: today }
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
        message: 'Already checked out today',
        data: attendance
      });
    }

    const checkOutTime = new Date();
    
    // Calculate work hours
    const workHours = (checkOutTime - attendance.checkInTime) / (1000 * 60 * 60); // Convert to hours

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = location || 'Office';
    attendance.workHours = parseFloat(workHours.toFixed(2));
    
    if (notes) {
      attendance.notes = attendance.notes 
        ? `${attendance.notes}\n${notes}` 
        : notes;
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: attendance
    });

  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

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