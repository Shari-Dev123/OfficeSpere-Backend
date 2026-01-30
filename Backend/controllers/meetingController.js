// controllers/meetingController.js
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const { sendEmail } = require('../utils/sendEmail');
const { getIO } = require('../config/socket');

// @desc    Get all meetings (Admin)
// @route   GET /api/admin/meetings
// @access  Private/Admin
exports.getAllMeetings = async (req, res) => {
  try {
    const { status, startDate, endDate, type } = req.query;
    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name')
      .sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      count: meetings.length,
      meetings
    });
  } catch (error) {
    console.error('Get all meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meetings',
      error: error.message
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/admin/meetings/:id
// @access  Private
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name client')
      .populate('minutes.recordedBy', 'name email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is authorized to view this meeting
    const isParticipant = meeting.participants.some(
      p => p.user._id.toString() === req.user.id
    );
    const isOrganizer = meeting.organizer._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isParticipant && !isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this meeting'
      });
    }

    res.status(200).json({
      success: true,
      meeting
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meeting',
      error: error.message
    });
  }
};

// @desc    Schedule new meeting (Admin)
// @route   POST /api/admin/meetings
// @access  Private/Admin
exports.scheduleMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      startTime,
      endTime,
      duration,
      location,
      meetingLink,
      participants,
      project,
      agenda,
      isRecurring,
      recurringPattern
    } = req.body;

    // Validate required fields
    if (!title || !startTime || !endTime || !duration || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, start time, end time, duration, and type'
      });
    }

    // Validate participants exist
    if (participants && participants.length > 0) {
      const participantUsers = await User.find({
        _id: { $in: participants }
      });

      if (participantUsers.length !== participants.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more participants not found'
        });
      }
    }

    // Generate meeting ID
    const meetingCount = await Meeting.countDocuments();
    const meetingId = `MTG${String(meetingCount + 1).padStart(5, '0')}`;

    // Create meeting
    const meeting = await Meeting.create({
      meetingId,
      title,
      description,
      type,
      startTime,
      endTime,
      duration,
      location: location || 'Office',
      meetingLink,
      participants: participants?.map(userId => ({
        user: userId,
        status: 'Invited'
      })) || [],
      project,
      agenda,
      isRecurring,
      recurringPattern,
      organizer: req.user.id,
      status: 'Scheduled'
    });

    // Populate meeting
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    // Send email notifications to participants
    if (participants && participants.length > 0) {
      const participantUsers = await User.find({
        _id: { $in: participants }
      });

      for (const participant of participantUsers) {
        try {
          await sendEmail({
            to: participant.email,
            subject: `Meeting Scheduled: ${title}`,
            html: `
              <h2>You have been invited to a meeting</h2>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Date:</strong> ${new Date(startTime).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
              ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
              ${meetingLink ? `<p><strong>Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
              <p>Please confirm your attendance.</p>
            `
          });
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: populatedMeeting
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling meeting',
      error: error.message
    });
  }
};

// @desc    Update meeting
// @route   PUT /api/admin/meetings/:id
// @access  Private/Admin
exports.updateMeeting = async (req, res) => {
  try {
    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const {
      title,
      description,
      type,
      startTime,
      endTime,
      duration,
      location,
      meetingLink,
      participants,
      status,
      agenda
    } = req.body;

    // Update fields
    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (type) meeting.type = type;
    if (startTime) meeting.startTime = startTime;
    if (endTime) meeting.endTime = endTime;
    if (duration) meeting.duration = duration;
    if (location) meeting.location = location;
    if (meetingLink) meeting.meetingLink = meetingLink;
    if (status) meeting.status = status;
    if (agenda) meeting.agenda = agenda;

    // Update participants if provided
    if (participants && participants.length > 0) {
      meeting.participants = participants.map(userId => ({
        user: userId,
        status: 'Invited'
      }));
    }

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    // Send update notifications
    const participantUsers = await User.find({
      _id: { $in: meeting.participants.map(p => p.user) }
    });

    for (const participant of participantUsers) {
      try {
        await sendEmail({
          to: participant.email,
          subject: `Meeting Updated: ${title}`,
          html: `
            <h2>Meeting details have been updated</h2>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Date:</strong> ${new Date(startTime).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            <p>Please check the updated details in your dashboard.</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Meeting updated successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating meeting',
      error: error.message
    });
  }
};

// @desc    Delete meeting
// @route   DELETE /api/admin/meetings/:id
// @access  Private/Admin
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Get participants before deleting
    const participantUsers = await User.find({
      _id: { $in: meeting.participants.map(p => p.user) }
    });

    await meeting.deleteOne();

    // Send cancellation notifications
    for (const participant of participantUsers) {
      try {
        await sendEmail({
          to: participant.email,
          subject: `Meeting Cancelled: ${meeting.title}`,
          html: `
            <h2>Meeting has been cancelled</h2>
            <p><strong>Title:</strong> ${meeting.title}</p>
            <p><strong>Scheduled Date:</strong> ${new Date(meeting.startTime).toLocaleString()}</p>
            <p>This meeting has been cancelled by the organizer.</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting meeting',
      error: error.message
    });
  }
};

// @desc    Add meeting minutes/notes
// @route   POST /api/admin/meetings/:id/minutes
// @access  Private/Admin
exports.addMeetingMinutes = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const { discussion, decisions, actionItems } = req.body;

    meeting.minutes = {
      discussion,
      decisions: decisions || [],
      actionItems: actionItems || [],
      recordedBy: req.user.id,
      recordedAt: new Date()
    };
    meeting.status = 'Completed';

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('minutes.recordedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Meeting minutes added successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Add meeting minutes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding meeting minutes',
      error: error.message
    });
  }
};

// @desc    Update participant status
// @route   PATCH /api/meetings/:id/status
// @access  Private
exports.updateParticipantStatus = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const { status } = req.body; // 'Accepted', 'Declined', 'Tentative'

    if (!['Accepted', 'Declined', 'Tentative'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Accepted, Declined, or Tentative'
      });
    }

    const participant = meeting.participants.find(
      p => p.user.toString() === req.user.id
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not a participant in this meeting'
      });
    }

    participant.status = status;

    await meeting.save();

    res.status(200).json({
      success: true,
      message: `Meeting ${status.toLowerCase()} successfully`,
      meeting
    });
  } catch (error) {
    console.error('Update participant status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating participant status',
      error: error.message
    });
  }
};

// @desc    Get my meetings (Employee/Client)
// @route   GET /api/employee/meetings OR /api/client/meetings
// @access  Private
exports.getMyMeetings = async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    let query = {
      $or: [
        { 'participants.user': req.user.id },
        { organizer: req.user.id }
      ]
    };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Get only upcoming meetings
    if (upcoming === 'true') {
      query.startTime = { $gte: new Date() };
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name')
      .sort({ startTime: 1 });

    // Transform to match frontend expectations
    const transformedMeetings = meetings.map(meeting => ({
      _id: meeting._id,
      meetingId: meeting.meetingId,
      title: meeting.title,
      description: meeting.description,
      dateTime: meeting.startTime, // ✅ Frontend expects dateTime
      duration: meeting.duration,
      meetingType: meeting.location === 'Online' ? 'online' : 'in-person', // ✅ Map to frontend format
      location: meeting.location,
      meetingLink: meeting.meetingLink,
      status: meeting.status,
      organizer: meeting.organizer,
      participants: meeting.participants,
      project: meeting.project,
      projectName: meeting.project?.name
    }));

    res.status(200).json({
      success: true,
      count: transformedMeetings.length,
      meetings: transformedMeetings
    });
  } catch (error) {
    console.error('Get my meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meetings',
      error: error.message
    });
  }
};

// @desc    Schedule meeting (Client)
// @route   POST /api/client/meetings
// @access  Private/Client
exports.clientScheduleMeeting = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      dateTime,        // ✅ Frontend sends dateTime
      duration, 
      meetingType,     // ✅ Frontend sends meetingType (online/in-person)
      location, 
      meetingLink, 
      projectId 
    } = req.body;

    console.log('📥 Client meeting request:', req.body);

    // ✅ Validate required fields
    if (!title || !dateTime || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, date/time, and duration'
      });
    }

    // ✅ Parse dateTime and calculate endTime
    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes

    // ✅ Validate date is in future
    if (startTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Meeting date must be in the future'
      });
    }

    // ✅ Generate unique meeting ID
    const meetingCount = await Meeting.countDocuments();
    const meetingId = `MTG${String(meetingCount + 1).padStart(5, '0')}`;

    // ✅ Map meetingType to location enum
    const mappedLocation = meetingType === 'online' ? 'Online' : 'Office';

    // ✅ Validate in-person meetings have location
    if (meetingType === 'in-person' && (!location || !location.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Location is required for in-person meetings'
      });
    }

    // ✅ Create meeting matching the Meeting model schema
    const meeting = await Meeting.create({
      meetingId,
      title: title.trim(),
      description: description?.trim() || '',
      type: 'Client',              // ✅ Required by model
      organizer: req.user.id,
      startTime,                   // ✅ Required by model
      endTime,                     // ✅ Required by model
      duration: parseInt(duration),
      location: mappedLocation,    // ✅ Required enum value
      meetingLink: meetingLink?.trim() || '',
      agenda: description?.trim() || '',
      project: projectId || undefined,
      participants: [{
        user: req.user.id,
        role: 'Organizer',
        status: 'Accepted'
      }],
      status: 'Scheduled'
    });

    // ✅ Populate meeting data
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    console.log('✅ Meeting created:', populatedMeeting);

    // Transform to match frontend expectations
    const transformedMeeting = {
      _id: populatedMeeting._id,
      meetingId: populatedMeeting.meetingId,
      title: populatedMeeting.title,
      description: populatedMeeting.description,
      dateTime: populatedMeeting.startTime,
      duration: populatedMeeting.duration,
      meetingType: populatedMeeting.location === 'Online' ? 'online' : 'in-person',
      location: populatedMeeting.location,
      meetingLink: populatedMeeting.meetingLink,
      status: populatedMeeting.status,
      organizer: populatedMeeting.organizer,
      participants: populatedMeeting.participants,
      project: populatedMeeting.project,
      projectName: populatedMeeting.project?.name
    };

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: transformedMeeting
    });
  } catch (error) {
    console.error('❌ Client schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling meeting',
      error: error.message
    });
  }
};

// @desc    Cancel meeting (Client)
// @route   DELETE /api/client/meetings/:id
// @access  Private/Client
exports.clientCancelMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if client is the organizer
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this meeting'
      });
    }

    meeting.status = 'Cancelled';
    await meeting.save();

    res.status(200).json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
  } catch (error) {
    console.error('Client cancel meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling meeting',
      error: error.message
    });
  }
};
exports.scheduleMeeting = async (req, res) => {
  try {
    // ... your existing code for creating meeting ...

    const meeting = await Meeting.create({
      meetingId,
      title,
      description,
      type,
      startTime,
      endTime,
      duration,
      location: location || 'Office',
      meetingLink,
      participants: participants?.map(userId => ({
        user: userId,
        status: 'Invited'
      })) || [],
      project,
      agenda,
      isRecurring,
      recurringPattern,
      organizer: req.user.id,
      status: 'Scheduled'
    });

    // Populate meeting
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    // ✅ EMIT SOCKET EVENTS
    try {
      const io = getIO();
      
      if (participants && participants.length > 0) {
        participants.forEach(participantId => {
          io.to(`employee-${participantId}`).emit('meeting-scheduled', {
            meeting: {
              _id: meeting._id,
              title: meeting.title,
              startTime: meeting.startTime,
              duration: meeting.duration,
              location: meeting.location,
              meetingLink: meeting.meetingLink
            }
          });
        });
      }

      // Notify admins
      io.to('admin').emit('meeting-scheduled', { meeting: populatedMeeting });
      
      console.log('📡 Meeting scheduled events emitted');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    // ... rest of your email code ...

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: populatedMeeting
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling meeting',
      error: error.message
    });
  }
};


module.exports = exports;